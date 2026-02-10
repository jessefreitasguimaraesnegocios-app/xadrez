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
};

export type OpponentInfo = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  elo_rating: number;
};

function getPlayerIds(row: OnlineGameRow | null): { whiteId: string; blackId: string } {
  if (!row) return { whiteId: "", blackId: "" };
  const whiteId = String((row as any).white_player_id ?? (row as any).whitePlayerId ?? "").trim().toLowerCase();
  const blackId = String((row as any).black_player_id ?? (row as any).blackPlayerId ?? "").trim().toLowerCase();
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
  const uid = userId ? String(userId).trim().toLowerCase() : "";
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
      .select("id, white_player_id, black_player_id, move_history, status, result")
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
    const normalized: OnlineGameRow = {
      id: String(row.id ?? ""),
      white_player_id: row.white_player_id != null ? String(row.white_player_id) : null,
      black_player_id: row.black_player_id != null ? String(row.black_player_id) : null,
      move_history: Array.isArray(row.move_history) ? row.move_history : [],
      status: String(row.status ?? "in_progress"),
      result: row.result != null ? String(row.result) : null,
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
          setGame((prev) => {
            const moveHistory = Array.isArray(raw?.move_history)
              ? raw.move_history
              : (prev ? (prev.move_history as unknown[]) ?? [] : []);
            const row: OnlineGameRow = {
              id: String(raw?.id ?? ""),
              white_player_id: raw?.white_player_id != null ? String(raw.white_player_id) : null,
              black_player_id: raw?.black_player_id != null ? String(raw.black_player_id) : null,
              move_history: moveHistory,
              status: String(raw?.status ?? ""),
              result: raw?.result != null ? String(raw.result) : null,
            };
            return prev ? { ...prev, ...row } : row;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const makeMove = useCallback(
    async (move: Move) => {
      if (!gameId || !userId) return;
      const current = gameRef.current;
      if (!current) return;
      const history = (current.move_history as SerializedMove[]) ?? [];
      const stateToUse = replayMoveHistory(history);
      const serialized = serializeMove(move);
      const newHistory = [...history, serialized];
      const nextState = applyMoveToState(stateToUse, move);
      const updates: { move_history: SerializedMove[]; status?: string; result?: string } = {
        move_history: newHistory,
      };
      if (nextState.isCheckmate) {
        updates.status = "completed";
        updates.result = nextState.currentTurn === "white" ? "black_wins" : "white_wins";
      } else if (nextState.isStalemate || nextState.isDraw) {
        updates.status = "completed";
        updates.result = "draw";
      }

      setGame((prev) => (prev ? { ...prev, ...updates, move_history: newHistory } : prev));

      const { error: updateErr } = await supabase
        .from("games")
        .update(updates)
        .eq("id", gameId);

      if (updateErr) {
        setError(updateErr.message);
        setGame((prev) => (prev ? { ...prev, move_history: history } : prev));
      }
    },
    [gameId, userId]
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
  };
}
