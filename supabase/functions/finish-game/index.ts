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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const gameId = body?.gameId ?? body?.game_id;
    const result = body?.result;
    if (!gameId || !["white_wins", "black_wins", "draw"].includes(result)) {
      return new Response(
        JSON.stringify({ error: "gameId and result (white_wins|black_wins|draw) required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    if (user.id !== game.white_player_id && user.id !== game.black_player_id) {
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

    const { data: pWhite } = await supabase.from("profiles").select("wins, losses, draws, total_winnings, total_bet_amount").eq("user_id", whiteId).single();
    const { data: pBlack } = await supabase.from("profiles").select("wins, losses, draws, total_winnings, total_bet_amount").eq("user_id", blackId).single();

    if (pWhite) {
      const wins = pWhite.wins + (result === "white_wins" ? 1 : 0);
      const losses = pWhite.losses + (result === "black_wins" ? 1 : 0);
      const draws = pWhite.draws + (result === "draw" ? 1 : 0);
      const totalWinnings = result === "white_wins" && bet > 0
        ? pWhite.total_winnings + Math.round(bet * 2 * (1 - HOUSE_CUT_PCT) * 100) / 100 - bet
        : pWhite.total_winnings;
      const totalBet = pWhite.total_bet_amount + (bet > 0 ? bet : 0);
      await supabase.from("profiles").update({ wins, losses, draws, total_winnings: totalWinnings, total_bet_amount: totalBet }).eq("user_id", whiteId);
    }
    if (pBlack) {
      const wins = pBlack.wins + (result === "black_wins" ? 1 : 0);
      const losses = pBlack.losses + (result === "white_wins" ? 1 : 0);
      const draws = pBlack.draws + (result === "draw" ? 1 : 0);
      const totalWinnings = result === "black_wins" && bet > 0
        ? pBlack.total_winnings + Math.round(bet * 2 * (1 - HOUSE_CUT_PCT) * 100) / 100 - bet
        : pBlack.total_winnings;
      const totalBet = pBlack.total_bet_amount + (bet > 0 ? bet : 0);
      await supabase.from("profiles").update({ wins, losses, draws, total_winnings: totalWinnings, total_bet_amount: totalBet }).eq("user_id", blackId);
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
