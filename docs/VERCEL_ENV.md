# Variáveis de ambiente na Vercel

Configure em **Project → Settings → Environment Variables**.

| Nome | Obrigatório | Descrição |
|------|-------------|-----------|
| `VITE_SUPABASE_URL` | Sim | URL do projeto. Ex: `https://SEU_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sim | Chave **anon/public** do Supabase (Dashboard → Settings → API) |
| `VITE_SUPABASE_PROJECT_ID` | Não | Ref do projeto (ex: `wzairrwkccneltkhgztx`). Só se o app usar. |

**Resumo:** só precisa de **2** no deploy: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

Valores iguais aos do seu `.env` local. Não coloque a **service_role** no front (Vercel); ela fica só no Supabase (Edge Functions / backend).
