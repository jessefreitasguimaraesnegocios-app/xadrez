import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TournamentRow = {
  id: string;
  name: string;
  format: string;
  status: string;
  max_participants: number;
  entry_fee: number;
  prize_pool: number;
  time_control: string;
  starts_at: string;
  description: string | null;
  participants: number;
};

export function useTournaments() {
  const [open, setOpen] = useState<TournamentRow[]>([]);
  const [inProgress, setInProgress] = useState<TournamentRow[]>([]);
  const [finished, setFinished] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: tournaments, error } = await supabase
      .from("tournaments")
      .select("id, name, format, status, max_participants, entry_fee, prize_pool, time_control, starts_at, description")
      .in("status", ["upcoming", "in_progress", "completed"])
      .order("starts_at", { ascending: false });

    if (error) {
      setOpen([]);
      setInProgress([]);
      setFinished([]);
      setLoading(false);
      return;
    }

    const list = (tournaments ?? []) as Omit<TournamentRow, "participants">[];
    if (list.length === 0) {
      setOpen([]);
      setInProgress([]);
      setFinished([]);
      setLoading(false);
      return;
    }

    const ids = list.map((t) => t.id);
    const { data: counts } = await supabase
      .from("tournament_participants")
      .select("tournament_id")
      .in("tournament_id", ids);

    const countByT: Record<string, number> = {};
    ids.forEach((id) => (countByT[id] = 0));
    (counts ?? []).forEach((c: { tournament_id: string }) => {
      countByT[c.tournament_id] = (countByT[c.tournament_id] ?? 0) + 1;
    });

    const withCount: TournamentRow[] = list.map((t) => ({
      ...t,
      entry_fee: Number(t.entry_fee ?? 0),
      prize_pool: Number(t.prize_pool ?? 0),
      participants: countByT[t.id] ?? 0,
    }));

    const now = Date.now();
    const openList = withCount.filter((t) => t.status === "upcoming" && new Date(t.starts_at).getTime() > now);
    const inProgressList = withCount.filter((t) => t.status === "in_progress");
    const finishedList = withCount.filter((t) => t.status === "completed");

    setOpen(openList);
    setInProgress(inProgressList);
    setFinished(finishedList);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel("tournaments-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => fetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_participants" }, () => fetch())
      .subscribe();
    const onGenerated = () => fetch();
    window.addEventListener("tournaments-generated", onGenerated);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("tournaments-generated", onGenerated);
    };
  }, [fetch]);

  return { open, inProgress, finished, loading, refetch: fetch };
}
