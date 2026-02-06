# O que o código precisa para o depósito PIX funcionar

Guia objetivo do que precisa existir no projeto para o fluxo **Depositar via PIX** (gerar QR Code, salvar na tabela, webhook creditar depois).

---

## 1. Visão geral do fluxo

1. **Front (Wallet):** usuário informa valor → checa sessão e token → chama a Edge Function com **dois headers** (veja abaixo).
2. **Edge Function (create-pix-deposit):** valida JWT → busca/ cria cliente no Asaas → cria cobrança PIX → gera QR Code → salva em `pix_deposits` e `transactions` → devolve QR + payload.
3. **Webhook (asaas-webhook):** quando o PIX é pago, Asaas chama a função → você credita o saldo na `wallets` e atualiza `pix_deposits` / `transactions`.

Este doc foca no **depósito em si** (passos 1 e 2). O webhook está em `CONFIGURACAO_SUPABASE_ASAAS.md`.

---

## 2. Frontend: o que precisa ter

### 2.1 Variáveis de ambiente (`.env`)

O front **precisa** destas variáveis para chamar a Edge Function:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...   # anon key do projeto
```

- **VITE_SUPABASE_URL** — URL do projeto (sem barra no final).
- **VITE_SUPABASE_PUBLISHABLE_KEY** — mesma **anon key** que você usa no `createClient` do Supabase (no Supabase Dashboard: Settings → API → anon public).

Sem essas duas, a URL da função ou o header `apikey` ficam errados e você pode levar 401.

---

### 2.2 Regra de ouro: dois headers no fetch

Quando você chama a Edge Function com **fetch manual** (em vez de `supabase.functions.invoke`), o Supabase exige **dois** headers:

| Header            | Valor                    | Obrigatório |
|-------------------|--------------------------|-------------|
| `Authorization`   | `Bearer <access_token>`  | Sim         |
| `apikey`          | `<SUPABASE_ANON_KEY>`   | Sim         |

- **Sem `Authorization`** → 401 (não sabe quem é o usuário).
- **Sem `apikey`** → 401 (Supabase bloqueia antes da sua função rodar).

No código isso fica assim (exemplo em `edgeFunctionAuth.ts`):

```ts
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY,
  },
  body: JSON.stringify(body),
});
```

Ou seja: **sempre** que for fetch manual para Edge Function: `Authorization: Bearer <JWT>` **e** `apikey: <anon key>`.

---

### 2.3 Arquivo `src/lib/edgeFunctionAuth.ts`

Este arquivo centraliza a chamada à Edge Function com fetch. Ele **precisa**:

1. **Ler do ambiente:**  
   - `VITE_SUPABASE_URL`  
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) para o header `apikey`.

2. **Função `invokeEdgeFunction(session, name, body)`:**
   - Receber uma **sessão** que tenha `access_token`.
   - Se não houver `session.access_token`, retornar erro (não chamar a função).
   - Montar a URL: `{SUPABASE_URL}/functions/v1/{name}`.
   - Fazer **POST** com:
     - `Content-Type: application/json`
     - `Authorization: Bearer ${session.access_token}`
     - `apikey: <anon key>`
   - Body: `JSON.stringify(body)`.

3. **Retorno:** tratar resposta (text/JSON), status não-ok → retornar `{ data, error }`.

Resumo: **sessão com token** + **URL do projeto** + **dois headers (Authorization + apikey)**.

---

### 2.4 Página / handler do depósito (ex.: `Wallet.tsx`)

No handler do botão “Gerar QR Code PIX” (ex.: `handleDeposit`), o fluxo **precisa** ser algo assim:

1. **Validar valor** (ex.: entre 5 e 5000).
2. **Garantir que há sessão:**
   - `await supabase.auth.getSession()`.
   - Se `!session?.access_token` → mostrar “Usuário não autenticado” e redirecionar para login (ex.: `/auth`).
3. **Atualizar o token (recomendado):**
   - `await supabase.auth.refreshSession()`.
   - Se der erro ou não vier `access_token` → fazer `signOut()`, mostrar “Sessão expirada” e redirecionar para login.
4. **Chamar a Edge Function** com a sessão **atualizada**:
   - `invokeEdgeFunction(refreshed, "create-pix-deposit", { amount })`.
5. **Tratar resposta:**
   - Se `error` ou `data.error` → mostrar erro.
   - Se sucesso → usar `data.qrCodeBase64`, `data.payload`, `data.paymentId` para exibir o QR e o “copia e cola”.

Por que **getSession** + **refreshSession** + **refreshed**?

- **getSession()** — evita chamar a função sem nenhum token.
- **refreshSession()** — reduz chance de enviar JWT expirado (menos 401).
- Usar **refreshed** no `invokeEdgeFunction` garante que o header `Authorization` vai com o token mais recente.

---

## 3. Edge Function: o que precisa ter

### 3.1 Nome e entrada

- **Nome:** por exemplo `create-pix-deposit`.
- **Método:** POST.
- **Body (JSON):** pelo menos `amount` (número, ex.: 10 para R$ 10,00).

---

### 3.2 Autenticação (evitar 401)

A função **não** deve confiar em “quem está logado” sem validar o JWT. Ela **precisa**:

1. **Ler o header**  
   `const authHeader = req.headers.get("authorization")`.

2. **Exigir Bearer**  
   Se não existir ou não começar com `"bearer "` → retornar 401.

3. **Validar o JWT e obter o usuário**  
   - Criar um cliente Supabase com a **anon key** e **o mesmo header** `Authorization` da requisição.  
   - Chamar `auth.getUser()` **sem** argumentos (o client usa o header).  
   - Se `getUser()` retornar erro ou usuário null → 401.

4. **Usar apenas o resultado de `getUser()`**  
   - `user.id` (e, se precisar, `user.email`) para o resto da função.  
   - Não usar refresh token nem lógica de “sessão” no front dentro da Edge.

Assim, 401 só acontece se o **front** não mandar `Authorization: Bearer <JWT>` válido ou se o **Supabase** não aceitar o request (por exemplo, sem `apikey` no front).

---

### 3.3 Asaas (API e URLs)

A função usa a API do Asaas para:

- Criar/buscar **customer** (por `externalReference` = `user.id`).
- Criar **payment** (cobrança PIX).
- Obter **QR Code** (`/payments/{id}/pixQrCode`).

Para isso, a Edge Function **precisa** de:

- **Variáveis de ambiente (Secrets no Supabase):**
  - `ASAAS_API_KEY` — obrigatório.
  - `ASAAS_BASE_URL` — opcional; se não definir, usar default com **path já incluso**, por exemplo:
  - Default recomendado: `https://api.asaas.com/v3` (produção) ou a URL do sandbox que já inclua o path da API v3.

- **Chamadas à API Asaas:**
  - Base sem duplicar path: ex. `ASAAS_BASE_URL = https://api.asaas.com/v3`.
  - Endpoints:  
    - `${asaasBaseUrl}/customers`  
    - `${asaasBaseUrl}/payments`  
    - `${asaasBaseUrl}/payments/${paymentId}/pixQrCode`  
  (ou seja, **não** colocar `/api/v3` de novo na URL se a base já for `.../v3`).

- **Headers em toda requisição ao Asaas:**
  - `Content-Type: application/json`
  - `access_token: <ASAAS_API_KEY>`
  - `User-Agent: ChessBet/1.0` (recomendado pelo Asaas).

Detalhes de conta sandbox, webhook e variáveis estão em `CONFIGURACAO_SUPABASE_ASAAS.md`.

---

### 3.4 Banco (Supabase) dentro da função

Depois de criar o pagamento no Asaas, a função **precisa**:

1. **Inserir em `pix_deposits`**  
   - `user_id`, `asaas_payment_id`, `amount`, `status: "pending"`.

2. **Inserir em `transactions`**  
   - `user_id`, `type: "deposit"`, `amount`, `status: "pending"`, `metadata` (ex.: `asaas_payment_id`).

Para isso, a função usa um client Supabase com **service_role** (admin), não o client que valida o JWT. As tabelas `pix_deposits` e `transactions` precisam existir (migrations abaixo).

---

## 4. Banco de dados (migrations)

Para o depósito e o webhook funcionarem, o projeto **precisa** das migrations que criam:

- **`wallets`** — saldo do usuário (creditado pelo webhook).
- **`transactions`** — histórico (depósito fica como `type: 'deposit'`, status atualizado pelo webhook).
- **`pix_deposits`** — vínculo `user_id` + `asaas_payment_id` + `amount` + `status` (atualizado pelo webhook quando o PIX for pago).

Isso está na migration **03_create_wallet_system.sql**. A migration **04_increment_wallet_balance_rpc.sql** define a RPC que o webhook usa para creditar o saldo de forma atômica.

Ordem: rodar 01 → 02 → 03 → 04 (conforme já usado no projeto).

---

## 5. Checklist rápido: depósito funcionando

- [ ] **.env** do front tem `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [ ] **edgeFunctionAuth** envia **Authorization: Bearer &lt;token&gt;** e **apikey: &lt;anon key&gt;** em todo fetch para Edge Function.
- [ ] **Wallet** (ou tela de depósito): usa **getSession** → **refreshSession** → chama **invokeEdgeFunction(refreshed, "create-pix-deposit", { amount })**.
- [ ] **create-pix-deposit**: valida header `Authorization`, usa anon client + `getUser()` para obter `user`, usa **service_role** para `profiles` / `pix_deposits` / `transactions`.
- [ ] **create-pix-deposit**: tem secrets **ASAAS_API_KEY** e (opcional) **ASAAS_BASE_URL**; usa base com path v3 e headers Asaas (`access_token`, `User-Agent`).
- [ ] **Migrations** 03 e 04 aplicadas no projeto Supabase.
- [ ] **Edge Function** `create-pix-deposit` **deployada** após qualquer mudança (`supabase functions deploy create-pix-deposit`).

Se algo der 401: confira primeiro se o **front** está mandando os **dois** headers (Authorization + apikey) e se a função foi **redeployada**.

---

## 6. Resumo em uma frase

**Para o depósito PIX funcionar, o código precisa: no front, sessão válida + fetch com `Authorization: Bearer <JWT>` e `apikey: <anon key>`; na Edge Function, validar esse JWT com `getUser()`, chamar a API Asaas com a base URL e headers corretos, e gravar em `pix_deposits` e `transactions`; no Supabase, migrations do sistema de carteira e deploy da função.**

Para configuração detalhada do Asaas e webhook, use o arquivo **`CONFIGURACAO_SUPABASE_ASAAS.md`**.
