# Pagamentos: Depósito e Saque PIX (Asaas + Supabase)

Este documento descreve como foi implementado o fluxo de **depósito** e **saque** via PIX usando **Asaas** como gateway e **Supabase** (Edge Functions + Postgres). Serve como guia para replicar ou manter o sistema.

---

## 1. Visão geral

- **Provedor de pagamento:** Asaas (API v3).
- **Backend:** Supabase (Edge Functions em Deno + Postgres).
- **Frontend:** React chama as Edge Functions com JWT do usuário (e opcionalmente anon key no header `apikey`).
- **Depósito:** Usuário gera QR Code PIX na carteira → paga no app do banco → Asaas envia webhook → saldo é creditado.
- **Saque:** Usuário solicita saque com chave PIX → saldo é bloqueado → nossa função cria transferência no Asaas → Asaas chama URL de autorização externa → aprovamos → PIX é enviado.

---

## 2. Variáveis de ambiente e configuração

### 2.1 Secrets no Supabase (Edge Functions)

| Secret | Uso |
|--------|-----|
| `ASAAS_API_KEY` | API Key do Asaas (produção ou sandbox). Obrigatório para depósito e saque. |
| `ASAAS_BASE_URL` | Opcional. Default: `https://api.asaas.com/v3`. Para sandbox: `https://sandbox.asaas.com/api/v3`. |
| `ASAAS_WEBHOOK_SECRET` | Opcional. Token que o Asaas envia no header `asaas-access-token` no **webhook de cobrança**. Se definido, a função `asaas-webhook` valida esse token. |
| `ASAAS_WITHDRAW_VALIDATE_TOKEN` | Opcional. Token que o Asaas envia no header `asaas-access-token` na **autorização externa de saque**. Se definido, a função `asaas-withdraw-validate` valida. |
| `CRON_SECRET` | Usado para chamar `process-withdrawal` e `sync-failed-withdrawals` via cron (header `Authorization: Bearer <CRON_SECRET>`). |

### 2.2 Configuração no painel Asaas

**Cobranças / Webhook (depósito):**

- Menu: **Integrações** → **Webhooks** (ou equivalente para eventos de cobrança).
- URL do webhook: `https://<PROJECT_REF>.supabase.co/functions/v1/asaas-webhook`
- Eventos: incluir pelo menos `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`.
- Token de acesso (opcional): mesmo valor que o secret `ASAAS_WEBHOOK_SECRET` no Supabase.

**Autorização externa de saque (obrigatório para saques):**

- Menu: **Integrações** → **Mecanismos de segurança** (ou “Autorização externa de saque”).
- URL: `https://<PROJECT_REF>.supabase.co/functions/v1/asaas-withdraw-validate`
- Token de autenticação (opcional): mesmo valor que `ASAAS_WITHDRAW_VALIDATE_TOKEN` no Supabase.
- Importante: sem essa URL configurada e com a função respondendo 200 + `APPROVED`, o Asaas marca a transferência como “Falha na comunicação” e o saque não é realizado.

### 2.3 Gateway Supabase: JWT nas Edge Functions

Funções chamadas **pelo navegador** (com JWT do usuário) podem ter `verify_jwt = false` no `config.toml` e validar o JWT no próprio código com `getUser()`. Funções chamadas **apenas por servidores externos** (Asaas) **devem** ter `verify_jwt = false`, senão o gateway retorna 401 antes do handler rodar (o Asaas não envia `Authorization: Bearer <anon_key>`).

No projeto, em `supabase/config.toml`:

- `create-pix-deposit`, `request-withdrawal`, `cancel-withdrawal`, `process-my-withdrawals`: `verify_jwt = false` (JWT validado no código).
- `process-withdrawal`, `sync-failed-withdrawals`: `verify_jwt = false` (protegidos por `CRON_SECRET` no código).
- `asaas-webhook`, `asaas-withdraw-validate`: `verify_jwt = false` (chamadas pelo Asaas, sem JWT Supabase).

---

## 3. Banco de dados (resumo)

- **wallets:** `user_id`, `balance_available`, `balance_locked`. Uma linha por usuário. Apenas service role escreve.
- **transactions:** histórico de movimentações (`deposit`, `withdraw`, `bet_lock`, `bet_win`, `bet_refund`); `metadata` pode ter `asaas_payment_id` ou `withdrawal_id`.
- **pix_deposits:** associa `asaas_payment_id` ao `user_id` e guarda `amount`, `status` (pending/completed/failed) para o webhook creditar o saldo.
- **withdrawals:** `user_id`, `amount`, `status` (pending_review → approved → processing → completed/failed/cancelled), `pix_key`, `pix_key_type`, `asaas_transfer_id`, `failure_reason`, `scheduled_after`.

RPCs usadas:

- `increment_wallet_balance(p_user_id, p_amount)`: credita saldo (chamada pelo webhook de depósito).
- `request_withdrawal_atomic(p_user_id, p_amount, p_pix_key, p_pix_key_type, p_scheduled_after)`: debita saldo, insere withdrawal e transaction em uma transação atômica.

---

## 4. Depósito PIX

### 4.1 Fluxo

1. Usuário logado abre a carteira e clica em “Depositar”.
2. Frontend chama a Edge Function `create-pix-deposit` com `{ amount }` e envia `Authorization: Bearer <access_token>` (e opcionalmente `apikey`).
3. **create-pix-deposit:**
   - Valida JWT com `getUser()`.
   - Valida valor (ex.: entre 5 e 5000).
   - Garante que o perfil tem CPF ou CNPJ (obrigatório no Asaas para cobrança).
   - Cria ou recupera **Customer** no Asaas (`externalReference = user_id`).
   - Atualiza o customer com `cpfCnpj` se necessário.
   - Cria **Payment** no Asaas (`billingType: "PIX"`, valor, data de vencimento, descrição).
   - Obtém **QR Code PIX** do pagamento (`GET /payments/:id/pixQrCode`).
   - Insere em `pix_deposits` (user_id, asaas_payment_id, amount, status pending) e em `transactions` (type deposit, status pending, metadata com asaas_payment_id).
   - Retorna ao frontend: `paymentId`, `qrCodeBase64`, `payload` (copia e cola).
4. Usuário paga o PIX no app do banco.
5. Asaas envia **webhook** para `asaas-webhook` com evento `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` e dados do pagamento.
6. **asaas-webhook:**
   - Opcionalmente valida o token no header `asaas-access-token` com `ASAAS_WEBHOOK_SECRET`.
   - Se evento não for de confirmação/recebimento, responde 200 e encerra.
   - Busca em `pix_deposits` por `asaas_payment_id`. Se não existir ou já estiver completed, responde 200 (idempotente).
   - Chama `increment_wallet_balance(user_id, amount)`.
   - Atualiza `pix_deposits` para status completed.
   - Atualiza a `transactions` de depósito correspondente para completed.
   - Responde 200.

### 4.2 Arquivos principais

- Edge Function: `supabase/functions/create-pix-deposit/index.ts`
- Webhook: `supabase/functions/asaas-webhook/index.ts`
- RPC: `supabase/migrations/04_increment_wallet_balance_rpc.sql`
- Tabelas: `supabase/migrations/03_create_wallet_system.sql` (wallets, transactions, pix_deposits)

### 4.3 Chamada do frontend

- `src/pages/Wallet.tsx`: usa `invokeEdgeFunction(session, "create-pix-deposit", { amount })`.
- `src/lib/edgeFunctionAuth.ts`: `invokeEdgeFunction` envia POST com `Authorization: Bearer <access_token>` e `apikey: VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## 5. Saque PIX

### 5.1 Fluxo resumido

1. Usuário informa valor e chave PIX (tipo: CPF, CNPJ, e-mail, telefone ou EVP).
2. Frontend chama `request-withdrawal` com `{ amount, pixKey, pixKeyType }`.
3. **request-withdrawal** valida JWT, valor e chave; chama a RPC `request_withdrawal_atomic`, que debita o saldo e cria o registro em `withdrawals` e em `transactions`.
4. Opcionalmente o frontend chama `process-my-withdrawals` para processar na hora os saques aprovados daquele usuário.
5. **process-withdrawal** (cron) ou **process-my-withdrawals** (usuário) pega saques com status `approved`, sem `asaas_transfer_id`, atualiza para `processing`, monta o payload PIX (chave normalizada) e chama `POST /transfers` no Asaas.
6. O Asaas, após criar a transferência, chama a URL de **autorização externa** (`asaas-withdraw-validate`). Essa função deve responder **200** com `{ "status": "APPROVED" }` (ou `REFUSED` com `refuseReason`). Se retornar 401/404/500 ou falhar 3 vezes, o Asaas cancela a transferência.
7. Se a transferência for concluída, atualizamos o withdrawal para `completed` e a transaction para `completed`. Se falhar, chamamos `refundWithdrawal` (devolve saldo, marca withdrawal como failed com `failure_reason`, transaction como cancelled).
8. **sync-failed-withdrawals** (cron) consulta no Asaas as transferências que temos como completed; se alguma estiver FAILED/CANCELLED no Asaas, faz o estorno e atualiza `failure_reason`.

### 5.2 Normalização da chave PIX (Asaas)

- CPF: apenas dígitos, 11.
- CNPJ: apenas dígitos, 14.
- Telefone: apenas dígitos; se 10 dígitos (DDD + 8), inserir o 9 no meio (ex.: 1199999999 → 11999999999) para 11 dígitos.
- E-mail: trim e formato válido.
- EVP: trim (enviar como está).

A normalização é feita em `process-withdrawal` e `process-my-withdrawals` antes de montar o payload; a validação de formato é feita em `request-withdrawal` antes de criar o saque.

### 5.3 Autorização externa (asaas-withdraw-validate)

- O Asaas envia POST com body `{ "type": "TRANSFER", "transfer": { "id", "value", "description", ... } }`.
- A função **não** pode exigir JWT do Supabase (config: `verify_jwt = false`). Pode opcionalmente validar o header `asaas-access-token` com o secret `ASAAS_WITHDRAW_VALIDATE_TOKEN`.
- Lógica de aprovação:
  - Se existir withdrawal com `asaas_transfer_id = transfer.id` → retornar `{ "status": "APPROVED" }`.
  - Senão, buscar withdrawal com status em (`processing`, `approved`), `asaas_transfer_id` nulo, valor dentro de uma faixa (tolerância para decimal) e descrição contendo “Saque ChessBet”. Se encontrar, atualizar `asaas_transfer_id` e retornar `APPROVED`.
  - Caso contrário, retornar `{ "status": "REFUSED", "refuseReason": "..." }`.
- **Sempre** responder com status HTTP 200 (para o Asaas não tratar como falha de comunicação). Aprovação/recusa é pelo body.

### 5.4 Arquivos principais

- Solicitar saque: `supabase/functions/request-withdrawal/index.ts`
- RPC atômica: `supabase/migrations/06_request_withdrawal_atomic_rpc.sql` (e ajustes em `13_fix_request_withdrawal_atomic_transaction_status.sql` se houver)
- Processar (cron): `supabase/functions/process-withdrawal/index.ts`
- Processar (usuário): `supabase/functions/process-my-withdrawals/index.ts`
- Autorização externa: `supabase/functions/asaas-withdraw-validate/index.ts`
- Sincronizar falhas: `supabase/functions/sync-failed-withdrawals/index.ts`
- Cancelar saque: `supabase/functions/cancel-withdrawal/index.ts`
- Config: `supabase/config.toml` (incluir `[functions.asaas-withdraw-validate]` com `verify_jwt = false`)

### 5.5 Chamadas do frontend

- Solicitar: `invokeEdgeFunction(session, "request-withdrawal", { amount, pixKey, pixKeyType })`.
- Processar na hora: `invokeEdgeFunction(session, "process-my-withdrawals", {})`.
- Cancelar: `invokeEdgeFunction(session, "cancel-withdrawal", { withdrawalId })`.

---

## 6. Cron jobs (recomendado)

- **process-withdrawal:** executar periodicamente (ex.: a cada 5–15 min) com `Authorization: Bearer <CRON_SECRET>` para processar saques aprovados pendentes.
- **sync-failed-withdrawals:** executar periodicamente (ex.: 1x por hora) com o mesmo `CRON_SECRET` para verificar no Asaas as transferências que estão como completed e estornar as que falharam/cancelaram no Asaas.

URLs:

- `POST https://<PROJECT_REF>.supabase.co/functions/v1/process-withdrawal`
- `POST https://<PROJECT_REF>.supabase.co/functions/v1/sync-failed-withdrawals`

Header: `Authorization: Bearer <CRON_SECRET>`.

---

## 7. Checklist para replicar

1. **Asaas:** criar conta; obter API Key (produção ou sandbox); configurar webhook de cobrança (URL da função `asaas-webhook`); configurar autorização externa de saque (URL da função `asaas-withdraw-validate`).
2. **Supabase:** criar projeto; rodar migrations (wallet, transactions, pix_deposits, withdrawals, RPCs `increment_wallet_balance` e `request_withdrawal_atomic`); criar secrets (ASAAS_API_KEY, opcionalmente ASAAS_BASE_URL, ASAAS_WEBHOOK_SECRET, ASAAS_WITHDRAW_VALIDATE_TOKEN, CRON_SECRET).
3. **Edge Functions:** deploy de `create-pix-deposit`, `asaas-webhook`, `request-withdrawal`, `process-withdrawal`, `process-my-withdrawals`, `asaas-withdraw-validate`, `sync-failed-withdrawals`, `cancel-withdrawal`; configurar `supabase/config.toml` com `verify_jwt = false` onde indicado (em especial para `asaas-webhook` e `asaas-withdraw-validate`).
4. **Frontend:** variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; chamar as funções com o token da sessão (e anon key se usar `invokeEdgeFunction` como no projeto).
5. **Cron:** agendar chamadas a `process-withdrawal` e `sync-failed-withdrawals` com `CRON_SECRET`.

Com isso, depósito (QR PIX + webhook) e saque (solicitação + processamento + autorização externa + estorno em caso de falha) ficam replicáveis de forma consistente.
