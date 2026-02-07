/**
 * Header Authorization para chamadas a Edge Functions.
 * Usa o access_token da sessão; NUNCA use anon key para funções que exigem usuário logado.
 */
export function getEdgeFunctionAuthHeaders(session: { access_token?: string } | null): Record<string, string> {
  const token = session?.access_token ?? "";
  return { Authorization: `Bearer ${token}` };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Chama uma Edge Function via fetch.
 * REGRA: fetch manual exige os dois headers — Authorization (JWT) e apikey (anon key).
 */
export async function invokeEdgeFunction<T = unknown>(
  session: { access_token: string },
  name: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  const token = session.access_token;
  if (!token) {
    return { data: null, error: new Error("Usuário não autenticado") };
  }
  if (!SUPABASE_ANON_KEY) {
    return { data: null, error: new Error("Config inválida: VITE_SUPABASE_PUBLISHABLE_KEY ausente") };
  }
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    if (text) data = JSON.parse(text) as T;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const obj = data && typeof data === "object" ? (data as { error?: unknown; details?: unknown }) : null;
    const msg = obj?.error != null ? String(obj.error) : `HTTP ${res.status}`;
    const detail = obj?.details != null ? String(obj.details) : "";
    const fullMsg = detail ? `${msg}: ${detail}` : msg;
    return {
      data: data ?? null,
      error: new Error(fullMsg),
    };
  }
  return { data, error: null };
}
