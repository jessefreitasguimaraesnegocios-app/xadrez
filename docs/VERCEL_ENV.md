# Variáveis de ambiente na Vercel

Configure em **Project → Settings → Environment Variables**.

| Nome | Obrigatório | Descrição |
|------|-------------|-----------|
| `VITE_SUPABASE_URL` | Sim | URL do projeto. Ex: `https://SEU_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sim | Chave **anon/public** do Supabase (Dashboard → Settings → API) |
| `VITE_SUPABASE_PROJECT_ID` | Não | Ref do projeto (ex: `wzairrwkccneltkhgztx`). Só se o app usar. |
| `CRON_SECRET` | Sim (para cron de saques) | Mesmo valor configurado no Supabase (Edge Functions → Secrets). O cron chama `/api/process-withdrawal`, que usa esse token para chamar a Edge Function `process-withdrawal`. |

**Resumo:** para o app: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Para processar saques automaticamente: também `CRON_SECRET` (igual ao secret do Supabase).

Valores iguais aos do seu `.env` local. Não coloque a **service_role** no front (Vercel); ela fica só no Supabase (Edge Functions / backend).
