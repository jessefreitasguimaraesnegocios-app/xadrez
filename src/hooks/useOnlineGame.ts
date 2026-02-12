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
  white_remaining_time?: number | null;
  black_remaining_time?: number | null;
  last_move_at?: string | null;
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

export type FinishReward = { eloChange?: number; amountWon?: number };

export function useOnlineGame(gameId: string | null, userId: string | null) {
  const [game, setGame] = useState<OnlineGameRow | null>(null);
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);
  const [loading, setLoading] = useState(!!gameId);
  const [error, setError] = useState<string | null>(null);
  const [lastFinishReward, setLastFinishReward] = useState<FinishReward | null>(null);
  const gameRef = useRef<OnlineGameRow | null>(null);
  const finishedGameIdRef = useRef<string | null>(null);
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
      .select("id, white_player_id, black_player_id, move_history, status, result, bet_amount, time_control, white_remaining_time, black_remaining_time, last_move_at")
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
      white_remaining_time: row.white_remaining_time != null && typeof row.white_remaining_time === "number" ? row.white_remaining_time : null,
      black_remaining_time: row.black_remaining_time != null && typeof row.black_remaining_time === "number" ? row.black_remaining_time : null,
      last_move_at: row.last_move_at != null ? String(row.last_move_at) : null,
    };
    setGame(normalized);

    if (normalized.status === "completed" && normalized.result && finishedGameIdRef.current !== gameId) {
      finishedGameIdRef.current = gameId;
      const { data: { session }, error: sessionErr } = await supabase.auth.refreshSession();
      if (session?.access_token) {
        const { data: finishData, error: finishErr } = await invokeEdgeFunction<{ ok?: boolean; eloChange?: number; amountWon?: number }>(
          { access_token: session.access_token },
          "finish-game",
          { gameId, result: normalized.result }
        );
        if (!finishErr && finishData && (finishData.eloChange != null || finishData.amountWon != null)) {
          setLastFinishReward({ eloChange: finishData.eloChange, amountWon: finishData.amountWon });
        }
      }
    }

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
    setLastFinishReward(null);
    finishedGameIdRef.current = null;
  }, [gameId]);

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
    if (!gameId || !game || game.status !== "in_progress") return;
    const interval = setInterval(() => fetchGame(true), 1000);
    return () => clearInterval(interval);
  }, [gameId, game?.id, game?.status, fetchGame]);

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
      const isGameOver = nextState.isCheckmate || nextState.isStalemate || nextState.isDraw;
      const result: string | null = nextState.isCheckmate
        ? (nextState.currentTurn === "white" ? "black_wins" : "white_wins")
        : nextState.isStalemate || nextState.isDraw
          ? "draw"
          : null;

      setGame((prev) =>
        prev
          ? {
              ...prev,
              move_history: newHistory,
              ...(isGameOver ? { status: "completed", result: result ?? "draw" } : {}),
            }
          : prev
      );

      type MakeMoveResponse = {
        ok?: boolean;
        white_remaining_time?: number;
        black_remaining_time?: number;
        last_move_at?: string;
        status?: string;
        result?: string | null;
      };

      let session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        const { data: refreshData, error: sessionErr } = await supabase.auth.refreshSession();
        session = refreshData.session;
        if (sessionErr || !session?.access_token) {
          setError(sessionErr?.message ?? "Sessão expirada. Faça login novamente.");
          setGame((prev) => (prev ? { ...prev, move_history: history } : prev));
          return;
        }
      }

      let { data: moveData, error: moveErr } = await invokeEdgeFunction<MakeMoveResponse>(
        { access_token: session.access_token },
        "make-move",
        { gameId, move: serialized, ...(isGameOver && result ? { result } : {}) }
      );

      if (moveErr?.message?.toLowerCase().includes("unauthorized") && session.access_token) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        const newSession = refreshData?.session;
        if (newSession?.access_token) {
          const retry = await invokeEdgeFunction<MakeMoveResponse>(
            { access_token: newSession.access_token },
            "make-move",
            { gameId, move: serialized, ...(isGameOver && result ? { result } : {}) }
          );
          moveData = retry.data;
          moveErr = retry.error;
        }
      }

      if (moveErr) {
        setError(moveErr.message);
        setGame((prev) => (prev ? { ...prev, move_history: history } : prev));
        return;
      }

      if (moveData) {
        setGame((prev) =>
          prev
            ? {
                ...prev,
                move_history: newHistory,
                white_remaining_time: moveData.white_remaining_time ?? prev.white_remaining_time,
                black_remaining_time: moveData.black_remaining_time ?? prev.black_remaining_time,
                last_move_at: moveData.last_move_at ?? prev.last_move_at,
                status: moveData.status ?? prev.status,
                result: moveData.result ?? prev.result,
              }
            : prev
        );
      }

      if (moveData?.status === "completed" && moveData?.result) {
        finishedGameIdRef.current = gameId;
        const s2 = (await supabase.auth.getSession()).data.session ?? session;
        if (s2?.access_token) {
          const { data: finishData, error: finishErr } = await invokeEdgeFunction<{ ok?: boolean; eloChange?: number; amountWon?: number }>(
            { access_token: s2.access_token },
            "finish-game",
            { gameId, result: moveData.result }
          );
          if (finishErr) {
            setError(finishErr.message);
          } else if (finishData && (finishData.eloChange != null || finishData.amountWon != null)) {
            setLastFinishReward({
              eloChange: finishData.eloChange,
              amountWon: finishData.amountWon,
            });
          }
        }
      }
    },
    [gameId, userId]
  );

  return {
    game,
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
    lastFinishReward,
  };
}
