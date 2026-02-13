import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BettingStats = {
  totalWagered: number;
  totalWinnings: number;
  profit: number;
  winRatePct: number;
  loading: boolean;
};

export type BetHistoryItem = {
  gameId: string;
  opponentName: string;
  result: "win" | "loss" | "draw";
  bet: number;
  payout: number;
  endedAt: string | null;
};

export type ActiveBetGame = {
  gameId: string;
  playerName: string;
  playerRating: number;
  opponentName: string;
  opponentRating: number;
  betAmount: number;
  playerIsWhite: boolean;
};

export function useBettingStats(userId: string | undefined) {
  const [stats, setStats] = useState<BettingStats>({
    totalWagered: 0,
    totalWinnings: 0,
    profit: 0,
    winRatePct: 0,
    loading: true,
  });
  const [history, setHistory] = useState<BetHistoryItem[]>([]);
  const [activeGame, setActiveGame] = useState<ActiveBetGame | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeLoading, setActiveLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setStats((s) => ({ ...s, loading: false }));
      return;
    }
    setStats((s) => ({ ...s, loading: true }));
    const { data: txList } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", userId)
      .in("type", ["bet_lock", "bet_win", "bet_refund"])
      .eq("status", "completed");

    let totalWagered = 0;
    let totalWinnings = 0;
    let totalRefund = 0;
    (txList ?? []).forEach((row: { type: string; amount: number }) => {
      if (row.type === "bet_lock") totalWagered += Math.abs(Number(row.amount));
      if (row.type === "bet_win") totalWinnings += Number(row.amount);
      if (row.type === "bet_refund") totalRefund += Number(row.amount);
    });
    const profit = totalWinnings + totalRefund - totalWagered;

    const { data: completedGames } = await supabase
      .from("games")
      .select("id, result, white_player_id, black_player_id, bet_amount")
      .eq("status", "completed")
      .not("bet_amount", "is", null)
      .gt("bet_amount", 0)
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`);

    let wins = 0;
    let total = 0;
    (completedGames ?? []).forEach((g: { result: string | null; white_player_id: string | null; black_player_id: string | null }) => {
      if (!g.result || g.result === "abandoned") return;
      total += 1;
      const isWhite = g.white_player_id === userId;
      if (g.result === "white_wins" && isWhite) wins += 1;
      if (g.result === "black_wins" && !isWhite) wins += 1;
    });
    const winRatePct = total > 0 ? Math.round((wins / total) * 100) : 0;

    setStats({
      totalWagered,
      totalWinnings,
      profit,
      winRatePct,
      loading: false,
    });
  }, [userId]);

  const fetchHistory = useCallback(async () => {
    if (!userId) {
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    const { data: games } = await supabase
      .from("games")
      .select("id, result, white_player_id, black_player_id, bet_amount, ended_at")
      .eq("status", "completed")
      .not("bet_amount", "is", null)
      .gt("bet_amount", 0)
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
      .order("ended_at", { ascending: false })
      .limit(50);

    if (!games?.length) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    const opponentIds = new Set<string>();
    games.forEach((g: { white_player_id: string | null; black_player_id: string | null }) => {
      const o = g.white_player_id === userId ? g.black_player_id : g.white_player_id;
      if (o) opponentIds.add(o);
    });
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, elo_rating")
      .in("user_id", Array.from(opponentIds));

    const byId: Record<string, { display_name: string | null; username: string; elo_rating: number }> = {};
    (profiles ?? []).forEach((p: { user_id: string; display_name: string | null; username: string; elo_rating: number }) => {
      byId[p.user_id] = { display_name: p.display_name, username: p.username, elo_rating: p.elo_rating ?? 0 };
    });

    const items: BetHistoryItem[] = games.map((g: { id: string; result: string | null; white_player_id: string | null; black_player_id: string | null; bet_amount: number; ended_at: string | null }) => {
      const isWhite = g.white_player_id === userId;
      const oppId = isWhite ? g.black_player_id : g.white_player_id;
      const opp = oppId ? byId[oppId] : null;
      const opponentName = opp ? (opp.display_name || opp.username) : "Oponente";
      const bet = Number(g.bet_amount) || 0;
      let result: "win" | "loss" | "draw" = "draw";
      let payout = 0;
      if (g.result === "white_wins") {
        result = isWhite ? "win" : "loss";
        payout = isWhite ? bet * 0.8 : -bet;
      } else if (g.result === "black_wins") {
        result = isWhite ? "loss" : "win";
        payout = isWhite ? -bet : bet * 0.8;
      }
      return {
        gameId: g.id,
        opponentName,
        result,
        bet,
        payout,
        endedAt: g.ended_at,
      };
    });
    setHistory(items);
    setHistoryLoading(false);
  }, [userId]);

  const fetchActiveGame = useCallback(async () => {
    if (!userId) {
      setActiveLoading(false);
      return;
    }
    setActiveLoading(true);
    const { data: games } = await supabase
      .from("games")
      .select("id, white_player_id, black_player_id, bet_amount")
      .eq("status", "in_progress")
      .not("bet_amount", "is", null)
      .gt("bet_amount", 0)
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
      .limit(1);

    if (!games?.length) {
      setActiveGame(null);
      setActiveLoading(false);
      return;
    }

    const g = games[0];
    const isWhite = g.white_player_id === userId;
    const oppId = isWhite ? g.black_player_id : g.white_player_id;
    const myId = isWhite ? g.white_player_id : g.black_player_id;
    const ids = [oppId, myId].filter(Boolean) as string[];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, elo_rating")
      .in("user_id", ids);

    const byId: Record<string, { display_name: string | null; username: string; elo_rating: number }> = {};
    (profiles ?? []).forEach((p: { user_id: string; display_name: string | null; username: string; elo_rating: number }) => {
      byId[p.user_id] = { display_name: p.display_name, username: p.username, elo_rating: p.elo_rating ?? 0 };
    });
    const player = myId ? byId[myId] : null;
    const opponent = oppId ? byId[oppId] : null;
    setActiveGame({
      gameId: g.id,
      playerName: player ? (player.display_name || player.username) : "",
      playerRating: player?.elo_rating ?? 0,
      opponentName: opponent ? (opponent.display_name || opponent.username) : "Oponente",
      opponentRating: opponent?.elo_rating ?? 0,
      betAmount: Number(g.bet_amount) || 0,
      playerIsWhite: isWhite,
    });
    setActiveLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchActiveGame();
  }, [fetchActiveGame]);

  return {
    stats,
    history,
    activeGame,
    historyLoading,
    activeLoading,
    refetchStats: fetchStats,
    refetchHistory: fetchHistory,
    refetchActive: fetchActiveGame,
  };
}
