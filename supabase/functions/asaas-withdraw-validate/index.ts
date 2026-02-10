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
    console.warn("[asaas-withdraw-validate] REFUSED: Método não permitido");
    return new Response(
      JSON.stringify({ status: "REFUSED", refuseReason: "Método não permitido" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const validateToken = Deno.env.get("ASAAS_WITHDRAW_VALIDATE_TOKEN");
  if (validateToken) {
    const asaasToken = req.headers.get("asaas-access-token")?.trim() ?? "";
    if (!asaasToken || asaasToken !== validateToken) {
      console.warn("[asaas-withdraw-validate] REFUSED: Token de autorização inválido ou ausente");
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
    console.warn("[asaas-withdraw-validate] REFUSED: Corpo da requisição inválido");
    return new Response(
      JSON.stringify({ status: "REFUSED", refuseReason: "Corpo da requisição inválido" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (body?.type !== "TRANSFER" || !body?.transfer) {
    console.warn("[asaas-withdraw-validate] REFUSED: Payload não é uma transferência");
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
    console.warn("[asaas-withdraw-validate] REFUSED: ID ou valor da transferência inválido", { transferId: transferId || "(vazio)", value });
    return new Response(
      JSON.stringify({ status: "REFUSED", refuseReason: "ID ou valor da transferência inválido" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const amountRounded = Math.round(value * 100) / 100;
  const AMOUNT_TOLERANCE = 0.01;
  const WINDOW_MINUTES = 30;
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: byTransferId } = await supabase
    .from("withdrawals")
    .select("id, amount, status")
    .eq("asaas_transfer_id", transferId)
    .limit(1)
    .maybeSingle();

  if (byTransferId?.id) {
    console.log("[asaas-withdraw-validate] APPROVED by asaas_transfer_id", { transferId, value: amountRounded });
    return new Response(JSON.stringify({ status: "APPROVED" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { data: byAmountRows } = await supabase
    .from("withdrawals")
    .select("id, amount, status")
    .in("status", ["processing", "approved"])
    .is("asaas_transfer_id", null)
    .gte("amount", amountRounded - 0.005)
    .lte("amount", amountRounded + 0.005)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5);

  const byAmount = (byAmountRows ?? []).find(
    (row) => Math.abs(Number(row.amount) - amountRounded) < AMOUNT_TOLERANCE
  );

  if (byAmount?.id && /Saque ChessBet/i.test(description)) {
    await supabase
      .from("withdrawals")
      .update({ asaas_transfer_id: transferId })
      .eq("id", byAmount.id);
    console.log("[asaas-withdraw-validate] APPROVED by amount+description", { transferId, value: amountRounded });
    return new Response(JSON.stringify({ status: "APPROVED" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  console.warn("[asaas-withdraw-validate] REFUSED: nenhum saque encontrado (byTransferId e byAmount)", { transferId, value: amountRounded });
  return new Response(
    JSON.stringify({
      status: "REFUSED",
      refuseReason: "Transferência não encontrada ou não autorizada no sistema",
    }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
