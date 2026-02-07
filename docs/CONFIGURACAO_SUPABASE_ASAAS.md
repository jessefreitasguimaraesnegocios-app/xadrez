# Configuração: Supabase + Asaas (PIX / Carteira)

Passo a passo direto do que configurar e onde colocar cada chave.

---

## 1. Supabase

### 1.1 Rodar as migrations

**Onde:** no seu projeto Supabase (local ou remoto).

**Como:**

- **Remoto (Supabase Cloud):**  
  - Acesse [supabase.com](https://supabase.com) → seu projeto → **SQL Editor**.  
  - Rode na ordem os arquivos da pasta `supabase/migrations/`:  
    `01_create_profiles_games_friendships_tournaments.sql` → `02_create_storage_avatars.sql` → `03_create_wallet_system.sql`.  
  - Ou use o CLI: `supabase db push` (com o projeto linkado).

- **Local:**  
  - No terminal: `supabase start` (se ainda não estiver rodando).  
  - Depois: `supabase db reset` ou `supabase migration up` para aplicar as migrations.

### 1.2 Secrets das Edge Functions

**Onde:** Dashboard do Supabase → seu projeto → **Project Settings** (ícone de engrenagem) → **Edge Functions** → seção **Secrets**.

**O que adicionar:**

| Nome do secret | Obrigatório | Descrição |
|----------------|-------------|-----------|
| `ASAAS_API_KEY` | Sim | Chave da API do Asaas (ver seção Asaas abaixo). |
| `ASAAS_BASE_URL` | Não | URL base da API. Se não definir, usa sandbox. Valores: `https://sandbox.asaas.com` (teste) ou `https://api.asaas.com` (produção). |
| `ASAAS_WEBHOOK_SECRET` | Recomendado | Token que você define no Asaas para o webhook; usado para validar que o POST veio do Asaas. |
| `CRON_SECRET` | Não | Se você chamar `process-withdrawal` por cron, use um token forte aqui e envie no header `Authorization: Bearer <CRON_SECRET>`. |

**Não precisa criar:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` — o Supabase já injeta esses nas Edge Functions.

**Como cadastrar cada um:** em **Edge Functions → Secrets**, clique em **Add new secret**, coloque o **Name** (ex.: `ASAAS_API_KEY`) e o **Value** (a chave/token).

---

## 2. Asaas

### 2.1 Onde pegar a chave da API

1. Acesse [asaas.com](https://www.asaas.com) e entre na sua conta.
2. Menu **Integrações** → **API** (ou **Chave de API**).
3. Gere uma **nova chave** (ou use uma existente).
4. **Copie e guarde** — a chave só é exibida uma vez.

**Sandbox (teste):** use a conta e a chave do [sandbox.asaas.com](https://sandbox.asaas.com).

**Onde colocar:** no Supabase, no secret **`ASAAS_API_KEY`** (ver item 1.2 acima).

### 2.2 URL base da API (sandbox vs produção)

- **Teste:** `https://sandbox.asaas.com`  
- **Produção:** `https://api.asaas.com`  

**Onde colocar:** no Supabase, no secret **`ASAAS_BASE_URL`**. Se não criar esse secret, o código usa sandbox.

### 2.3 Webhook (confirmação de pagamento PIX)

O Asaas envia um POST para sua Edge Function quando o PIX é pago. Você precisa:

1. **URL do webhook**  
   Formato:  
   `https://<PROJECT_REF>.supabase.co/functions/v1/asaas-webhook`  
   Troque `<PROJECT_REF>` pelo ref do seu projeto (ex.: `pldldecribnutlpkietw`).  
   Exemplo: `https://pldldecribnutlpkietw.supabase.co/functions/v1/asaas-webhook`

2. **Onde configurar no Asaas**  
   - Asaas: **Integrações** → **Webhooks** (ou **Notificações**).  
   - Cadastre a URL acima.  
   - Defina um **token de segurança** (qualquer string secreta que só você conheça).  
   - Use esse **mesmo valor** no Supabase no secret **`ASAAS_WEBHOOK_SECRET`**.

3. **Eventos**  
   Marque pelo menos o evento de **pagamento confirmado** (ex.: “Pagamento confirmado” / “Payment confirmed”), para que o Asaas chame sua URL quando o PIX for pago.

---

## 3. Resumo: onde cada coisa fica

| O que | Onde pegar | Onde colocar |
|-------|------------|--------------|
| Chave API Asaas | Asaas → Integrações → API → Gerar/copiar chave | Supabase → Project Settings → Edge Functions → Secrets → `ASAAS_API_KEY` |
| URL base Asaas | Sandbox: `https://sandbox.asaas.com` / Produção: `https://api.asaas.com` | Supabase → Secrets → `ASAAS_BASE_URL` |
| Token do webhook | Você inventa uma string secreta no Asaas (ao configurar o webhook) | 1) Asaas: no cadastro do webhook. 2) Supabase: Secret `ASAAS_WEBHOOK_SECRET` |
| URL do webhook | Sua Edge Function: `https://<PROJECT_REF>.supabase.co/functions/v1/asaas-webhook` | Asaas → Webhooks → URL de notificação |
| Migrations | Arquivos em `supabase/migrations/` (01, 02, 03) | Rodar no Supabase (SQL Editor ou `supabase db push`) |

---

## 4. Deploy das Edge Functions

Para as funções (create-pix-deposit, asaas-webhook, request-withdrawal, process-withdrawal, create-match, finish-game) responderem em produção:

- **Supabase Cloud:**  
  `supabase functions deploy create-pix-deposit` (e o mesmo para cada nome de função), ou deploy de todas de uma vez conforme a documentação do CLI.

- Depois do deploy, use a URL base do projeto (ex.: `https://pldldecribnutlpkietw.supabase.co`) para montar a URL do webhook e qualquer chamada às funções.

---

## 5. Checklist rápido

- [ ] Migrations 01, 02 e 03 rodadas no Supabase  
- [ ] Secret `ASAAS_API_KEY` criado no Supabase (valor copiado do Asaas)  
- [ ] Secret `ASAAS_BASE_URL` definido (sandbox ou produção)  
- [ ] Webhook cadastrado no Asaas com a URL da `asaas-webhook`  
- [ ] Token do webhook definido no Asaas e repetido no secret `ASAAS_WEBHOOK_SECRET` no Supabase  
- [ ] Edge Functions deployadas  
- [ ] (Opcional) Secret `CRON_SECRET` e cron configurado para chamar `process-withdrawal`

Com isso, as configurações do Supabase, dos secrets e do Asaas ficam prontas para depósito PIX, webhook e saque.

---

## 7. Confirmação / processamento dos saques

Os saques ficam com status **Aguardando confirmação** (`pending_review`) até que a Edge Function **`process-withdrawal`** seja executada. Ela:

1. Aprova automaticamente os saques em que já passou o prazo de 24h (`scheduled_after`).
2. Envia a transferência PIX via Asaas para cada saque aprovado.
3. Atualiza status para `completed` ou `failed` e a transação na carteira.

**Duas formas de disparar o processamento (escolha uma ou use as duas):**

**A) GitHub Actions (recomendado, gratuito, a cada 1 min):**

- O workflow `.github/workflows/process-withdrawal.yml` roda **a cada 1 minuto** e chama a Edge Function no Supabase.
- **Configure o secret no GitHub:** no repositório → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** → nome **`CRON_SECRET`**, valor = **o mesmo** que está no Supabase (Edge Functions → Secrets). Sem esse secret, o workflow falha com 401.
- (Opcional) Se o projeto Supabase for outro, crie também o secret **`SUPABASE_URL`** com a URL base, ex.: `https://SEU_PROJECT_REF.supabase.co`.
- Para rodar à mão: **Actions** → **Process withdrawal (PIX)** → **Run workflow**.
- Para mudar a frequência: edite no arquivo o `cron`, ex.: `"0 2 * * *"` (1x/dia).

**B) Vercel (1x por dia no plano Hobby):**

- `vercel.json` está com `0 2 * * *` (uma vez por dia às 2h UTC) para o deploy não falhar no Hobby.
- Configure **`CRON_SECRET`** na Vercel (Environment Variables) com o mesmo valor do Supabase. A API `api/process-withdrawal.ts` repassa esse token para a Edge Function.

**Supabase:** o secret **`CRON_SECRET`** já foi criado com `npx supabase secrets set CRON_SECRET=<valor>`. Use esse mesmo valor no GitHub (e na Vercel, se usar o cron da Vercel).

Sem nenhum disparo (Actions ou Vercel) configurado, os saques ficam em "Aguardando confirmação" até alguém chamar `process-withdrawal` manualmente (Supabase Dashboard → Edge Functions → Invoke).

---

## 6. Webhook retorna 401 (Unauthorized / Invalid webhook token)

Se o Asaas mostrar **401** ou **"Invalid webhook token"** ao chamar a URL do webhook:

1. **No painel Asaas**  
   - Vá em **Integrações** → **Webhooks** (ou **Notificações**).  
   - Edite o webhook que aponta para `.../functions/v1/asaas-webhook`.  
   - Confira o campo **Token de acesso** / **Token de autenticação**: ele deve ser **exatamente igual** (mesma string, sem espaço no início/fim) ao secret no Supabase.

2. **No Supabase**  
   - **Project Settings** → **Edge Functions** → **Secrets**.  
   - O secret **`ASAAS_WEBHOOK_SECRET`** deve ter o **mesmo valor** que você colocou no Asaas.

3. **Depois de alterar**  
   - Salve nos dois lados.  
   - Não é necessário fazer redeploy da função; o secret é lido em toda requisição.  
   - O Asaas tentará de novo na próxima notificação (ou você pode reenviar/testar o webhook no painel do Asaas, se houver opção).
