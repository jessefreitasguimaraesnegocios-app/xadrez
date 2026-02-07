import TournamentCard from "./TournamentCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyTournaments } from "@/hooks/useMyTournaments";
import { TournamentCountdown } from "@/components/TournamentCountdown";
import { Trophy, Users, Coins, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formatLabels: Record<string, string> = {
  swiss: "Suíço",
  knockout: "Eliminação",
  round_robin: "Round Robin",
};

const mockTournaments = [
  {
    id: 1,
    name: "Grande Prêmio Brasil",
    participants: 48,
    maxParticipants: 64,
    prizePool: 5000,
    entryFee: 50,
    startTime: "Hoje, 20:00",
    status: "open" as const,
    format: "Eliminação Simples • Blitz",
  },
  {
    id: 2,
    name: "Torneio Semanal",
    participants: 32,
    maxParticipants: 32,
    prizePool: 1500,
    entryFee: 25,
    startTime: "Em andamento",
    status: "in_progress" as const,
    format: "Suíço • Rápida",
  },
  {
    id: 3,
    name: "Arena Noturna",
    participants: 24,
    maxParticipants: 128,
    prizePool: 2000,
    entryFee: 10,
    startTime: "Amanhã, 21:00",
    status: "open" as const,
    format: "Arena • Bullet",
  },
  {
    id: 4,
    name: "Campeonato Mensal",
    participants: 64,
    maxParticipants: 64,
    prizePool: 10000,
    entryFee: 100,
    startTime: "Finalizado",
    status: "finished" as const,
    format: "Eliminação Dupla • Clássica",
  },
];

const TournamentList = () => {
  const { myTournaments, loading: myLoading } = useMyTournaments();
  const openTournaments = mockTournaments.filter((t) => t.status === "open");
  const inProgressTournaments = mockTournaments.filter((t) => t.status === "in_progress");
  const finishedTournaments = mockTournaments.filter((t) => t.status === "finished");

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
            <div className="grid gap-4 md:grid-cols-2">
              {openTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} {...tournament} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="progress">
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid gap-4 md:grid-cols-2">
              {inProgressTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} {...tournament} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="finished">
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid gap-4 md:grid-cols-2">
              {finishedTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} {...tournament} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TournamentList;
