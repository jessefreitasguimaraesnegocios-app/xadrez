import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

type TransferPayload = {
  type?: string;
  transfer?: {
    id?: string;
    value?: number;
    description?: string;
    status?: string;
    operationType?: string;
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "REFUSED", refuseReason: "Método não permitido" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const validateToken = Deno.env.get("ASAAS_WITHDRAW_VALIDATE_TOKEN");
  if (validateToken) {
    const asaasToken = req.headers.get("asaas-access-token")?.trim() ?? "";
    if (!asaasToken || asaasToken !== validateToken) {
      return new Response(
        JSON.stringify({ status: "REFUSED", refuseReason: "Token de autorização inválido" }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  }

  let body: TransferPayload;
  try {
    body = (await req.json()) as TransferPayload;
  } catch {
    return new Response(
      JSON.stringify({ status: "REFUSED", refuseReason: "Corpo da requisição inválido" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (body?.type !== "TRANSFER" || !body?.transfer) {
    return new Response(
      JSON.stringify({ status: "REFUSED", refuseReason: "Payload não é uma transferência" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const transfer = body.transfer;
  const transferId = transfer?.id ?? "";
  const value = Number(transfer?.value ?? 0);
  const description = String(transfer?.description ?? "");

  if (!transferId || value <= 0) {
    return new Response(
      JSON.stringify({ status: "REFUSED", refuseReason: "ID ou valor da transferência inválido" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const amountRounded = Math.round(value * 100) / 100;

  const { data: byTransferId } = await supabase
    .from("withdrawals")
    .select("id, amount, status")
    .eq("asaas_transfer_id", transferId)
    .limit(1)
    .maybeSingle();

  if (byTransferId?.id) {
    return new Response(JSON.stringify({ status: "APPROVED" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { data: byAmount } = await supabase
    .from("withdrawals")
    .select("id, amount, status")
    .eq("status", "processing")
    .is("asaas_transfer_id", null)
    .eq("amount", amountRounded)
    .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (byAmount?.id && /Saque ChessBet/i.test(description)) {
    await supabase
      .from("withdrawals")
      .update({ asaas_transfer_id: transferId })
      .eq("id", byAmount.id);
    return new Response(JSON.stringify({ status: "APPROVED" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      status: "REFUSED",
      refuseReason: "Transferência não encontrada ou não autorizada no sistema",
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
