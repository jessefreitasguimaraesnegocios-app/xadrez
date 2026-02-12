import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const HOUSE_CUT_PCT = 0.2;
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
    const gameId = body?.gameId ?? body?.game_id;
    const result = body?.result;
    if (!gameId || !["white_wins", "black_wins", "draw"].includes(result)) {
      return new Response(
        JSON.stringify({ error: "gameId and result (white_wins|black_wins|draw) required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .select("id, white_player_id, black_player_id, bet_amount, status")
      .eq("id", gameId)
      .single();

    if (gameErr || !game) {
      return new Response(JSON.stringify({ error: "Game not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (game.status !== "in_progress") {
      return new Response(JSON.stringify({ error: "Game is not in progress" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (userId !== game.white_player_id && userId !== game.black_player_id) {
      return new Response(JSON.stringify({ error: "You must be a player in this game" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const bet = Number(game.bet_amount ?? 0);
    const whiteId = game.white_player_id!;
    const blackId = game.black_player_id!;

    if (bet > 0) {
      const { data: wW } = await supabase.from("wallets").select("balance_available, balance_locked").eq("user_id", whiteId).single();
      const { data: wB } = await supabase.from("wallets").select("balance_available, balance_locked").eq("user_id", blackId).single();
      const whiteAvail = wW ? Number(wW.balance_available) : 0;
      const whiteLocked = wW ? Number(wW.balance_locked) : 0;
      const blackAvail = wB ? Number(wB.balance_available) : 0;
      const blackLocked = wB ? Number(wB.balance_locked) : 0;

      const pot = bet * 2;
      const winnerPayout = Math.round((pot * (1 - HOUSE_CUT_PCT)) * 100) / 100;

      if (result === "draw") {
        await supabase.from("wallets").update({
          balance_available: whiteAvail + bet,
          balance_locked: whiteLocked - bet,
          updated_at: new Date().toISOString(),
        }).eq("user_id", whiteId);
        await supabase.from("wallets").update({
          balance_available: blackAvail + bet,
          balance_locked: blackLocked - bet,
          updated_at: new Date().toISOString(),
        }).eq("user_id", blackId);
        await supabase.from("transactions").insert([
          { user_id: whiteId, type: "bet_refund", amount: bet, status: "completed", metadata: { game_id: gameId } },
          { user_id: blackId, type: "bet_refund", amount: bet, status: "completed", metadata: { game_id: gameId } },
        ]);
      } else if (result === "white_wins") {
        await supabase.from("wallets").update({
          balance_available: whiteAvail + winnerPayout,
          balance_locked: whiteLocked - bet,
          updated_at: new Date().toISOString(),
        }).eq("user_id", whiteId);
        await supabase.from("wallets").update({
          balance_locked: blackLocked - bet,
          updated_at: new Date().toISOString(),
        }).eq("user_id", blackId);
        await supabase.from("transactions").insert([
          { user_id: whiteId, type: "bet_win", amount: winnerPayout, status: "completed", metadata: { game_id: gameId } },
          { user_id: blackId, type: "bet_refund", amount: 0, status: "completed", metadata: { game_id: gameId } },
        ]);
      } else {
        await supabase.from("wallets").update({
          balance_locked: whiteLocked - bet,
          updated_at: new Date().toISOString(),
        }).eq("user_id", whiteId);
        await supabase.from("wallets").update({
          balance_available: blackAvail + winnerPayout,
          balance_locked: blackLocked - bet,
          updated_at: new Date().toISOString(),
        }).eq("user_id", blackId);
        await supabase.from("transactions").insert([
          { user_id: whiteId, type: "bet_refund", amount: 0, status: "completed", metadata: { game_id: gameId } },
          { user_id: blackId, type: "bet_win", amount: winnerPayout, status: "completed", metadata: { game_id: gameId } },
        ]);
      }
    }

    await supabase
      .from("games")
      .update({
        status: "completed",
        result,
        ended_at: new Date().toISOString(),
      })
      .eq("id", gameId);

    const { data: pWhite } = await supabase.from("profiles").select("wins, losses, draws, total_winnings, total_bet_amount, elo_rating").eq("user_id", whiteId).single();
    const { data: pBlack } = await supabase.from("profiles").select("wins, losses, draws, total_winnings, total_bet_amount, elo_rating").eq("user_id", blackId).single();

    const winsWhite = pWhite ? pWhite.wins + (result === "white_wins" ? 1 : 0) : 0;
    const lossesWhite = pWhite ? pWhite.losses + (result === "black_wins" ? 1 : 0) : 0;
    const drawsWhite = pWhite ? pWhite.draws + (result === "draw" ? 1 : 0) : 0;
    const winsBlack = pBlack ? pBlack.wins + (result === "black_wins" ? 1 : 0) : 0;
    const lossesBlack = pBlack ? pBlack.losses + (result === "white_wins" ? 1 : 0) : 0;
    const drawsBlack = pBlack ? pBlack.draws + (result === "draw" ? 1 : 0) : 0;

    if (bet === 0 && pWhite?.elo_rating != null && pBlack?.elo_rating != null) {
      const K = 32;
      const eloW = Number(pWhite.elo_rating);
      const eloB = Number(pBlack.elo_rating);
      const expectedW = 1 / (1 + Math.pow(10, (eloB - eloW) / 400));
      const scoreW = result === "white_wins" ? 1 : result === "draw" ? 0.5 : 0;
      const scoreB = result === "black_wins" ? 1 : result === "draw" ? 0.5 : 0;
      const newEloW = Math.max(100, Math.round(eloW + K * (scoreW - expectedW)));
      const newEloB = Math.max(100, Math.round(eloB + K * (scoreB - (1 - expectedW))));
      await supabase.from("profiles").update({
        wins: winsWhite,
        losses: lossesWhite,
        draws: drawsWhite,
        total_winnings: pWhite.total_winnings,
        total_bet_amount: pWhite.total_bet_amount,
        elo_rating: newEloW,
      }).eq("user_id", whiteId);
      await supabase.from("profiles").update({
        wins: winsBlack,
        losses: lossesBlack,
        draws: drawsBlack,
        total_winnings: pBlack.total_winnings,
        total_bet_amount: pBlack.total_bet_amount,
        elo_rating: newEloB,
      }).eq("user_id", blackId);
    } else {
      if (pWhite) {
        const totalWinnings = result === "white_wins" && bet > 0
          ? pWhite.total_winnings + Math.round(bet * 2 * (1 - HOUSE_CUT_PCT) * 100) / 100 - bet
          : pWhite.total_winnings;
        const totalBet = pWhite.total_bet_amount + (bet > 0 ? bet : 0);
        await supabase.from("profiles").update({ wins: winsWhite, losses: lossesWhite, draws: drawsWhite, total_winnings: totalWinnings, total_bet_amount: totalBet }).eq("user_id", whiteId);
      }
      if (pBlack) {
        const totalWinnings = result === "black_wins" && bet > 0
          ? pBlack.total_winnings + Math.round(bet * 2 * (1 - HOUSE_CUT_PCT) * 100) / 100 - bet
          : pBlack.total_winnings;
        const totalBet = pBlack.total_bet_amount + (bet > 0 ? bet : 0);
        await supabase.from("profiles").update({ wins: winsBlack, losses: lossesBlack, draws: drawsBlack, total_winnings: totalWinnings, total_bet_amount: totalBet }).eq("user_id", blackId);
      }
    }

    return new Response(JSON.stringify({ ok: true, result }), {
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
