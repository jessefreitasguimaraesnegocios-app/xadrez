import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refundWithdrawal(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  withdrawalId: string,
  amount: string | number,
  failureReason: string,
) {
  const { data: wallet } = await supabase.from("wallets").select("balance_available").eq("user_id", userId).single();
  if (wallet) {
    await supabase
      .from("wallets")
      .update({
        balance_available: Number(wallet.balance_available) + Number(amount),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }
  await supabase
    .from("withdrawals")
    .update({ status: "failed", failure_reason: failureReason })
    .eq("id", withdrawalId);
  const { data: txRows } = await supabase
    .from("transactions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("type", "withdraw");
  for (const tx of txRows || []) {
    const meta = (tx as { metadata?: { withdrawal_id?: string } }).metadata;
    if (meta?.withdrawal_id === withdrawalId) {
      await supabase.from("transactions").update({ status: "cancelled" }).eq("id", tx.id);
      break;
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const asaasApiKey = Deno.env.get("ASAAS_API_KEY")!;
  const asaasBaseUrl = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";
  const asaasHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "access_token": asaasApiKey,
    "User-Agent": "ChessBet/1.0",
  };

  const { data: rows, error: listErr } = await supabase
    .from("withdrawals")
    .select("id, user_id, amount, asaas_transfer_id")
    .eq("status", "completed")
    .not("asaas_transfer_id", "is", null)
    .limit(100);

  if (listErr || !rows?.length) {
    return new Response(
      JSON.stringify({ synced: 0, refunded: 0, message: "Nenhum saque completed com asaas_transfer_id" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let refunded = 0;
  for (const w of rows) {
    const id = w.asaas_transfer_id as string;
    const getRes = await fetch(`${asaasBaseUrl}/transfers/${id}`, { headers: asaasHeaders });
    const getData = (await getRes.json().catch(() => ({}))) as {
      status?: string;
      transferFailureReason?: string;
      failReason?: string;
      errors?: Array<{ description?: string }>;
    };
    const asaasStatus = String(getData?.status ?? "").toUpperCase();
    if (["FAILED", "CANCELLED", "CANCELED", "BLOCKED"].includes(asaasStatus)) {
      const reason =
        getData?.transferFailureReason ??
        getData?.failReason ??
        getData?.errors?.[0]?.description ??
        `Asaas status (sync): ${asaasStatus}`;
      await refundWithdrawal(supabase, w.user_id, w.id, w.amount, reason);
      refunded++;
    }
  }

  return new Response(
    JSON.stringify({ synced: rows.length, refunded }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
