# Verificação: conformidade com o modelo Fintech (custódia + comissão)

Este documento compara o que está implementado hoje com o modelo de **custódia de terceiros + comissão da plataforma** (PIX/Asaas, ledger, KYC, antifraude).

---

## Resumo executivo

| Aspecto | Status | Observação |
|--------|--------|------------|
| Regras de negócio (custódia, 20%) | Parcial | 20% aplicado; falta separação explícita da comissão |
| Arquitetura backend | Diverge | Edge Functions (Deno), não Node.js |
| Modelagem (tabelas) | Parcial | Falta `platform_commission`, `wallet_ledger` imutável, KYC em users |
| Fluxo depósito PIX | Em acordo | Cobrança Asaas → webhook → crédito → registro |
| Fluxo aposta | Parcial | Lock, 80% vencedor; sem registro de COMMISSION no ledger |
| Fluxo saque | Parcial | Sem ANALYSIS por valor, sem KYC, sem cooldown por valor |
| KYC por valor | Não implementado | Sem `kyc_status`, sem faixas R$ 500 / R$ 2.000 |
| Antifraude | Não implementado | Sem CPF, device, IP, limite de contas |
| Relatórios | Não implementado | Sem total custódia, comissão, taxas Asaas |

---

## 1. Regras de negócio (OBRIGATÓRIAS)

| Regra | Implementado? | Detalhe |
|-------|----------------|--------|
| Dinheiro depositado pertence ao usuário (custódia) | Sim | Saldo em `wallets` por usuário; só usuário saca seu saldo. |
| Plataforma é intermediadora | Sim | Nenhum saldo de usuário é usado como “receita” da plataforma. |
| Plataforma cobra 20% por partida | Sim | `finish-game`: winner recebe 80% do pote (`HOUSE_CUT_PCT = 0.2`). |
| Apenas a comissão é receita da plataforma | Parcial | A comissão é aplicada (20% retida), mas **não existe tabela/contabilidade** que separe “receita da plataforma” do saldo dos usuários. |
| Saldo do usuário nunca misturado com comissão | Sim | Comissão não é creditada em wallet de usuário; não há “conta plataforma” no mesmo modelo de wallet do usuário. |
| Saques com segurança e antifraude | Parcial | Validação de valor e saldo; **não há** ANALYSIS por valor, KYC, cooldown, nem regras explícitas de antifraude. |

---

## 2. Arquitetura geral

| Requisito | Implementado? | Detalhe |
|-----------|----------------|--------|
| Backend Node.js + TypeScript | Não | Backend é **Supabase Edge Functions (Deno)** + TypeScript. |
| Banco Postgres | Sim | Supabase Postgres. |
| Integração Asaas | Sim | Cobrança PIX, transferência (saque), webhook de pagamento. |
| Webhook PIX recebido | Sim | `asaas-webhook` para pagamento confirmado. |
| Webhook PIX enviado | Não | Não há tratamento de webhook/callback do Asaas para **transferência/saque** concluído. |
| Wallet por usuário | Sim | Tabela `wallets` (balance_available, balance_locked). |
| Ledger imutável | Parcial | Tabela `transactions`; **há UPDATE** (pending → completed) no depósito. O spec pede “NUNCA ATUALIZAR, APENAS INSERIR”. |

---

## 3. Modelagem de dados

### 3.1 users / profiles

| Campo spec (users) | No projeto | Observação |
|-------------------|------------|------------|
| id | profiles.id + user_id (auth.users) | Ok. |
| nome | display_name, username | Ok. |
| cpf | Não existe | **Falta** para KYC e antifraude. |
| email | Em auth.users (não em profiles) | Usado no fluxo; não está em tabela de “users” explícita. |
| kyc_status (NONE \| BASIC \| VERIFIED) | Não existe | **Falta** para regras de saque por faixa. |
| created_at | created_at | Ok. |

### 3.2 wallets

| Campo spec | No projeto | Observação |
|------------|------------|------------|
| id, user_id, balance_available, balance_locked, created_at | Sim | Alinhado. Há também `updated_at`. |

### 3.3 wallet_ledger (ledger imutável)

| Campo spec | No projeto (tabela `transactions`) | Observação |
|------------|-------------------------------------|------------|
| wallet_id | user_id | Spec usa wallet_id; projeto usa user_id. Equivalente funcional. |
| type (DEPOSIT \| BET \| WIN \| LOSS \| COMMISSION \| WITHDRAW) | deposit, bet_lock, bet_win, bet_refund, withdraw | **Falta** tipo COMMISSION; LOSS pode ser representado por bet_refund 0 ou tipo específico. |
| amount | amount | Ok. |
| reference_id | metadata (JSON) | Spec pede reference_id explícito; temos game_id, withdrawal_id etc. em metadata. |
| “NUNCA ATUALIZAR, APENAS INSERIR” | UPDATE usado (pending → completed) | **Diverge**: spec exige ledger só INSERT. |

### 3.4 platform_commission

| Spec | No projeto | Observação |
|------|------------|------------|
| id, amount, origin_match_id, created_at, withdrawn | **Não existe** | **Falta** tabela para registrar a comissão de cada partida e se já foi “sacada” pela plataforma. |

### 3.5 matches / games

| Campo spec (matches) | No projeto (games) | Observação |
|----------------------|--------------------|------------|
| player_a_id, player_b_id | white_player_id, black_player_id | Ok. |
| bet_amount | bet_amount | Ok. |
| winner_id | Não existe | Resultado é `result` (white_wins / black_wins / draw). winner_id pode ser derivado. |
| platform_fee (20%) | Não existe coluna | Valor é implícito no código; **não persistido** na partida nem em platform_commission. |
| status | status | Ok. |

### 3.6 withdrawals

| Spec (status) | No projeto | Observação |
|---------------|------------|------------|
| PENDING \| ANALYSIS \| APPROVED \| PAID \| BLOCKED | pending_review, approved, processing, completed, failed, cancelled | Nomes diferentes; **falta ANALYSIS** (análise manual/antifraude) e **BLOCKED** explícito. |

---

## 4. Fluxos

### 4.1 Depósito PIX

- Solicitação → criação de cobrança no Asaas → webhook confirma → crédito na wallet → registro no ledger.  
- **Em acordo** com o spec.  
- Único ponto: ledger hoje usa UPDATE (pending → completed); spec pede apenas INSERT.

### 4.2 Aposta

- Verificação de saldo, lock (balance_locked), criação da partida, ao finalizar: desbloqueio, 80% ao vencedor, 20% “retidos” (não vão para nenhuma wallet).  
- **Falta:**  
  - Registro no ledger do tipo **COMMISSION** (ou equivalente) para a comissão.  
  - Inserção na tabela **platform_commission** (amount, origin_match_id, withdrawn).

### 4.3 Saque

- Saque apenas do saldo disponível, criação de withdrawal, processamento via Asaas.  
- **Falta:**  
  - Faixas por valor (ex.: acima de X → ANALYSIS).  
  - Cooldown/trava temporal configurável.  
  - Regra “plataforma só saca valores de platform_commission” (hoje a plataforma não tem fluxo de “saque próprio”; usuários sacam da própria wallet).

---

## 5. KYC por valor

| Regra spec | No projeto |
|------------|------------|
| Até R$ 500 → sem KYC | Não implementado (sem kyc_status). |
| R$ 500 a R$ 2.000 → KYC básico | Não implementado. |
| Acima de R$ 2.000 → KYC completo | Não implementado. |
| Bloquear saque se KYC incompatível | Não implementado. |

---

## 6. Antifraude

| Item spec | No projeto |
|-----------|------------|
| Limite de contas por CPF | Não (nem CPF em profiles). |
| Device fingerprint | Não. |
| IP logging | Não. |
| Bloqueio de múltiplas contas | Não. |
| Logs imutáveis | Parcial (transactions; mas com UPDATE em um caso). |

---

## 7. Relatórios

| Relatório spec | No projeto |
|----------------|------------|
| Total depositado (custódia) | Não implementado. |
| Total sacado | Não implementado. |
| Saldo total dos usuários | Não implementado (dados existem em DB, sem API/relatório). |
| Comissão da plataforma | Não (falta platform_commission). |
| Taxas Asaas | Não. |
| Relatório mensal | Não. |

---

## 8. Pontos críticos do spec

| Regra | Status |
|-------|--------|
| Nunca considerar depósitos como faturamento | Respeitado (depósitos só aumentam custódia). |
| Nunca permitir saque de saldo de terceiros pela plataforma | Respeitado (saque só do próprio user_id). |
| Toda movimentação deve gerar registro no ledger | Parcial: falta registro explícito de COMMISSION e ledger 100% append-only. |

---

## 9. O que falta para ficar em acordo com o spec

1. **Modelagem / schema**  
   - Tabela **platform_commission** (amount, origin_match_id, created_at, withdrawn).  
   - Em **games**: coluna **platform_fee** e **winner_id** (ou equivalente).  
   - Em **profiles** (ou “users”): **cpf**, **kyc_status** (NONE \| BASIC \| VERIFIED).  
   - **Ledger imutável**: trocar UPDATE por segundo INSERT (ex.: DEPOSIT confirmado = novo registro completed) ou proibir UPDATE em `transactions` e ajustar fluxo de depósito.  
   - **withdrawals**: incluir status ANALYSIS e BLOCKED; alinhar nomes ao spec se desejado.

2. **Fluxo de partida**  
   - Ao finalizar partida com aposta: inserir linha em **platform_commission** e, se houver ledger separado por tipo, registro tipo **COMMISSION** (ou equivalente).

3. **Saque**  
   - Regras por valor (ex.: acima de X → status ANALYSIS).  
   - Cooldown/trava temporal.  
   - Validação de **kyc_status** conforme faixa (500 / 2.000).

4. **KYC**  
   - Campos e fluxo de atualização de kyc_status; bloqueio de saque quando KYC incompatível com o valor.

5. **Antifraude**  
   - CPF em usuário, limite de contas por CPF, device fingerprint, IP, logs, bloqueio de múltiplas contas (conforme política).

6. **Relatórios**  
   - APIs ou jobs para totais de custódia, saques, comissão, saldos e, se aplicável, taxas e mensal.

7. **Backend**  
   - O spec pede Node.js; o projeto usa Edge Functions (Deno). Para “estar em acordo” estrito seria preciso migrar ou documentar que a escolha de runtime é Edge Functions em vez de Node.js.

---

## 10. Conclusão

O projeto **já atende** à ideia de custódia (dinheiro do usuário na wallet dele), à atuação da plataforma como intermediária e à aplicação dos **20% de comissão** na partida.  
Para ficar **totalmente em acordo** com o modelo fintech descrito (incluindo contabilidade explícita da comissão, ledger imutável, KYC por valor, antifraude e relatórios), é necessário implementar os itens listados na seção 9.

Se quiser, posso propor um **plano de implementação em etapas** (schema, fluxos, KYC, antifraude, relatórios) ou esboçar as mudanças de schema SQL e serviços primeiro.
