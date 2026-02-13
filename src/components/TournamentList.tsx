import TournamentCard from "./TournamentCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyTournaments } from "@/hooks/useMyTournaments";
import { useTournaments } from "@/hooks/useTournaments";
import { TournamentCountdown } from "@/components/TournamentCountdown";
import { Trophy, Users, Coins, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formatLabels: Record<string, string> = {
  swiss: "Suíço",
  knockout: "Eliminação",
  round_robin: "Round Robin",
};

function formatStartTime(startsAt: string, status: string): string {
  if (status === "in_progress") return "Em andamento";
  if (status === "completed") return "Finalizado";
  const d = new Date(startsAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dDay.getTime() === today.getTime()) return `Hoje, ${time}`;
  if (dDay.getTime() === tomorrow.getTime()) return `Amanhã, ${time}`;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function toCardFormat(t: { id: string; name: string; format: string; status: string; time_control?: string; max_participants: number; entry_fee: number; prize_pool: number; starts_at: string; participants: number }) {
  const statusMap = { upcoming: "open" as const, in_progress: "in_progress" as const, completed: "finished" as const };
  return {
    id: t.id,
    name: t.name,
    participants: t.participants,
    maxParticipants: t.max_participants,
    prizePool: t.prize_pool,
    entryFee: t.entry_fee,
    startTime: formatStartTime(t.starts_at, t.status),
    status: statusMap[t.status as keyof typeof statusMap] ?? "open",
    format: `${formatLabels[t.format] ?? t.format} • ${t.time_control ?? ""}`.trim(),
  };
}

const TournamentList = () => {
  const { myTournaments, loading: myLoading } = useMyTournaments();
  const { open, inProgress, finished, loading: listLoading, refetch } = useTournaments();
  const openTournaments = open.map(toCardFormat);
  const inProgressTournaments = inProgress.map(toCardFormat);
  const finishedTournaments = finished.map(toCardFormat);

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-2xl">Torneios</h2>
      
      <Tabs defaultValue="open" className="w-full">
        <TabsList className="bg-secondary mb-4">
          <TabsTrigger value="mine">Meus torneios ({myTournaments.length})</TabsTrigger>
          <TabsTrigger value="open">Abertos ({openTournaments.length})</TabsTrigger>
          <TabsTrigger value="progress">Em andamento ({inProgressTournaments.length})</TabsTrigger>
          <TabsTrigger value="finished">Finalizados ({finishedTournaments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          <ScrollArea className="h-[500px] pr-4">
            {myLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                Carregando...
              </div>
            ) : myTournaments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Você não está inscrito em nenhum torneio. Inscreva-se em um torneio aberto para aparecer aqui.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {myTournaments.map((t) => {
                  const isUpcoming = t.status === "upcoming";
                  const startDate = new Date(t.starts_at);
                  const isFuture = startDate.getTime() > Date.now();
                  return (
                    <div
                      key={t.id}
                      className="p-5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-display font-bold text-lg">{t.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatLabels[t.format] ?? t.format} • {t.time_control}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "font-medium",
                            isUpcoming ? "bg-bet-win/20 text-bet-win" : "bg-accent/20 text-accent"
                          )}
                        >
                          {isUpcoming ? "Em breve" : "Em andamento"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {t.participants}/{t.max_participants} jogadores
                          </span>
                        </div>
                        {isUpcoming && isFuture && (
                          <TournamentCountdown startsAt={t.starts_at} />
                        )}
                        {(!isUpcoming || !isFuture) && (
                          <div className="flex items-center gap-2 text-sm text-accent">
                            Em andamento
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Trophy className="w-4 h-4 text-rank-gold" />
                          <span className="rank-gold font-semibold">
                            R$ {Number(t.prize_pool ?? 0).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Coins className="w-4 h-4 text-muted-foreground" />
                          <span>Entrada: R$ {Number(t.entry_fee ?? 0).toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                      {isUpcoming && isFuture && (
                        <div className="pt-2 border-t border-border">
                          <TournamentCountdown startsAt={t.starts_at} className="justify-center" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="open">
          <ScrollArea className="h-[500px] pr-4">
            {listLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                Carregando...
              </div>
            ) : openTournaments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum torneio aberto no momento. Se você é admin: em <strong>Administração → Torneios</strong>, crie templates e depois clique em <strong>&quot;Gerar torneios&quot;</strong> (só os torneios gerados aparecem aqui).
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {openTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} {...tournament} onJoinSuccess={refetch} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="progress">
          <ScrollArea className="h-[500px] pr-4">
            {listLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                Carregando...
              </div>
            ) : inProgressTournaments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum torneio em andamento.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {inProgressTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} {...tournament} onJoinSuccess={refetch} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="finished">
          <ScrollArea className="h-[500px] pr-4">
            {listLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                Carregando...
              </div>
            ) : finishedTournaments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum torneio finalizado.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {finishedTournaments.map((tournament) => (
                  <TournamentCard key={tournament.id} {...tournament} onJoinSuccess={refetch} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TournamentList;
