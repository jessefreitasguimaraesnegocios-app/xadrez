# Supabase: tudo pelo CLI

Passo a passo para fazer **migrations**, **secrets** e **deploy das Edge Functions** só com o terminal. No Windows use PowerShell ou CMD.

---

## 1. Instalar o Supabase CLI

**Opção A – no projeto (já configurado):**  
O projeto já tem `supabase` em `devDependencies`. Use os scripts npm:

```bash
npm run supabase -- --version
npm run supabase:link
npm run supabase:push
npm run supabase:deploy
```

Ou, na pasta do projeto, use `npx supabase` no lugar de `supabase` nos exemplos abaixo.

**Opção B – Scoop (Windows):**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Opção C – Chocolatey (Windows):**
```bash
choco install supabase
```

Confirme a instalação:
```bash
supabase --version
# ou: npm run supabase -- --version
```

---

## 2. Login no Supabase (obrigatório antes de link/push/deploy)

Gere um **Access Token** em: https://supabase.com/dashboard/account/tokens  

No terminal (precisa ser um terminal interativo, ex.: PowerShell ou CMD abertos por você):

```bash
cd c:\Users\jesse\Desktop\xadrez
npx supabase login
```
Cole o token quando pedir.

**Ou** use o token direto (útil em CI ou sem TTY):
```bash
set SUPABASE_ACCESS_TOKEN=seu_token_aqui
npx supabase link --project-ref wzairrwkccneltkhgztx
```

---

## 3. Entrar na pasta do projeto

```bash
cd c:\Users\jesse\Desktop\xadrez
```
(ou o caminho onde está o projeto)

---

## 4. Vincular o projeto remoto (link)

O **project ref** está na URL do dashboard:  
`https://supabase.com/dashboard/project/XXXXX` → o `XXXXX` é o ref.  
No seu projeto também está em `supabase/config.toml` como `project_id`.

```bash
supabase link --project-ref wzairrwkccneltkhgztx
```
Troque `wzairrwkccneltkhgztx` pelo ref do seu projeto se for outro.

O CLI pode pedir a **senha do banco**. Ela está em:  
Dashboard → **Project Settings** → **Database** → **Database password**.  
Se quiser evitar o prompt (ex.: em script), use:
```bash
$env:SUPABASE_DB_PASSWORD = "sua_senha_do_banco"
supabase link --project-ref wzairrwkccneltkhgztx
```

---

## 5. Rodar as migrations no projeto remoto

Envia as migrations da pasta `supabase/migrations/` (01, 02, 03…) para o banco **já linkado**:

```bash
supabase db push --linked
```

Para só simular, sem aplicar:
```bash
supabase db push --linked --dry-run
```

Se aparecer que está “up to date”, as migrations já foram aplicadas.  
Se o histórico no remoto estiver diferente do local, pode ser necessário usar `supabase migration repair` (veja documentação).

---

## 6. Configurar secrets (Edge Functions)

Secrets são variáveis de ambiente das Edge Functions (ex.: chave Asaas).  
**Só funcionam depois do `supabase link`.**

**Um secret por vez:**
```bash
supabase secrets set ASAAS_API_KEY="sua_chave_asaas_aqui"
supabase secrets set ASAAS_BASE_URL="https://sandbox.asaas.com"
supabase secrets set ASAAS_WEBHOOK_SECRET="token_que_voce_definiu_no_asaas"
```

**Vários de uma vez:**
```bash
supabase secrets set ASAAS_API_KEY="xxx" ASAAS_BASE_URL="https://sandbox.asaas.com" ASAAS_WEBHOOK_SECRET="yyy"
```

**Opcional – process-withdrawal com cron:**
```bash
supabase secrets set CRON_SECRET="um_token_forte_aleatorio"
```

Listar secrets (não mostra os valores):
```bash
supabase secrets list
```

---

## 7. Deploy das Edge Functions

Com o projeto linkado, na pasta do projeto:

**Deploy de uma função:**
```bash
supabase functions deploy create-pix-deposit
supabase functions deploy asaas-webhook
supabase functions deploy request-withdrawal
supabase functions deploy process-withdrawal
supabase functions deploy create-match
supabase functions deploy finish-game
```

**Deploy de todas de uma vez:**
```bash
supabase functions deploy
```

(Isso faz deploy de todas as funções em `supabase/functions/`.)

---

## 8. Comandos úteis extras

**Ver status do projeto linkado:**
```bash
supabase status
```

**Comparar migrations locais vs remoto:**
```bash
supabase migration list --linked
```

**Gerar tipos TypeScript a partir do banco remoto:**
```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```
(Ajuste o caminho do arquivo se for outro.)

**Rodar Supabase localmente (Docker):**
```bash
supabase start
```
Depois, para aplicar as migrations no banco local:
```bash
supabase db reset
```

**Parar o ambiente local:**
```bash
supabase stop
```

---

## 9. Ordem recomendada (checklist)

1. [ ] Entrar na pasta: `cd c:\Users\jesse\Desktop\xadrez`
2. [ ] Login (no seu terminal): `npx supabase login` e colar o token
3. [ ] Link: `npm run supabase:link` ou `npx supabase link --project-ref wzairrwkccneltkhgztx` (senha do DB se pedir: Project Settings → Database)
4. [ ] Migrations: `npm run supabase:push` ou `npx supabase db push --linked`
5. [ ] Secrets: `npx supabase secrets set ASAAS_API_KEY="..." ASAAS_BASE_URL="..." ASAAS_WEBHOOK_SECRET="..."`
6. [ ] Deploy das funções: `npm run supabase:deploy` ou `npx supabase functions deploy`

Depois disso, o banco estará com o schema das migrations 01, 02 e 03; as Edge Functions estarão no ar; e os secrets estarão disponíveis para elas. A URL do webhook do Asaas será:
`https://SEU_PROJECT_REF.supabase.co/functions/v1/asaas-webhook`
