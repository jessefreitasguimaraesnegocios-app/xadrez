import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const move = body?.move;
    const gameOverResult = body?.result ?? null; // optional: "white_wins" | "black_wins" | "draw" (checkmate/stalemate/draw from client)

    if (!gameId || !move || !move.from || !move.to || !move.piece) {
      return new Response(
        JSON.stringify({ error: "gameId and move (from, to, piece) required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .select("id, white_player_id, black_player_id, status, move_history, white_remaining_time, black_remaining_time, last_move_at, started_at, bet_amount, time_control")
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

    const whiteId = game.white_player_id!;
    const blackId = game.black_player_id!;
    if (userId !== whiteId && userId !== blackId) {
      return new Response(JSON.stringify({ error: "You are not a player in this game" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const history = Array.isArray(game.move_history) ? game.move_history : [];
    const mover: "white" | "black" = history.length % 2 === 0 ? "white" : "black";
    const isWhite = userId === whiteId;
    if ((mover === "white" && !isWhite) || (mover === "black" && isWhite)) {
      return new Response(JSON.stringify({ error: "Not your turn" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const nowMs = now.getTime();
    const lastMoveAt = game.last_move_at ?? game.started_at ?? now.toISOString();
    const lastMoveMs = new Date(lastMoveAt).getTime();
    let elapsedSec = (nowMs - lastMoveMs) / 1000;
    if (elapsedSec < 0) elapsedSec = 0;
    if (history.length === 0) elapsedSec = 0;

    let whiteSec = Number(game.white_remaining_time ?? 0);
    let blackSec = Number(game.black_remaining_time ?? 0);
    if (whiteSec <= 0 && history.length === 0) {
      const tc = String(game.time_control ?? "10+0").trim();
      const m = tc.match(/^(\d+)/);
      const mins = m ? parseInt(m[1], 10) : 10;
      whiteSec = mins * 60;
      blackSec = mins * 60;
    }

    if (mover === "white") {
      whiteSec = Math.max(0, whiteSec - elapsedSec);
    } else {
      blackSec = Math.max(0, blackSec - elapsedSec);
    }

    let status = "in_progress";
    let result: string | null = null;

    if (whiteSec <= 0 || blackSec <= 0) {
      status = "completed";
      result = whiteSec <= 0 ? "black_wins" : "white_wins";
    } else if (gameOverResult && ["white_wins", "black_wins", "draw"].includes(gameOverResult)) {
      status = "completed";
      result = gameOverResult;
    }

    const newHistory = [...history, move];

    const updatePayload: Record<string, unknown> = {
      move_history: newHistory,
      white_remaining_time: Math.round(whiteSec),
      black_remaining_time: Math.round(blackSec),
      last_move_at: now.toISOString(),
      status,
      ...(result && { result }),
      ...(status === "completed" && { ended_at: now.toISOString() }),
    };

    const { error: updateErr } = await supabase
      .from("games")
      .update(updatePayload)
      .eq("id", gameId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Failed to update game", details: updateErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        white_remaining_time: Math.round(whiteSec),
        black_remaining_time: Math.round(blackSec),
        last_move_at: now.toISOString(),
        status,
        result,
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
