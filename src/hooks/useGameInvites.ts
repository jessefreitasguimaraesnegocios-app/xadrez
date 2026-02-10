import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export type GameInviteRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  bet_amount: number | null;
  time_control: string;
  status: string;
  created_at: string;
};

export type GameInviteWithFrom = GameInviteRow & {
  from_username: string;
  from_display_name: string | null;
  from_avatar_url: string | null;
};

const BET_MIN = 1;
const BET_MAX = 500;

export function useGameInvites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [receivedPending, setReceivedPending] = useState<GameInviteWithFrom[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const fetchReceivedPending = useCallback(async (userId: string) => {
    const { data: invites, error: invErr } = await supabase
      .from("game_invites")
      .select("id, from_user_id, to_user_id, bet_amount, time_control, status, created_at")
      .eq("to_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (invErr) {
      setReceivedPending([]);
      return;
    }
    if (!invites?.length) {
      setReceivedPending([]);
      return;
    }

    const fromIds = [...new Set((invites as GameInviteRow[]).map((i) => i.from_user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", fromIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    setReceivedPending(
      (invites as GameInviteRow[]).map((inv) => {
        const p = profileMap.get(inv.from_user_id);
        return {
          ...inv,
          from_username: p?.username ?? "",
          from_display_name: p?.display_name ?? null,
          from_avatar_url: p?.avatar_url ?? null,
        };
      }) as GameInviteWithFrom[]
    );
  }, []);

  useEffect(() => {
    if (!user) {
      setReceivedPending([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchReceivedPending(user.id).finally(() => setLoading(false));

    const channel = supabase
      .channel("game-invites-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_invites", filter: `to_user_id=eq.${user.id}` },
        () => fetchReceivedPending(user.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchReceivedPending]);

  const sendInvite = useCallback(
    async (toUserId: string, betAmount: number | null, timeControl: string = "10+0") => {
      if (!user) return { error: "Não autenticado" };
      const bet = betAmount != null && betAmount > 0 ? Math.round(Math.max(0, betAmount) * 100) / 100 : null;
      if (bet != null && (bet < BET_MIN || bet > BET_MAX)) {
        return { error: `Aposta deve ser entre R$ ${BET_MIN} e R$ ${BET_MAX}` };
      }
      const { error } = await supabase.from("game_invites").insert({
        from_user_id: user.id,
        to_user_id: toUserId,
        bet_amount: bet,
        time_control: timeControl,
        status: "pending",
      });
      if (error) return { error: error.message };
      return { error: null };
    },
    [user]
  );

  const acceptInvite = useCallback(
    async (invite: GameInviteWithFrom, asBet: boolean, onGameCreated?: (gameId: string) => void) => {
      if (!user || user.id !== invite.to_user_id) return;
      setAcceptingId(invite.id);

      const betAmount = asBet && invite.bet_amount != null && invite.bet_amount > 0 ? invite.bet_amount : 0;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast({ variant: "destructive", title: "Sessão expirada", description: "Faça login novamente." });
        setAcceptingId(null);
        return;
      }

      const { data, error } = await invokeEdgeFunction<{ id?: string; game_id?: string; error?: string }>(
        { access_token: token },
        "create-match",
        {
          whitePlayerId: invite.from_user_id,
          blackPlayerId: user.id,
          timeControl: invite.time_control || "10+0",
          betAmount,
        }
      );

      if (error || data?.error) {
        toast({
          variant: "destructive",
          title: "Erro ao aceitar",
          description: data?.error ?? error?.message ?? (betAmount > 0 ? "Saldo insuficiente para a aposta." : "Tente novamente."),
        });
        setAcceptingId(null);
        return;
      }

      const gameId = typeof data?.id === "string" ? data.id : (data && typeof data === "object" && "game_id" in data ? String((data as { game_id: string }).game_id) : null);
      await supabase.from("game_invites").update({ status: "accepted" }).eq("id", invite.id);
      setAcceptingId(null);
      toast({ title: "Convite aceito!", description: "Partida criada. Iniciando..." });
      if (gameId && onGameCreated) {
        onGameCreated(gameId);
      }
    },
    [user, toast]
  );

  const declineInvite = useCallback(
    async (inviteId: string) => {
      setDecliningId(inviteId);
      await supabase.from("game_invites").update({ status: "declined" }).eq("id", inviteId);
      setDecliningId(null);
    },
    []
  );

  return {
    receivedPending,
    loading,
    sendInvite,
    acceptInvite,
    declineInvite,
    acceptingId,
    decliningId,
    refetch: user ? () => fetchReceivedPending(user.id) : () => {},
    BET_MIN,
    BET_MAX,
  };
}
