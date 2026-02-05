import "jsr:@supabase/functions-js/edge_runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const bodyText = await req.text();
  let payload: { event?: string; payment?: { id?: string; status?: string; value?: number }; access_token?: string; token?: string };
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const webhookSecret = Deno.env.get("ASAAS_WEBHOOK_SECRET");
  if (webhookSecret) {
    const signature = req.headers.get("asaas-access-token") || req.headers.get("x-asaas-signature") || "";
    const token = payload.access_token ?? payload.token ?? "";
    if (token !== webhookSecret && signature !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  const event = payload.event || payload.payment?.status;
  const paymentId = payload.payment?.id;
  const value = payload.payment?.value;

  if (!paymentId) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const isConfirmed =
    event === "PAYMENT_CONFIRMED" ||
    event === "PAYMENT_RECEIVED" ||
    payload.payment?.status === "CONFIRMED" ||
    payload.payment?.status === "RECEIVED";

  if (!isConfirmed) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { data: existing } = await supabase
    .from("pix_deposits")
    .select("id, user_id, amount, status")
    .eq("asaas_payment_id", paymentId)
    .single();

  if (!existing) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (existing.status === "completed") {
    return new Response(JSON.stringify({ received: true, idempotent: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const amount = value ?? existing.amount;

  const { data: wallet, error: walletSelectError } = await supabase
    .from("wallets")
    .select("id, balance_available")
    .eq("user_id", existing.user_id)
    .single();

  if (walletSelectError || !wallet) {
    return new Response(JSON.stringify({ error: "Wallet not found" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const newBalance = Number(wallet.balance_available) + Number(amount);

  const { error: updateWalletError } = await supabase
    .from("wallets")
    .update({
      balance_available: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", existing.user_id);

  if (updateWalletError) {
    return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  await supabase
    .from("pix_deposits")
    .update({ status: "completed" })
    .eq("asaas_payment_id", paymentId);

  const { data: txRows } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", existing.user_id)
    .eq("type", "deposit")
    .eq("status", "pending");
  for (const row of txRows || []) {
    const { data: one } = await supabase.from("transactions").select("metadata").eq("id", row.id).single();
    const meta = (one as { metadata?: { asaas_payment_id?: string } } | null)?.metadata;
    if (meta?.asaas_payment_id === paymentId) {
      await supabase.from("transactions").update({ status: "completed" }).eq("id", row.id);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
