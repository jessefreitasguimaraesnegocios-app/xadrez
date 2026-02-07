/**
 * Chamado pelo Vercel Cron (1x/dia no Hobby) ou pelo GitHub Actions (a cada 1 min no workflow). Dispara a Edge Function process-withdrawal no Supabase.
 * Repassa CRON_SECRET para o Supabase. Configure CRON_SECRET na Vercel (env) e no Supabase (secrets).
 */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: { method?: string }, res: { status: (n: number) => { json: (d: unknown) => void } }) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!CRON_SECRET) {
    return res.status(500).json({ error: "CRON_SECRET not configured in Vercel env" });
  }

  if (!SUPABASE_URL) {
    return res.status(500).json({ error: "VITE_SUPABASE_URL or SUPABASE_URL not configured in Vercel env" });
  }

  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/process-withdrawal`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    return res.status(response.status).json({ error: "process-withdrawal failed", detail: data });
  }

  return res.status(200).json(data);
}
