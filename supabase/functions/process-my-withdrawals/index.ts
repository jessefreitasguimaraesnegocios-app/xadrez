import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Normaliza a chave PIX para o formato esperado pelo Asaas (CPF/CNPJ sem pontuação, PHONE 11 dígitos). */
function normalizePixKeyForAsaas(
  key: string,
  type: string,
): { key: string } | { error: string } {
  const t = String(type).toUpperCase();
  const digits = String(key).replace(/\D/g, "");
  if (t === "CPF") {
    if (digits.length !== 11) return { error: "CPF deve ter 11 dígitos" };
    return { key: digits };
  }
  if (t === "CNPJ") {
    if (digits.length !== 14) return { error: "CNPJ deve ter 14 dígitos" };
    return { key: digits };
  }
  if (t === "PHONE") {
    if (digits.length === 10) {
      const withNine = digits.slice(0, 2) + "9" + digits.slice(2);
      return { key: withNine };
    }
    if (digits.length !== 11) return { error: "Telefone deve ter 10 ou 11 dígitos (com DDD)" };
    return { key: digits };
  }
  if (t === "EMAIL") {
    const trimmed = String(key).trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { error: "E-mail inválido" };
    return { key: trimmed };
  }
  if (t === "EVP") {
    const trimmed = String(key).trim().replace(/\s/g, "");
    if (!trimmed) return { error: "Chave EVP não pode ser vazia" };
    return { key: trimmed };
  }
  return { error: `Tipo de chave não suportado: ${type}` };
}

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

    // Aprovar todos os pending_review do usuário (chamada autenticada = usuário quer processar na hora)
    await supabase
      .from("withdrawals")
      .update({ status: "approved" })
      .eq("user_id", userId)
      .eq("status", "pending_review");

    const { data: rows, error: listErr } = await supabase
      .from("withdrawals")
      .select("id, user_id, amount, pix_key, pix_key_type, status")
      .eq("user_id", userId)
      .is("asaas_transfer_id", null)
      .eq("status", "approved")
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

      const normalized = normalizePixKeyForAsaas(String(w.pix_key), String(w.pix_key_type ?? ""));
      if ("error" in normalized) {
        await refundWithdrawal(supabase, w.user_id, w.id, w.amount, normalized.error);
        continue;
      }

      const transferPayload: Record<string, unknown> = {
        value: Number(w.amount),
        pixAddressKey: normalized.key,
        pixAddressKeyType: String(w.pix_key_type).toUpperCase(),
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
        await refundWithdrawal(supabase, w.user_id, w.id, w.amount, transferData.errors?.[0]?.description ?? JSON.stringify(transferData));
        continue;
      }

      const getRes = await fetch(`${asaasBaseUrl}/transfers/${asaasTransferId}`, { headers: asaasHeaders });
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
          `Asaas status: ${asaasStatus}`;
        await refundWithdrawal(supabase, w.user_id, w.id, w.amount, reason);
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
        await refundWithdrawal(supabase, w.user_id, w.id, w.amount, "Failed to save asaas_transfer_id");
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
