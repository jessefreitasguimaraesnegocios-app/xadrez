import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameState, Move, PieceColor } from "@/lib/chess";
import { replayMoveHistory, serializeMove, applyMoveToState } from "@/lib/chess";

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

export function useOnlineGame(gameId: string | null, userId: string | null) {
  const [game, setGame] = useState<OnlineGameRow | null>(null);
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);
  const [loading, setLoading] = useState(!!gameId);
  const [error, setError] = useState<string | null>(null);

  const gameState: GameState | null = game
    ? replayMoveHistory((game.move_history as { from: unknown; to: unknown; piece: unknown }[]) ?? [])
    : null;

  const playerColor: PieceColor | null =
    game && userId
      ? userId === game.white_player_id
        ? "white"
        : userId === game.black_player_id
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

    setGame(gameRow as OnlineGameRow);

    const whiteId = (gameRow as OnlineGameRow).white_player_id;
    const blackId = (gameRow as OnlineGameRow).black_player_id;
    const opponentId = userId === whiteId ? blackId : whiteId;
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
          const row = payload.new as OnlineGameRow;
          setGame((prev) => (prev ? { ...prev, ...row } : row));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const makeMove = useCallback(
    async (move: Move) => {
      if (!gameId || !game || !gameState || !userId) return;
      const history = (game.move_history as { from: unknown; to: unknown; piece: unknown }[]) ?? [];
      const serialized = serializeMove(move);
      const newHistory = [...history, serialized];
      const nextState = applyMoveToState(gameState, move);
      const updates: { move_history: unknown; status?: string; result?: string } = {
        move_history: newHistory,
      };
      if (nextState.isCheckmate) {
        updates.status = "completed";
        updates.result = nextState.currentTurn === "white" ? "black_wins" : "white_wins";
      } else if (nextState.isStalemate || nextState.isDraw) {
        updates.status = "completed";
        updates.result = "draw";
      }

      const { error: updateErr } = await supabase
        .from("games")
        .update(updates)
        .eq("id", gameId);

      if (updateErr) {
        setError(updateErr.message);
      }
    },
    [gameId, game, gameState, userId]
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
