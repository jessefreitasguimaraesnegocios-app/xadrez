import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameState, Move, PieceColor } from "@/lib/chess";
import { replayMoveHistory, serializeMove, applyMoveToState } from "@/lib/chess";
import type { SerializedMove } from "@/lib/chess";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { timeControlToSeconds } from "@/lib/utils";

export type OnlineGameRow = {
  id: string;
  white_player_id: string | null;
  black_player_id: string | null;
  move_history: unknown;
  status: string;
  result: string | null;
  bet_amount?: number | null;
  time_control?: string | null;
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

  const fetchGame = useCallback(async (silent = false) => {
    if (!gameId) {
      setGame(null);
      setOpponent(null);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    const { data: gameRow, error: gameErr } = await supabase
      .from("games")
      .select("id, white_player_id, black_player_id, move_history, status, result, bet_amount, time_control")
      .eq("id", gameId)
      .single();

    if (gameErr || !gameRow) {
      if (!silent) {
        setError(gameErr?.message ?? "Partida não encontrada");
        setGame(null);
        setOpponent(null);
      }
      setLoading(false);
      return;
    }

    const row = gameRow as Record<string, unknown>;
    const normalized: OnlineGameRow = {
      id: String(row.id ?? ""),
      white_player_id: row.white_player_id != null ? String(row.white_player_id).trim().toLowerCase() : null,
      black_player_id: row.black_player_id != null ? String(row.black_player_id).trim().toLowerCase() : null,
      move_history: Array.isArray(row.move_history) ? row.move_history : [],
      status: String(row.status ?? "in_progress"),
      result: row.result != null ? String(row.result) : null,
      bet_amount: row.bet_amount != null && typeof row.bet_amount === "number" ? row.bet_amount : null,
      time_control: row.time_control != null ? String(row.time_control).trim() || null : null,
    };
    setGame(normalized);

    if (!silent) {
      const { whiteId: wId, blackId: bId } = getPlayerIds(normalized);
      const uidNorm = userId ? String(userId).trim().toLowerCase() : "";
      const opponentId = uidNorm && wId && bId ? (uidNorm === wId ? bId : uidNorm === bId ? wId : null) : null;
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
        () => fetchGame(true)
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") fetchGame(true);
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchGame(true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [gameId, fetchGame]);

  useEffect(() => {
    if (!gameId || !game) return;
    const interval = setInterval(() => fetchGame(true), 2000);
    return () => clearInterval(interval);
  }, [gameId, game?.id, fetchGame]);

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
      const betAmount = typeof current.bet_amount === "number" && current.bet_amount > 0 ? current.bet_amount : 0;
      const isGameOver = nextState.isCheckmate || nextState.isStalemate || nextState.isDraw;
      const result: string | null = nextState.isCheckmate
        ? (nextState.currentTurn === "white" ? "black_wins" : "white_wins")
        : nextState.isStalemate || nextState.isDraw
          ? "draw"
          : null;

      const updates: { move_history: SerializedMove[]; status?: string; result?: string } = {
        move_history: newHistory,
      };
      if (isGameOver && betAmount === 0) {
        updates.status = "completed";
        updates.result = result ?? "draw";
      }

      setGame((prev) =>
        prev
          ? {
              ...prev,
              move_history: newHistory,
              ...(isGameOver ? { status: "completed", result: result ?? "draw" } : {}),
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
        return;
      }

      if (isGameOver && result) {
        const { data: { session }, error: sessionErr } = await supabase.auth.refreshSession();
        if (session?.access_token) {
          const { error: finishErr } = await invokeEdgeFunction(
            { access_token: session.access_token },
            "finish-game",
            { gameId, result }
          );
          if (finishErr) {
            setError(finishErr.message);
          }
        } else if (sessionErr) {
          setError(sessionErr.message ?? "Sessão inválida para encerrar partida.");
        }
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
    betAmount: typeof game?.bet_amount === "number" && game.bet_amount > 0 ? game.bet_amount : null,
    timeControlSeconds: timeControlToSeconds(game?.time_control ?? null),
  };
}
