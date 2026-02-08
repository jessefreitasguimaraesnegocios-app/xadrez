import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY")!;
    const asaasBaseUrl = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";
    const asaasHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "access_token": asaasApiKey,
      "User-Agent": "ChessBet/1.0",
    };

    const nowIso = new Date().toISOString();

    await supabase
      .from("withdrawals")
      .update({ status: "approved" })
      .eq("user_id", userId)
      .eq("status", "pending_review")
      .lte("scheduled_after", nowIso);

    const { data: rows, error: listErr } = await supabase
      .from("withdrawals")
      .select("id, user_id, amount, pix_key, pix_key_type, status")
      .eq("user_id", userId)
      .is("asaas_transfer_id", null)
      .eq("status", "approved")
      .lte("scheduled_after", nowIso)
      .order("scheduled_after", { ascending: true })
      .limit(10);

    if (listErr || !rows?.length) {
      return new Response(
        JSON.stringify({ processed: 0, message: "Nenhum saque pendente para processar" }),
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

      const transferPayload: Record<string, unknown> = {
        value: Number(w.amount),
        pixAddressKey: ["CPF", "CNPJ", "PHONE"].includes(w.pix_key_type)
          ? String(w.pix_key).replace(/\D/g, "")
          : String(w.pix_key),
        pixAddressKeyType: w.pix_key_type,
        description: `Saque ChessBet - R$ ${w.amount}`,
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
  } catch (e) {
    console.error("process-my-withdrawals error:", e);
    return new Response(JSON.stringify({ error: "Internal error", message: String(e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
