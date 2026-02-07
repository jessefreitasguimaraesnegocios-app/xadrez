import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEPOSIT_MIN = 5;
const DEPOSIT_MAX = 5000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Preflight: resposta exatamente como na doc do Supabase para CORS no browser
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  console.log("AUTH HEADER RECEBIDO:", req.headers.get("authorization") ? "presente" : "null");

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", detail: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY")!;
    const asaasBaseUrl = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";

    // Validar JWT: cliente anon com o header da requisição + getUser() (não usa refresh)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.log("getUser falhou:", userError?.message ?? "user null");
      return new Response(
        JSON.stringify({ error: "Unauthorized", detail: userError?.message ?? "Invalid token" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const amount = typeof body?.amount === "number" ? body.amount : parseFloat(String(body?.amount ?? ""));
    if (typeof amount !== "number" || isNaN(amount) || amount < DEPOSIT_MIN || amount > DEPOSIT_MAX) {
      return new Response(
        JSON.stringify({ error: `Amount must be between ${DEPOSIT_MIN} and ${DEPOSIT_MAX}` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const amountRounded = Math.round(amount * 100) / 100;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, cpf_cnpj")
      .eq("user_id", userId)
      .single();
    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const email = user.email || `${userId}@chessbet.placeholder`;
    const name = profile.display_name || profile.username || "Jogador";
    const cpfCnpjRaw = (profile as { cpf_cnpj?: string | null }).cpf_cnpj ?? null;
    const cpfCnpj = cpfCnpjRaw ? String(cpfCnpjRaw).replace(/\D/g, "") : "";
    if (!(cpfCnpj.length === 11 || cpfCnpj.length === 14)) {
      return new Response(
        JSON.stringify({
          error: "CPF/CNPJ obrigatório",
          detail: "Para gerar PIX é necessário informar CPF ou CNPJ no seu perfil.",
        }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const customerPayload = {
      name,
      email,
      externalReference: userId,
      cpfCnpj,
    };
    const asaasHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "access_token": asaasApiKey,
      "User-Agent": "ChessBet/1.0",
    };

    const customerRes = await fetch(`${asaasBaseUrl}/customers`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify(customerPayload),
    });
    let customerId: string;
    if (customerRes.ok) {
      const customerData = (await customerRes.json().catch(() => ({}))) as { id?: string };
      customerId = customerData.id ?? "";
    } else {
      const errData = (await customerRes.json().catch(() => ({}))) as { errors?: { description?: string }[] };
      const desc = errData.errors?.[0]?.description ?? "";
      if (desc.includes("already exists") || customerRes.status === 400) {
        const listRes = await fetch(`${asaasBaseUrl}/customers?externalReference=${userId}`, {
          headers: asaasHeaders,
        });
        const listData = (await listRes.json().catch(() => ({}))) as { data?: { id: string }[] };
        if (listData.data?.length) {
          customerId = listData.data[0].id;
        } else {
          return new Response(
            JSON.stringify({ error: "Failed to get or create Asaas customer", details: errData }),
            { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Asaas customer error", details: errData }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }

    // Garantir que o customer tem CPF/CNPJ (obrigatório para criar cobrança PIX)
    const putCustomerRes = await fetch(`${asaasBaseUrl}/customers/${customerId}`, {
      method: "PUT",
      headers: asaasHeaders,
      body: JSON.stringify({ cpfCnpj }),
    });
    if (!putCustomerRes.ok) {
      const putErr = (await putCustomerRes.json().catch(() => ({}))) as { errors?: unknown[] };
      console.log("PUT customer cpfCnpj falhou:", putCustomerRes.status, putErr);
      return new Response(
        JSON.stringify({
          error: "Não foi possível atualizar CPF/CNPJ no Asaas. Tente novamente.",
          details: putErr,
        }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const paymentPayload = {
      customer: customerId,
      billingType: "PIX",
      value: amountRounded,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `Depósito ChessBet - ${amountRounded}`,
    };
    const paymentRes = await fetch(`${asaasBaseUrl}/payments`, {
      method: "POST",
      headers: asaasHeaders,
      body: JSON.stringify(paymentPayload),
    });
    if (!paymentRes.ok) {
      const errData = (await paymentRes.json().catch(() => ({}))) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ error: "Failed to create PIX payment", details: errData }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const paymentData = (await paymentRes.json().catch(() => ({}))) as { id?: string };
    const paymentId = paymentData.id;
    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: "Asaas não retornou ID do pagamento", details: paymentData }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const qrRes = await fetch(`${asaasBaseUrl}/payments/${paymentId}/pixQrCode`, {
      headers: asaasHeaders,
    });
    if (!qrRes.ok) {
      const qrErr = (await qrRes.json().catch(() => ({}))) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ error: "Failed to get PIX QR Code", details: qrErr }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const qrData = (await qrRes.json().catch(() => ({}))) as { encodedImage?: string; payload?: string; expirationDate?: string };
    const qrCodeBase64 = qrData.encodedImage;
    const payload = qrData.payload;
    if (!qrCodeBase64 || !payload) {
      return new Response(
        JSON.stringify({ error: "Asaas não retornou QR Code válido", details: qrData }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { error: pixDepositError } = await supabaseAdmin.from("pix_deposits").insert({
      user_id: userId,
      asaas_payment_id: paymentId,
      amount: amountRounded,
      status: "pending",
    });
    if (pixDepositError) {
      return new Response(
        JSON.stringify({ error: "Failed to save deposit record", details: pixDepositError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "deposit",
      amount: amountRounded,
      status: "pending",
      metadata: { asaas_payment_id: paymentId },
    });
    if (txError) {
      return new Response(
        JSON.stringify({ error: "Failed to save transaction", details: txError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        paymentId,
        qrCodeBase64,
        payload,
        expiresAt: qrData.expirationDate || null,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("create-pix-deposit error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(e) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
