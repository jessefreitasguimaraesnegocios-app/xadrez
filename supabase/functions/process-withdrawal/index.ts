import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  // Auto-approve pending_review when scheduled_after has passed (plan: process only "approved")
  await supabase
    .from("withdrawals")
    .update({ status: "approved" })
    .eq("status", "pending_review")
    .lte("scheduled_after", new Date().toISOString());

  const { data: rows, error: listErr } = await supabase
    .from("withdrawals")
    .select("id, user_id, amount, pix_key, pix_key_type, status")
    .is("asaas_transfer_id", null)
    .eq("status", "approved")
    .lte("scheduled_after", new Date().toISOString())
    .order("scheduled_after", { ascending: true })
    .limit(20);

  if (listErr || !rows?.length) {
    return new Response(
      JSON.stringify({ processed: 0, message: "No withdrawals to process" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let processed = 0;
  for (const w of rows) {
    const { data: locked } = await supabase
      .from("withdrawals")
      .select("id, asaas_transfer_id")
      .eq("id", w.id)
      .single();

    if (locked?.asaas_transfer_id) continue;

    await supabase
      .from("withdrawals")
      .update({ status: "processing", processed_at: new Date().toISOString() })
      .eq("id", w.id);

    const transferPayload = {
      value: Number(w.amount),
      pixAddressKey: w.pix_key,
      pixAddressKeyType: w.pix_key_type,
    };
    const transferRes = await fetch(`${asaasBaseUrl}/transfers`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify(transferPayload),
    });

    const transferData = await transferRes.json();
    const asaasTransferId = transferData.id ?? transferData.transferId ?? null;

    if (!transferRes.ok || !asaasTransferId) {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance_available")
        .eq("user_id", w.user_id)
        .single();
      if (wallet) {
        await supabase
          .from("wallets")
          .update({
            balance_available: Number(wallet.balance_available) + Number(w.amount),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", w.user_id);
      }
      await supabase
        .from("withdrawals")
        .update({
          status: "failed",
          failure_reason: transferData.errors?.[0]?.description ?? JSON.stringify(transferData),
        })
        .eq("id", w.id);
      continue;
    }

    const { error: updateErr } = await supabase
      .from("withdrawals")
      .update({
        status: "completed",
        asaas_transfer_id: asaasTransferId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", w.id);

    if (updateErr) {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance_available")
        .eq("user_id", w.user_id)
        .single();
      if (wallet) {
        await supabase
          .from("wallets")
          .update({
            balance_available: Number(wallet.balance_available) + Number(w.amount),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", w.user_id);
      }
      await supabase
        .from("withdrawals")
        .update({ status: "failed", failure_reason: "Failed to save asaas_transfer_id" })
        .eq("id", w.id);
      continue;
    }

    const { data: txRows } = await supabase
      .from("transactions")
      .select("id, metadata")
      .eq("user_id", w.user_id)
      .eq("type", "withdraw")
      .eq("status", "pending");
    for (const tx of txRows || []) {
      const meta = (tx as { metadata?: { withdrawal_id?: string } }).metadata;
      if (meta?.withdrawal_id === w.id) {
        await supabase.from("transactions").update({ status: "completed" }).eq("id", tx.id);
        break;
      }
    }
    processed++;
  }

  return new Response(
    JSON.stringify({ processed, total: rows.length }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
