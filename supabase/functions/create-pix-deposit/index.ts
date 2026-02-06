import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEPOSIT_MIN = 5;
const DEPOSIT_MAX = 5000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY")!;
    const asaasBaseUrl = Deno.env.get("ASAAS_BASE_URL") || "https://sandbox.asaas.com";

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: {
        headers: {
          Authorization: req.headers.get("authorization") ?? "",
        },
      },
    });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const body = await req.json();
    const amount = typeof body?.amount === "number" ? body.amount : parseFloat(body?.amount);
    if (typeof amount !== "number" || isNaN(amount) || amount < DEPOSIT_MIN || amount > DEPOSIT_MAX) {
      return new Response(
        JSON.stringify({ error: `Amount must be between ${DEPOSIT_MIN} and ${DEPOSIT_MAX}` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const amountRounded = Math.round(amount * 100) / 100;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username")
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

    const customerPayload = {
      name,
      email,
      externalReference: userId,
    };
    const customerRes = await fetch(`${asaasBaseUrl}/api/v3/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(customerPayload),
    });
    let customerId: string;
    if (customerRes.ok) {
      const customerData = await customerRes.json();
      customerId = customerData.id;
    } else {
      const errData = await customerRes.json();
      if (errData.errors?.[0]?.description?.includes("already exists") || customerRes.status === 400) {
        const listRes = await fetch(`${asaasBaseUrl}/api/v3/customers?externalReference=${userId}`, {
          headers: { access_token: asaasApiKey },
        });
        const listData = await listRes.json();
        if (listData.data?.length) {
          customerId = listData.data[0].id;
        } else {
          return new Response(
            JSON.stringify({ error: "Failed to get or create Asaas customer" }),
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

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const paymentPayload = {
      customer: customerId,
      billingType: "PIX",
      value: amountRounded,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `Depósito ChessBet - ${amountRounded}`,
    };
    const paymentRes = await fetch(`${asaasBaseUrl}/api/v3/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(paymentPayload),
    });
    if (!paymentRes.ok) {
      const errData = await paymentRes.json();
      return new Response(
        JSON.stringify({ error: "Failed to create PIX payment", details: errData }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const paymentData = await paymentRes.json();
    const paymentId = paymentData.id;

    const qrRes = await fetch(`${asaasBaseUrl}/api/v3/payments/${paymentId}/pixQrCode`, {
      headers: { access_token: asaasApiKey },
    });
    if (!qrRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to get PIX QR Code" }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const qrData = await qrRes.json();
    const qrCodeBase64 = qrData.encodedImage;
    const payload = qrData.payload;

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
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(e) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
