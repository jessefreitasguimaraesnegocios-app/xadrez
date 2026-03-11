import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { withRetry, isRetryableError, SUPABASE_STAGGER } from "@/lib/supabaseRetry";

export type MyTournamentRow = {
  id: string;
  name: string;
  format: string;
  status: string;
  max_participants: number;
  entry_fee: number | null;
  prize_pool: number | null;
  time_control: string;
  starts_at: string;
  description: string | null;
  participants: number;
};

const BLOCK_MINUTES = 10;

export function useMyTournaments() {
  const { user } = useAuth();
  const [myTournaments, setMyTournaments] = useState<MyTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyTournaments = useCallback(async (userId: string, options?: { retryAndStagger?: boolean }) => {
    const run = async () => {
      const { data: participations, error: partErr } = await supabase
        .from("tournament_participants")
        .select("tournament_id")
        .eq("user_id", userId);

      if (partErr) {
        if (options?.retryAndStagger && isRetryableError(partErr)) throw partErr;
        setMyTournaments([]);
        return;
      }
      if (!participations?.length) {
        setMyTournaments([]);
        return;
      }

      const tournamentIds = participations.map((p) => p.tournament_id);
      const { data: tournaments, error: tErr } = await supabase
        .from("tournaments")
        .select("id, name, format, status, max_participants, entry_fee, prize_pool, time_control, starts_at, description")
        .in("id", tournamentIds)
        .in("status", ["upcoming", "in_progress"])
        .order("starts_at", { ascending: true });

      if (tErr) {
        if (options?.retryAndStagger && isRetryableError(tErr)) throw tErr;
        setMyTournaments([]);
        return;
      }
      if (!tournaments?.length) {
        setMyTournaments([]);
        return;
      }

      const { data: counts, error: cErr } = await supabase
        .from("tournament_participants")
        .select("tournament_id")
        .in("tournament_id", tournamentIds);

      if (cErr && options?.retryAndStagger && isRetryableError(cErr)) throw cErr;
      const countByT: Record<string, number> = {};
      tournamentIds.forEach((id) => (countByT[id] = 0));
      (counts ?? []).forEach((c) => {
        countByT[c.tournament_id] = (countByT[c.tournament_id] ?? 0) + 1;
      });

      setMyTournaments(
        (tournaments as Omit<MyTournamentRow, "participants">[]).map((t) => ({
          ...t,
          participants: countByT[t.id] ?? 0,
        }))
      );
    };
    if (options?.retryAndStagger) {
      try {
        await withRetry(run, { initialDelayMs: SUPABASE_STAGGER.myTournaments });
      } catch {
        setMyTournaments([]);
      }
    } else {
      await run();
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setMyTournaments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMyTournaments(user.id, { retryAndStagger: true }).finally(() => setLoading(false));

    const channel = supabase
      .channel("my-tournaments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_participants", filter: `user_id=eq.${user.id}` },
        () => fetchMyTournaments(user.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchMyTournaments]);

  const nextUpcoming = myTournaments.find((t) => t.status === "upcoming" && new Date(t.starts_at).getTime() > Date.now());
  const nextStartsAt = nextUpcoming ? new Date(nextUpcoming.starts_at).getTime() : null;
  const now = Date.now();
  const msLeft = nextStartsAt != null ? nextStartsAt - now : null;
  const minutesLeft = msLeft != null && msLeft > 0 ? Math.floor(msLeft / 60000) : null;
  const blocksPlaying = minutesLeft != null && minutesLeft <= BLOCK_MINUTES && minutesLeft >= 0;

  return {
    myTournaments,
    loading,
    nextStartsAt: nextStartsAt ? new Date(nextStartsAt) : null,
    minutesLeft,
    blocksPlaying,
    blockMinutes: BLOCK_MINUTES,
    refetch: user ? () => fetchMyTournaments(user.id) : () => {},
  };
}
