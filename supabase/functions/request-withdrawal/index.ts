import "jsr:@supabase/functions-js/edge_runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const WITHDRAW_MIN = 10;
const WITHDRAW_MAX = 10000;
const WITHDRAW_DELAY_HOURS = 24;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = await req.json();
    const amount = typeof body?.amount === "number" ? body.amount : parseFloat(body?.amount);
    if (typeof amount !== "number" || isNaN(amount) || amount < WITHDRAW_MIN || amount > WITHDRAW_MAX) {
      return new Response(
        JSON.stringify({ error: `Amount must be between ${WITHDRAW_MIN} and ${WITHDRAW_MAX}` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const amountRounded = Math.round(amount * 100) / 100;
    const pixKey = String(body?.pixKey ?? body?.pix_key ?? "").trim();
    const pixKeyType = String(body?.pixKeyType ?? body?.pix_key_type ?? "EVP").toUpperCase();
    if (!pixKey || !["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(pixKeyType)) {
      return new Response(
        JSON.stringify({ error: "Invalid PIX key or type. Use CPF, CNPJ, EMAIL, PHONE, or EVP." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: wallet, error: walletErr } = await supabase
      .from("wallets")
      .select("id, balance_available")
      .eq("user_id", userId)
      .single();

    if (walletErr || !wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const available = Number(wallet.balance_available);
    if (available < amountRounded) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const scheduledAfter = new Date();
    scheduledAfter.setHours(scheduledAfter.getHours() + WITHDRAW_DELAY_HOURS);

    const { data: withdrawal, error: withdrawErr } = await supabase
      .from("withdrawals")
      .insert({
        user_id: userId,
        amount: amountRounded,
        status: "pending_review",
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        scheduled_after: scheduledAfter.toISOString(),
      })
      .select("id, status, scheduled_after")
      .single();

    if (withdrawErr) {
      return new Response(
        JSON.stringify({ error: "Failed to create withdrawal", details: withdrawErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { error: walletUpdateErr } = await supabase
      .from("wallets")
      .update({
        balance_available: available - amountRounded,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (walletUpdateErr) {
      await supabase.from("withdrawals").update({ status: "cancelled" }).eq("id", withdrawal.id);
      return new Response(
        JSON.stringify({ error: "Failed to reserve balance" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("transactions").insert({
      user_id: userId,
      type: "withdraw",
      amount: -amountRounded,
      status: "pending_review",
      metadata: { withdrawal_id: withdrawal.id },
    });

    return new Response(
      JSON.stringify({
        withdrawalId: withdrawal.id,
        status: withdrawal.status,
        scheduledAfter: withdrawal.scheduled_after,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(e) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
