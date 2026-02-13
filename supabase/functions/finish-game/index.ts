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
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
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

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .select("id, white_player_id, black_player_id, bet_amount, status, result")
      .eq("id", gameId)
      .single();

    if (gameErr || !game) {
      return new Response(JSON.stringify({ error: "Game not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const isAlreadyCompleted = game.status === "completed";
    const effectiveResult = (isAlreadyCompleted ? game.result : result) as string | null;
    if (!effectiveResult || !["white_wins", "black_wins", "draw"].includes(effectiveResult)) {
      return new Response(
        JSON.stringify({ error: "gameId and result (white_wins|black_wins|draw) required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
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
    let eloChangeUser: number | null = null;
    let amountWonUser: number | null = null;

    if (bet > 0) {
      const { data: wW } = await supabase.from("wallets").select("balance_available, balance_locked").eq("user_id", whiteId).single();
      const { data: wB } = await supabase.from("wallets").select("balance_available, balance_locked").eq("user_id", blackId).single();
      const whiteAvail = wW ? Number(wW.balance_available) : 0;
      const whiteLocked = wW ? Number(wW.balance_locked) : 0;
      const blackAvail = wB ? Number(wB.balance_available) : 0;
      const blackLocked = wB ? Number(wB.balance_locked) : 0;

      const pot = bet * 2;
      const winnerPayout = Math.round((pot * (1 - HOUSE_CUT_PCT)) * 100) / 100;
      if (effectiveResult === "white_wins" && userId === whiteId) amountWonUser = winnerPayout;
      else if (effectiveResult === "black_wins" && userId === blackId) amountWonUser = winnerPayout;

      if (effectiveResult === "draw") {
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
      } else if (effectiveResult === "white_wins") {
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

    if (!isAlreadyCompleted) {
      await supabase
        .from("games")
        .update({
          status: "completed",
          result: effectiveResult,
          ended_at: new Date().toISOString(),
        })
        .eq("id", gameId);
    }

    const { data: pWhite } = await supabase.from("profiles").select("wins, losses, draws, total_winnings, total_bet_amount, elo_rating").eq("user_id", whiteId).single();
    const { data: pBlack } = await supabase.from("profiles").select("wins, losses, draws, total_winnings, total_bet_amount, elo_rating").eq("user_id", blackId).single();

    const winsWhite = pWhite ? pWhite.wins + (effectiveResult === "white_wins" ? 1 : 0) : 0;
    const lossesWhite = pWhite ? pWhite.losses + (effectiveResult === "black_wins" ? 1 : 0) : 0;
    const drawsWhite = pWhite ? pWhite.draws + (effectiveResult === "draw" ? 1 : 0) : 0;
    const winsBlack = pBlack ? pBlack.wins + (effectiveResult === "black_wins" ? 1 : 0) : 0;
    const lossesBlack = pBlack ? pBlack.losses + (effectiveResult === "white_wins" ? 1 : 0) : 0;
    const drawsBlack = pBlack ? pBlack.draws + (effectiveResult === "draw" ? 1 : 0) : 0;

    let newEloW: number | null = null;
    let newEloB: number | null = null;
    if (pWhite?.elo_rating != null && pBlack?.elo_rating != null) {
      const K = 32;
      const eloW = Number(pWhite.elo_rating);
      const eloB = Number(pBlack.elo_rating);
      const expectedW = 1 / (1 + Math.pow(10, (eloB - eloW) / 400));
      const scoreW = effectiveResult === "white_wins" ? 1 : effectiveResult === "draw" ? 0.5 : 0;
      const scoreB = effectiveResult === "black_wins" ? 1 : effectiveResult === "draw" ? 0.5 : 0;
      newEloW = Math.max(0, Math.round(eloW + K * (scoreW - expectedW)));
      newEloB = Math.max(0, Math.round(eloB + K * (scoreB - (1 - expectedW))));
      if (userId === whiteId) eloChangeUser = newEloW - eloW;
      else if (userId === blackId) eloChangeUser = newEloB - eloB;
    }

    const totalWinningsWhite = bet > 0 && pWhite
      ? (effectiveResult === "white_wins" ? pWhite.total_winnings + Math.round(bet * 2 * (1 - HOUSE_CUT_PCT) * 100) / 100 - bet : pWhite.total_winnings)
      : (pWhite?.total_winnings ?? 0);
    const totalBetWhite = (pWhite?.total_bet_amount ?? 0) + (bet > 0 ? bet : 0);
    const totalWinningsBlack = bet > 0 && pBlack
      ? (effectiveResult === "black_wins" ? pBlack.total_winnings + Math.round(bet * 2 * (1 - HOUSE_CUT_PCT) * 100) / 100 - bet : pBlack.total_winnings)
      : (pBlack?.total_winnings ?? 0);
    const totalBetBlack = (pBlack?.total_bet_amount ?? 0) + (bet > 0 ? bet : 0);

    const whiteUpdate: Record<string, unknown> = {
      wins: winsWhite,
      losses: lossesWhite,
      draws: drawsWhite,
      total_winnings: totalWinningsWhite,
      total_bet_amount: totalBetWhite,
    };
    if (newEloW != null) whiteUpdate.elo_rating = newEloW;
    await supabase.from("profiles").update(whiteUpdate).eq("user_id", whiteId);

    const blackUpdate: Record<string, unknown> = {
      wins: winsBlack,
      losses: lossesBlack,
      draws: drawsBlack,
      total_winnings: totalWinningsBlack,
      total_bet_amount: totalBetBlack,
    };
    if (newEloB != null) blackUpdate.elo_rating = newEloB;
    await supabase.from("profiles").update(blackUpdate).eq("user_id", blackId);

    const bodyRes: { ok: boolean; result: string; eloChange?: number; amountWon?: number } = { ok: true, result: effectiveResult };
    if (eloChangeUser != null) bodyRes.eloChange = eloChangeUser;
    if (amountWonUser != null) bodyRes.amountWon = amountWonUser;
    return new Response(JSON.stringify(bodyRes), {
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
