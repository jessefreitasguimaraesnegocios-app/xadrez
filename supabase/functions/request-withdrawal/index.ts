import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const WITHDRAW_MIN = 0.01;
const WITHDRAW_MAX = 10000;
/** 0 = elegível na hora; com cron diário (Hobby) o PIX sai no próximo ciclo (até ~24h). */
const WITHDRAW_DELAY_HOURS = 0;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Valida e normaliza a chave PIX (mesmo critério do processamento Asaas). */
function validatePixKey(key: string, type: string): { ok: true } | { error: string } {
  const t = String(type).toUpperCase();
  const digits = String(key).replace(/\D/g, "");
  if (t === "CPF") {
    if (digits.length !== 11) return { error: "CPF deve ter 11 dígitos" };
    return { ok: true };
  }
  if (t === "CNPJ") {
    if (digits.length !== 14) return { error: "CNPJ deve ter 14 dígitos" };
    return { ok: true };
  }
  if (t === "PHONE") {
    if (digits.length !== 10 && digits.length !== 11) return { error: "Telefone deve ter 10 ou 11 dígitos (com DDD)" };
    return { ok: true };
  }
  if (t === "EMAIL") {
    const trimmed = String(key).trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { error: "E-mail inválido" };
    return { ok: true };
  }
  if (t === "EVP") {
    const trimmed = String(key).trim().replace(/\s/g, "");
    if (!trimmed) return { error: "Chave EVP não pode ser vazia" };
    return { ok: true };
  }
  return { error: "Tipo de chave inválido. Use CPF, CNPJ, EMAIL, PHONE ou EVP." };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
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

    const amount = typeof body?.amount === "number" ? body.amount : parseFloat(String(body?.amount ?? ""));
    if (typeof amount !== "number" || isNaN(amount) || amount < WITHDRAW_MIN || amount > WITHDRAW_MAX) {
      return new Response(
        JSON.stringify({ error: `Amount must be between ${WITHDRAW_MIN} and ${WITHDRAW_MAX}` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const amountRounded = Math.round(amount * 100) / 100;
    const pixKey = String(body?.pixKey ?? body?.pix_key ?? "").trim();
    const pixKeyType = String(body?.pixKeyType ?? body?.pix_key_type ?? "CPF").toUpperCase();
    if (!pixKey || !["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(pixKeyType)) {
      return new Response(
        JSON.stringify({ error: "Chave ou tipo inválido. Use CPF, CNPJ, EMAIL, PHONE ou EVP." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const validation = validatePixKey(pixKey, pixKeyType);
    if (!("ok" in validation)) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const scheduledAfter = new Date();
    scheduledAfter.setHours(scheduledAfter.getHours() + WITHDRAW_DELAY_HOURS);

    const { data: rows, error: rpcError } = await supabase.rpc("request_withdrawal_atomic", {
      p_user_id: userId,
      p_amount: amountRounded,
      p_pix_key: pixKey,
      p_pix_key_type: pixKeyType,
      p_scheduled_after: scheduledAfter.toISOString(),
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: "Failed to create withdrawal", details: rpcError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const withdrawal = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!withdrawal?.id) {
      return new Response(JSON.stringify({ error: "Insufficient balance or wallet not found" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

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
