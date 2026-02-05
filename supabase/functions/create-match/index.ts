import "jsr:@supabase/functions-js/edge_runtime.d.ts";
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

    if (user.id !== whitePlayerId && user.id !== blackPlayerId) {
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (betRounded > 0) {
      const { data: w1 } = await supabase.from("wallets").select("balance_available, balance_locked").eq("user_id", whitePlayerId).single();
      const { data: w2 } = await supabase.from("wallets").select("balance_available, balance_locked").eq("user_id", blackPlayerId).single();
      const bal1Avail = w1 ? Number(w1.balance_available) : 0;
      const bal2Avail = w2 ? Number(w2.balance_available) : 0;
      const bal1Locked = w1 ? Number(w1.balance_locked) : 0;
      const bal2Locked = w2 ? Number(w2.balance_locked) : 0;
      if (bal1Avail < betRounded || bal2Avail < betRounded) {
        return new Response(JSON.stringify({ error: "Insufficient balance for one or both players" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const { error: up1 } = await supabase
        .from("wallets")
        .update({
          balance_available: bal1Avail - betRounded,
          balance_locked: bal1Locked + betRounded,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", whitePlayerId);
      if (up1) {
        return new Response(JSON.stringify({ error: "Failed to lock white player balance" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const { error: up2 } = await supabase
        .from("wallets")
        .update({
          balance_available: bal2Avail - betRounded,
          balance_locked: bal2Locked + betRounded,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", blackPlayerId);
      if (up2) {
        await supabase
          .from("wallets")
          .update({
            balance_available: bal1Avail,
            balance_locked: bal1Locked,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", whitePlayerId);
        return new Response(JSON.stringify({ error: "Failed to lock black player balance" }), {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .insert({
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId,
        status: "in_progress",
        time_control: timeControl,
        bet_amount: betRounded > 0 ? betRounded : null,
        started_at: new Date().toISOString(),
        move_history: [],
      })
      .select()
      .single();

    if (gameErr) {
      if (betRounded > 0) {
        const w1 = await supabase.from("wallets").select("balance_available, balance_locked").eq("user_id", whitePlayerId).single();
        const w2 = await supabase.from("wallets").select("balance_available, balance_locked").eq("user_id", blackPlayerId).single();
        if (w1.data) {
          await supabase.from("wallets").update({
            balance_available: Number(w1.data.balance_available) + betRounded,
            balance_locked: Number(w1.data.balance_locked) - betRounded,
            updated_at: new Date().toISOString(),
          }).eq("user_id", whitePlayerId);
        }
        if (w2.data) {
          await supabase.from("wallets").update({
            balance_available: Number(w2.data.balance_available) + betRounded,
            balance_locked: Number(w2.data.balance_locked) - betRounded,
            updated_at: new Date().toISOString(),
          }).eq("user_id", blackPlayerId);
        }
      }
      return new Response(
        JSON.stringify({ error: "Failed to create game", details: gameErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (betRounded > 0 && game?.id) {
      await supabase.from("transactions").insert([
        { user_id: whitePlayerId, type: "bet_lock", amount: -betRounded, status: "completed", metadata: { game_id: game.id } },
        { user_id: blackPlayerId, type: "bet_lock", amount: -betRounded, status: "completed", metadata: { game_id: game.id } },
      ]);
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
