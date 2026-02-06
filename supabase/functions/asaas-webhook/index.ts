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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const webhookSecret = Deno.env.get("ASAAS_WEBHOOK_SECRET");
  if (webhookSecret) {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Invalid webhook token" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  const bodyText = await req.text();
  let payload: { event?: string; payment?: { id?: string; value?: number } };
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const event = payload.event;
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
    event === "PAYMENT_RECEIVED";

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

  const amount = Number(value ?? existing.amount);

  const { data: rpcRows, error: rpcError } = await supabase.rpc("increment_wallet_balance", {
    p_user_id: existing.user_id,
    p_amount: amount,
  });

  if (rpcError || !rpcRows?.length) {
    return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  await supabase
    .from("pix_deposits")
    .update({ status: "completed" })
    .eq("asaas_payment_id", paymentId);

  const { data: pendingTx } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", existing.user_id)
    .eq("type", "deposit")
    .eq("status", "pending")
    .contains("metadata", { asaas_payment_id: paymentId })
    .limit(1)
    .maybeSingle();

  if (pendingTx?.id) {
    await supabase.from("transactions").update({ status: "completed" }).eq("id", pendingTx.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
