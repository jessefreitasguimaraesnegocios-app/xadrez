import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface WalletState {
  balance_available: number;
  balance_locked: number;
  pending_withdrawals_sum: number;
  total: number;
}

export interface PendingWithdrawal {
  id: string;
  amount: number;
  status: string;
  scheduled_after: string;
  created_at: string;
}

export interface RecentWithdrawal {
  id: string;
  amount: number;
  status: string;
  scheduled_after: string;
  created_at: string;
  failure_reason: string | null;
}

export function useWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletState>({
    balance_available: 0,
    balance_locked: 0,
    pending_withdrawals_sum: 0,
    total: 0,
  });
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState<RecentWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async (userId: string) => {
    const { data: w, error: wErr } = await supabase
      .from("wallets")
      .select("balance_available, balance_locked")
      .eq("user_id", userId)
      .single();

    if (wErr) {
      setError(wErr.message);
      setWallet((prev) => ({ ...prev, balance_available: 0, balance_locked: 0 }));
      return;
    }

    const available = Number(w?.balance_available ?? 0);
    const locked = Number(w?.balance_locked ?? 0);

    const { data: withdrawals } = await supabase
      .from("withdrawals")
      .select("id, amount, status, scheduled_after, created_at")
      .eq("user_id", userId)
      .in("status", ["pending_review", "approved", "processing"]);

    const list = (withdrawals ?? []) as PendingWithdrawal[];
    setPendingWithdrawals(list);
    const pendingSum = list.reduce((s, x) => s + Number(x.amount), 0);

    const { data: recent } = await supabase
      .from("withdrawals")
      .select("id, amount, status, scheduled_after, created_at, failure_reason")
      .eq("user_id", userId)
      .in("status", ["completed", "failed"])
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentWithdrawals((recent ?? []) as RecentWithdrawal[]);

    setWallet({
      balance_available: available,
      balance_locked: locked,
      pending_withdrawals_sum: pendingSum,
      total: available + locked + pendingSum,
    });
    setError(null);
  }, []);

  useEffect(() => {
    if (!user) {
      setWallet({
        balance_available: 0,
        balance_locked: 0,
        pending_withdrawals_sum: 0,
        total: 0,
      });
      setPendingWithdrawals([]);
      setRecentWithdrawals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchWallet(user.id).finally(() => setLoading(false));

    const channel = supabase
      .channel("wallet-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        () => fetchWallet(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchWallet]);

  return {
    ...wallet,
    pendingWithdrawals,
    recentWithdrawals,
    loading,
    error,
    refetch: user ? () => fetchWallet(user.id) : () => {},
  };
}
