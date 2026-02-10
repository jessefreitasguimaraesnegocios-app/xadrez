import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Swords, MessageCircle, Search, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useGameInvites, type GameInviteWithFrom } from "@/hooks/useGameInvites";
import { useMyTournaments } from "@/hooks/useMyTournaments";
import { useUnreadBySender } from "@/hooks/useUnreadBySender";
import { supabase } from "@/integrations/supabase/client";
import FriendChatPanel from "@/components/FriendChatPanel";

type ProfileRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  elo_rating: number;
  is_online: boolean;
};

type FriendsListProps = {
  onStartGame?: (gameId: string) => void;
};

function GameInviteCard({
  invite,
  balanceAvailable,
  onAccept,
  onDecline,
  acceptingId,
  decliningId,
  displayName,
  tournamentBlock,
}: {
  invite: GameInviteWithFrom;
  balanceAvailable: number;
  onAccept: (asBet: boolean) => void;
  onDecline: () => void;
  acceptingId: string | null;
  decliningId: string | null;
  displayName: (p: { display_name: string | null; username: string }) => string;
  tournamentBlock?: { blocksPlaying: boolean; minutesLeft: number | null };
}) {
  const rawName = displayName({ display_name: invite.from_display_name, username: invite.from_username ?? "" });
  const name = typeof rawName === "string" && rawName && rawName !== "NaN" ? rawName : "Usuário";
  const hasBet = invite.bet_amount != null && invite.bet_amount > 0;
  const betNum = Number(invite.bet_amount);
  const betFormatted = hasBet && !Number.isNaN(betNum) ? betNum.toFixed(2) : "0.00";
  const canAcceptByBalance = !hasBet || balanceAvailable >= (invite.bet_amount ?? 0);
  const blocksPlaying = tournamentBlock?.blocksPlaying ?? false;
  const canAccept = canAcceptByBalance && !blocksPlaying;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/60 border border-border">
      <Avatar className="w-10 h-10">
        <AvatarImage src={invite.from_avatar_url ?? undefined} />
        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{name} te desafiou</p>
        <p className="text-xs text-muted-foreground">
          {hasBet ? `Partida apostada: R$ ${betFormatted}` : "Partida normal"}
        </p>
        {hasBet && !canAcceptByBalance && (
          <p className="text-xs text-destructive mt-0.5">Saldo insuficiente para aceitar</p>
        )}
        {blocksPlaying && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Aceitar bloqueado: torneio em breve</p>
        )}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <Button
          size="sm"
          variant="default"
          className="h-8 gap-1"
          onClick={() => onAccept(hasBet)}
          disabled={!canAccept || acceptingId === invite.id || decliningId === invite.id}
        >
          {acceptingId === invite.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceitar"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={onDecline}
          disabled={acceptingId === invite.id || decliningId === invite.id}
        >
          {decliningId === invite.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

const FriendsList = ({ onStartGame }: FriendsListProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { balance_available } = useWallet();
  const { blocksPlaying, minutesLeft } = useMyTournaments();
  const {
    receivedPending: gameInvitesReceived,
    sendInvite,
    acceptInvite,
    declineInvite,
    acceptingId,
    decliningId,
    BET_MIN,
    BET_MAX,
  } = useGameInvites();
  const [searchTerm, setSearchTerm] = useState("");
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<(ProfileRow & { friendshipId: string }) | null>(null);
  const [inviteType, setInviteType] = useState<"normal" | "bet">("normal");
  const [inviteBetInput, setInviteBetInput] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<(ProfileRow & { friendshipId: string })[]>([]);
  const [pendingReceived, setPendingReceived] = useState<(ProfileRow & { friendshipId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [chatFriend, setChatFriend] = useState<(ProfileRow & { friendshipId: string }) | null>(null);
  const unreadBySender = useUnreadBySender();

  const myUserId = user?.id ?? null;

  const loadFriendsAndPending = useCallback(async () => {
    if (!myUserId) {
      setFriends([]);
      setPendingReceived([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: friendships, error: fErr } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status")
      .or(`user_id.eq.${myUserId},friend_id.eq.${myUserId}`);

    if (fErr) {
      toast({ variant: "destructive", title: "Erro ao carregar amigos", description: fErr.message });
      setLoading(false);
      return;
    }

    const accepted = (friendships ?? []).filter((f) => f.status === "accepted");
    const pending = (friendships ?? []).filter((f) => f.status === "pending" && f.friend_id === myUserId);

    const otherUserIds = [
      ...new Set([
        ...accepted.map((f) => (f.user_id === myUserId ? f.friend_id : f.user_id)),
        ...pending.map((f) => f.user_id),
      ]),
    ];
    if (otherUserIds.length === 0) {
      setFriends([]);
      setPendingReceived([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, elo_rating, is_online")
      .in("user_id", otherUserIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p as ProfileRow]));

    setFriends(
      accepted
        .map((f) => {
          const otherId = f.user_id === myUserId ? f.friend_id : f.user_id;
          const pr = profileMap.get(otherId);
          return pr ? { ...pr, friendshipId: f.id } : null;
        })
        .filter((x): x is ProfileRow & { friendshipId: string } => x != null)
    );
    setPendingReceived(
      pending
        .map((f) => {
          const pr = profileMap.get(f.user_id);
          return pr ? { ...pr, friendshipId: f.id } : null;
        })
        .filter((x): x is ProfileRow & { friendshipId: string } => x != null)
    );
    setLoading(false);
  }, [myUserId, toast]);

  useEffect(() => {
    loadFriendsAndPending();
  }, [loadFriendsAndPending]);

  useEffect(() => {
    if (!myUserId) return;
    const channel = supabase
      .channel("friendships-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => loadFriendsAndPending()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUserId, loadFriendsAndPending]);

  useEffect(() => {
    if (!searchQuery.trim() || !myUserId) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const term = `%${searchQuery.trim()}%`;
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, elo_rating, is_online")
        .neq("user_id", myUserId)
        .or(`username.ilike.${term},display_name.ilike.${term}`)
        .limit(20);

      if (error) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      const { data: myFriendships } = await supabase
        .from("friendships")
        .select("user_id, friend_id")
        .or(`user_id.eq.${myUserId},friend_id.eq.${myUserId}`);

      const excludeIds = new Set(
        (myFriendships ?? []).map((f) => (f.user_id === myUserId ? f.friend_id : f.user_id))
      );
      setSearchResults((profiles ?? []).filter((p) => !excludeIds.has(p.user_id)) as ProfileRow[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, myUserId]);

  const handleSendRequest = async (friendUserId: string) => {
    if (!myUserId) return;
    setSendingId(friendUserId);
    const { error } = await supabase.from("friendships").insert({
      user_id: myUserId,
      friend_id: friendUserId,
      status: "pending",
    });
    setSendingId(null);
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
      return;
    }
    toast({ title: "Solicitação enviada!", description: "A pessoa receberá uma notificação." });
    setSearchResults((prev) => prev.filter((p) => p.user_id !== friendUserId));
  };

  const handleAccept = async (friendshipId: string) => {
    setRespondingId(friendshipId);
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    setRespondingId(null);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao aceitar", description: error.message });
      return;
    }
    toast({ title: "Aceito!", description: "Agora vocês são amigos." });
    await loadFriendsAndPending();
  };

  const handleDecline = async (friendshipId: string) => {
    setRespondingId(friendshipId);
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    setRespondingId(null);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao recusar", description: error.message });
      return;
    }
    toast({ title: "Solicitação recusada." });
    await loadFriendsAndPending();
  };

  const handleOpenInviteDialog = (friend: ProfileRow & { friendshipId: string }) => {
    setInviteTarget(friend);
    setInviteType("normal");
    setInviteBetInput("");
    setInviteDialogOpen(true);
  };

  const handleSendGameInvite = async () => {
    if (!inviteTarget || !myUserId) return;
    setSendingInvite(true);
    const bet = inviteType === "bet" ? parseFloat(inviteBetInput.replace(",", ".")) : null;
    if (inviteType === "bet" && (Number.isNaN(bet) || bet < BET_MIN || bet > BET_MAX)) {
      toast({ variant: "destructive", title: "Valor inválido", description: `Aposta entre R$ ${BET_MIN} e R$ ${BET_MAX}` });
      setSendingInvite(false);
      return;
    }
    const { error } = await sendInvite(inviteTarget.user_id, bet);
    setSendingInvite(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao enviar convite", description: error });
      return;
    }
    toast({
      title: "Convite enviado!",
      description: inviteType === "normal"
        ? `${inviteTarget.display_name || inviteTarget.username} foi convidado para uma partida normal.`
        : `Convite de partida apostada (R$ ${bet?.toFixed(2)}) enviado.`,
    });
    setInviteDialogOpen(false);
    setInviteTarget(null);
  };

  const displayName = (p: ProfileRow) => p.display_name || p.username;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl">Amigos</h2>
        <Dialog open={addFriendOpen} onOpenChange={setAddFriendOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" disabled={!user}>
              <UserPlus className="w-4 h-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Adicionar Amigo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou usuário..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary"
                />
              </div>
              {searching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!searching && searchQuery.trim() && (
                <ScrollArea className="h-[240px] rounded-md border border-border">
                  <div className="p-2 space-y-1">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
                    ) : (
                      searchResults.map((p) => (
                        <div
                          key={p.user_id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors"
                        >
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={p.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {(p.display_name || p.username).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{displayName(p)}</p>
                            <p className="text-xs text-muted-foreground">@{p.username} • {p.elo_rating} ELO</p>
                          </div>
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() => handleSendRequest(p.user_id)}
                            disabled={sendingId === p.user_id}
                          >
                            {sendingId === p.user_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4" />
                                Enviar
                              </>
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Chamar amigo para partida (normal ou apostada) */}
        <Dialog open={inviteDialogOpen} onOpenChange={(open) => { setInviteDialogOpen(open); if (!open) setInviteTarget(null); }}>
          <DialogContent className="bg-card sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">Chamar para partida</DialogTitle>
            </DialogHeader>
            {inviteTarget && (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Convidar <span className="font-medium text-foreground">{displayName(inviteTarget)}</span> para:
                </p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer rounded-md p-2 hover:bg-secondary/60">
                    <input
                      type="radio"
                      name="inviteType"
                      checked={inviteType === "normal"}
                      onChange={() => setInviteType("normal")}
                      className="rounded-full"
                    />
                    <span className="text-sm font-medium">Partida normal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer rounded-md p-2 hover:bg-secondary/60">
                    <input
                      type="radio"
                      name="inviteType"
                      checked={inviteType === "bet"}
                      onChange={() => setInviteType("bet")}
                      className="rounded-full"
                    />
                    <span className="text-sm font-medium">Partida apostada</span>
                  </label>
                  {inviteType === "bet" && (
                    <div className="pl-6 space-y-1">
                      <Label className="text-xs text-muted-foreground">Valor da aposta (R$)</Label>
                      <Input
                        type="number"
                        min={BET_MIN}
                        max={BET_MAX}
                        step={0.01}
                        placeholder={`${BET_MIN} - ${BET_MAX}`}
                        value={inviteBetInput}
                        onChange={(e) => setInviteBetInput(e.target.value)}
                        className="bg-secondary"
                      />
                    </div>
                  )}
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={handleSendGameInvite}
                  disabled={sendingInvite || (inviteType === "bet" && !inviteBetInput.trim())}
                >
                  {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                  Enviar convite
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Convites de partida recebidos */}
      {gameInvitesReceived.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Convites de partida</h3>
          <div className="space-y-2">
            {gameInvitesReceived.map((inv) => (
              <GameInviteCard
                key={inv.id}
                invite={inv}
                balanceAvailable={balance_available}
                onAccept={(asBet) => acceptInvite(inv, asBet, onStartGame)}
                onDecline={() => declineInvite(inv.id)}
                acceptingId={acceptingId}
                decliningId={decliningId}
                displayName={displayName}
                tournamentBlock={blocksPlaying ? { blocksPlaying, minutesLeft } : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Solicitações recebidas: notificação com nome e foto, aceitar ou recusar */}
      {pendingReceived.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Solicitações de amizade</h3>
          <div className="space-y-2">
            {pendingReceived.map((p) => (
              <div
                key={p.friendshipId}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/60 border border-border"
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {(p.display_name || p.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{displayName(p)}</p>
                  <p className="text-xs text-muted-foreground">@{p.username} quer ser seu amigo</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 gap-1"
                    onClick={() => handleAccept(p.friendshipId)}
                    disabled={respondingId === p.friendshipId}
                  >
                    {respondingId === p.friendshipId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Aceitar
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => handleDecline(p.friendshipId)}
                    disabled={respondingId === p.friendshipId}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar na sua lista..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-secondary"
        />
      </div>

      <ScrollArea className="h-[240px]">
        <div className="space-y-2 pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !user ? (
            <p className="text-sm text-muted-foreground text-center py-4">Faça login para ver seus amigos</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum amigo ainda. Use Adicionar para buscar usuários.</p>
          ) : (
            friends
              .filter(
                (f) =>
                  !searchTerm.trim() ||
                  displayName(f).toLowerCase().includes(searchTerm.toLowerCase()) ||
                  f.username.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((friend) => (
                <div
                  key={friend.friendshipId}
                  role="button"
                  tabIndex={0}
                  className="flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() => setChatFriend(friend)}
                  onKeyDown={(e) => e.key === "Enter" && setChatFriend(friend)}
                >
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={friend.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {(friend.display_name || friend.username).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
                        friend.is_online ? "bg-bet-win" : "bg-muted"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{displayName(friend)}</p>
                    <p className="text-xs text-muted-foreground">
                      {friend.elo_rating} ELO • {friend.is_online ? "Online" : "Offline"}
                    </p>
                  </div>
                  {unreadBySender[friend.user_id] > 0 && (
                    <span className="notification-badge min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold shrink-0">
                      {unreadBySender[friend.user_id] > 99 ? "99+" : unreadBySender[friend.user_id]}
                    </span>
                  )}
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 gap-1.5"
                      onClick={() => handleOpenInviteDialog(friend)}
                      disabled={!friend.is_online}
                      title={friend.is_online ? "Chamar para partida (normal ou apostada)" : "Amigo offline"}
                    >
                      <Swords className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">Desafiar</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => setChatFriend(friend)}
                      title="Conversar"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
          )}
        </div>
      </ScrollArea>

      {chatFriend && (
        <FriendChatPanel
          friend={{
            user_id: chatFriend.user_id,
            username: chatFriend.username,
            display_name: chatFriend.display_name,
            avatar_url: chatFriend.avatar_url,
          }}
          onClose={() => setChatFriend(null)}
        />
      )}
    </div>
  );
};

export default FriendsList;
