/**
 * Header Authorization para chamadas a Edge Functions.
 * Usa o access_token da sessão quando disponível; fallback para a anon public key do Supabase.
 */
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

export function getEdgeFunctionAuthHeaders(session: { access_token?: string } | null): {
  Authorization: string;
} {
  const token = session?.access_token ?? ANON_KEY;
  return { Authorization: `Bearer ${token}` };
}
