import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BET_MIN = 1;
const BET_MAX = 500;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const body = await req.json();
    const whitePlayerId = body?.whitePlayerId ?? body?.white_player_id;
    const blackPlayerId = body?.blackPlayerId ?? body?.black_player_id;
    const timeControl = body?.timeControl ?? body?.time_control ?? "10+0";
    const betAmount = typeof body?.betAmount === "number" ? body.betAmount : parseFloat(body?.betAmount ?? 0);

    if (!whitePlayerId || !blackPlayerId) {
      return new Response(JSON.stringify({ error: "whitePlayerId and blackPlayerId required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (userId !== whitePlayerId && userId !== blackPlayerId) {
      return new Response(JSON.stringify({ error: "You must be one of the players" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const betRounded = Math.round(Math.max(0, betAmount) * 100) / 100;
    if (betRounded > 0 && (betRounded < BET_MIN || betRounded > BET_MAX)) {
      return new Response(
        JSON.stringify({ error: `Bet must be between ${BET_MIN} and ${BET_MAX} when betting` }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const timeControlStr = (timeControl && String(timeControl).trim()) || "10+0";

    const { data: gameRows, error: rpcError } = await supabase.rpc("create_match_atomic", {
      p_white_player_id: whitePlayerId,
      p_black_player_id: blackPlayerId,
      p_time_control: timeControlStr,
      p_bet_amount: betRounded,
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: "Failed to create game", details: rpcError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const game = Array.isArray(gameRows) && gameRows.length > 0 ? gameRows[0] : null;
    if (!game?.id) {
      return new Response(
        JSON.stringify({ error: "Insufficient balance for one or both players" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(game), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(e) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
