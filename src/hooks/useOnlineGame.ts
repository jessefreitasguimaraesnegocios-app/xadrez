import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameState, Move, PieceColor } from "@/lib/chess";
import { replayMoveHistory, serializeMove, applyMoveToState } from "@/lib/chess";
import type { SerializedMove } from "@/lib/chess";

export type OnlineGameRow = {
  id: string;
  white_player_id: string | null;
  black_player_id: string | null;
  move_history: unknown;
  status: string;
  result: string | null;
  time_control?: string | null;
  white_remaining_time?: number | null;
  black_remaining_time?: number | null;
};

/** Parse time_control (e.g. "10+0", "3+2") to initial time in seconds. */
export function parseTimeControlToSeconds(tc: string | null | undefined): number {
  if (!tc || typeof tc !== "string") return 600;
  const m = tc.trim().match(/^(\d+)\s*\+\s*(\d+)$/);
  if (!m) return 600;
  const main = parseInt(m[1], 10);
  const inc = parseInt(m[2], 10);
  if (Number.isNaN(main) || main < 0) return 600;
  return main * 60 + (Number.isNaN(inc) ? 0 : inc);
}

export type OpponentInfo = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  elo_rating: number;
};

function getPlayerIds(row: OnlineGameRow | null): { whiteId: string; blackId: string } {
  if (!row) return { whiteId: "", blackId: "" };
  const whiteId = String((row as any).white_player_id ?? (row as any).whitePlayerId ?? "").trim();
  const blackId = String((row as any).black_player_id ?? (row as any).blackPlayerId ?? "").trim();
  return { whiteId, blackId };
}

export function useOnlineGame(gameId: string | null, userId: string | null) {
  const [game, setGame] = useState<OnlineGameRow | null>(null);
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);
  const [loading, setLoading] = useState(!!gameId);
  const [error, setError] = useState<string | null>(null);
  const gameRef = useRef<OnlineGameRow | null>(null);
  gameRef.current = game;

  const gameState: GameState | null = game
    ? replayMoveHistory((game.move_history as SerializedMove[]) ?? [])
    : null;

  const { whiteId, blackId } = getPlayerIds(game);
  const uid = userId ? String(userId).trim() : "";
  const playerColor: PieceColor | null =
    uid && whiteId && blackId
      ? uid === whiteId
        ? "white"
        : uid === blackId
          ? "black"
          : null
      : null;

  const isMyTurn =
    gameState && playerColor ? gameState.currentTurn === playerColor : false;

  const fetchGame = useCallback(async () => {
    if (!gameId) {
      setGame(null);
      setOpponent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data: gameRow, error: gameErr } = await supabase
      .from("games")
      .select("id, white_player_id, black_player_id, move_history, status, result, time_control, white_remaining_time, black_remaining_time")
      .eq("id", gameId)
      .single();

    if (gameErr || !gameRow) {
      setError(gameErr?.message ?? "Partida não encontrada");
      setGame(null);
      setOpponent(null);
      setLoading(false);
      return;
    }

    const row = gameRow as Record<string, unknown>;
    const initialSeconds = parseTimeControlToSeconds(row.time_control as string | undefined);
    const normalized: OnlineGameRow = {
      id: String(row.id ?? ""),
      white_player_id: row.white_player_id != null ? String(row.white_player_id) : null,
      black_player_id: row.black_player_id != null ? String(row.black_player_id) : null,
      move_history: Array.isArray(row.move_history) ? row.move_history : [],
      status: String(row.status ?? "in_progress"),
      result: row.result != null ? String(row.result) : null,
      time_control: row.time_control != null ? String(row.time_control) : "10+0",
      white_remaining_time:
        row.white_remaining_time != null && typeof row.white_remaining_time === "number"
          ? row.white_remaining_time
          : initialSeconds,
      black_remaining_time:
        row.black_remaining_time != null && typeof row.black_remaining_time === "number"
          ? row.black_remaining_time
          : initialSeconds,
    };
    setGame(normalized);

    const { whiteId: wId, blackId: bId } = getPlayerIds(normalized);
    const opponentId =
      userId && (String(userId) === wId ? bId : String(userId) === bId ? wId : null);
    if (opponentId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, elo_rating")
        .eq("user_id", opponentId)
        .single();
      setOpponent((profile as OpponentInfo) ?? null);
    } else {
      setOpponent(null);
    }
    setLoading(false);
  }, [gameId, userId]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const prev = gameRef.current;
          const initialSeconds = parseTimeControlToSeconds(raw?.time_control as string | undefined);
          const row: OnlineGameRow = {
            id: String(raw?.id ?? ""),
            white_player_id: raw?.white_player_id != null ? String(raw.white_player_id) : null,
            black_player_id: raw?.black_player_id != null ? String(raw.black_player_id) : null,
            move_history: raw?.move_history ?? [],
            status: String(raw?.status ?? ""),
            result: raw?.result != null ? String(raw.result) : null,
            time_control: raw?.time_control != null ? String(raw.time_control) : prev?.time_control ?? "10+0",
            white_remaining_time:
              raw?.white_remaining_time != null && typeof raw.white_remaining_time === "number"
                ? raw.white_remaining_time
                : prev?.white_remaining_time ?? initialSeconds,
            black_remaining_time:
              raw?.black_remaining_time != null && typeof raw.black_remaining_time === "number"
                ? raw.black_remaining_time
                : prev?.black_remaining_time ?? initialSeconds,
          };
          setGame((p) => (p ? { ...p, ...row } : row));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const initialTimeSeconds = game
    ? parseTimeControlToSeconds(game.time_control)
    : 600;
  const whiteRemainingTime =
    game?.white_remaining_time != null ? game.white_remaining_time : initialTimeSeconds;
  const blackRemainingTime =
    game?.black_remaining_time != null ? game.black_remaining_time : initialTimeSeconds;

  type MakeMoveOptions = { whiteRemainingSeconds?: number; blackRemainingSeconds?: number };

  const makeMove = useCallback(
    async (move: Move, options?: MakeMoveOptions) => {
      if (!gameId || !userId) return;
      const current = gameRef.current;
      if (!current || !gameState) return;
      const history = (current.move_history as SerializedMove[]) ?? [];
      const serialized = serializeMove(move);
      const newHistory = [...history, serialized];
      const nextState = applyMoveToState(gameState, move);
      const updates: {
        move_history: SerializedMove[];
        status?: string;
        result?: string;
        white_remaining_time?: number;
        black_remaining_time?: number;
      } = {
        move_history: newHistory,
      };
      if (options?.whiteRemainingSeconds != null) {
        updates.white_remaining_time = Math.max(0, Math.floor(options.whiteRemainingSeconds));
      }
      if (options?.blackRemainingSeconds != null) {
        updates.black_remaining_time = Math.max(0, Math.floor(options.blackRemainingSeconds));
      }
      if (nextState.isCheckmate) {
        updates.status = "completed";
        updates.result = nextState.currentTurn === "white" ? "black_wins" : "white_wins";
      } else if (nextState.isStalemate || nextState.isDraw) {
        updates.status = "completed";
        updates.result = "draw";
      }

      setGame((prev) =>
        prev
          ? {
              ...prev,
              ...updates,
              move_history: newHistory,
              ...(updates.white_remaining_time != null && { white_remaining_time: updates.white_remaining_time }),
              ...(updates.black_remaining_time != null && { black_remaining_time: updates.black_remaining_time }),
            }
          : prev
      );

      const { error: updateErr } = await supabase
        .from("games")
        .update(updates)
        .eq("id", gameId);

      if (updateErr) {
        setError(updateErr.message);
        setGame((prev) => (prev ? { ...prev, move_history: history } : prev));
      }
    },
    [gameId, gameState, userId]
  );

  return {
    gameState,
    playerColor,
    opponent,
    loading,
    error,
    isMyTurn,
    makeMove,
    refetch: fetchGame,
    whiteRemainingTime,
    blackRemainingTime,
    timeControlInitialSeconds: initialTimeSeconds,
  };
}
