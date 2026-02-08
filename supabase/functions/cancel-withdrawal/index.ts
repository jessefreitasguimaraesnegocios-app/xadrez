import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CANCELLABLE_STATUSES = ["pending_review", "approved"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", detail: userError?.message ?? "Invalid token" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const withdrawalId = typeof body?.withdrawalId === "string" ? body.withdrawalId.trim() : String(body?.withdrawal_id ?? "").trim();
    if (!withdrawalId) {
      return new Response(JSON.stringify({ error: "withdrawalId is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: withdrawal, error: fetchErr } = await supabase
      .from("withdrawals")
      .select("id, user_id, amount, status")
      .eq("id", withdrawalId)
      .single();

    if (fetchErr || !withdrawal) {
      return new Response(JSON.stringify({ error: "Withdrawal not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (withdrawal.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (!CANCELLABLE_STATUSES.includes(withdrawal.status)) {
      return new Response(
        JSON.stringify({ error: "Saque já foi processado ou não pode ser cancelado", status: withdrawal.status }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const amount = Number(withdrawal.amount);

    const { error: updateWithdrawalErr } = await supabase
      .from("withdrawals")
      .update({ status: "cancelled" })
      .eq("id", withdrawalId)
      .eq("user_id", userId);

    if (updateWithdrawalErr) {
      return new Response(JSON.stringify({ error: "Failed to cancel withdrawal", details: updateWithdrawalErr.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { data: wallet } = await supabase.from("wallets").select("balance_available").eq("user_id", userId).single();
    if (wallet) {
      await supabase
        .from("wallets")
        .update({
          balance_available: Number(wallet.balance_available) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }

    const { data: txRows } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "withdraw")
      .eq("status", "pending")
      .contains("metadata", { withdrawal_id: withdrawalId });

    for (const tx of txRows ?? []) {
      await supabase.from("transactions").update({ status: "cancelled" }).eq("id", tx.id);
      break;
    }

    return new Response(JSON.stringify({ ok: true, message: "Saque cancelado. Valor devolvido ao saldo." }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cancel-withdrawal error:", e);
    return new Response(JSON.stringify({ error: "Internal error", message: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
