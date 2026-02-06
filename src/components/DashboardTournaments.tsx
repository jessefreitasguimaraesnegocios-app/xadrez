import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Clock, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type TournamentStatus = "upcoming" | "in_progress" | "completed";

type TournamentRow = {
  id: string;
  name: string;
  format: string;
  status: TournamentStatus;
  max_participants: number;
  entry_fee: number | null;
  prize_pool: number | null;
  time_control: string;
  starts_at: string;
};

const statusMap: Record<TournamentStatus, "open" | "in_progress" | "finished"> = {
  upcoming: "open",
  in_progress: "in_progress",
  completed: "finished",
};

const formatLabels: Record<string, string> = {
  swiss: "Suíço",
  knockout: "Eliminação",
  round_robin: "Round Robin",
};

const DashboardTournaments = () => {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<(TournamentRow & { participants: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: rows, error } = await supabase
        .from("tournaments")
        .select("id, name, format, status, max_participants, entry_fee, prize_pool, time_control, starts_at")
        .in("status", ["upcoming", "in_progress"])
        .order("starts_at", { ascending: true })
        .limit(2);

      if (error || !rows?.length) {
        setTournaments([]);
        setLoading(false);
        return;
      }

      const ids = rows.map((r) => r.id);
      const { data: participants } = await supabase
        .from("tournament_participants")
        .select("tournament_id")
        .in("tournament_id", ids);

      const countByTournament: Record<string, number> = {};
      ids.forEach((id) => (countByTournament[id] = 0));
      (participants ?? []).forEach((p) => {
        countByTournament[p.tournament_id] = (countByTournament[p.tournament_id] ?? 0) + 1;
      });

      setTournaments(
        (rows as TournamentRow[]).map((r) => ({
          ...r,
          participants: countByTournament[r.id] ?? 0,
        }))
      );
      setLoading(false);
    };
    load();
  }, []);

  const handleJoin = (name: string, entryFee: number) => {
    toast({
      title: "Inscrito com sucesso!",
      description: `Você foi inscrito no torneio ${name}. Taxa de entrada: R$ ${entryFee}`,
    });
  };

  const statusColors = {
    open: "bg-bet-win/20 text-bet-win",
    in_progress: "bg-accent/20 text-accent",
    finished: "bg-muted text-muted-foreground",
  };
  const statusLabels = {
    open: "Aberto",
    in_progress: "Em andamento",
    finished: "Finalizado",
  };

  if (loading) {
    return (
      <Card className="p-6 bg-card border-border">
        <h2 className="font-display font-bold text-xl mb-4">Torneios em Destaque</h2>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </Card>
    );
  }

  if (tournaments.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <h2 className="font-display font-bold text-xl mb-4">Torneios em Destaque</h2>
        <p className="text-sm text-muted-foreground mb-4">Nenhum torneio aberto no momento.</p>
        <Link to="/">
          <Button variant="outline" size="sm">Ver torneios</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border-border">
      <h2 className="font-display font-bold text-xl mb-4">Torneios em Destaque</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {tournaments.map((t) => {
          const status = statusMap[t.status as TournamentStatus];
          const startDate = new Date(t.starts_at);
          const isPast = startDate.getTime() < Date.now();
          const startTimeStr = isPast
            ? "Em andamento"
            : formatDistanceToNow(startDate, { addSuffix: true, locale: ptBR });
          const entryFee = Number(t.entry_fee ?? 0);
          const prizePool = Number(t.prize_pool ?? 0);
          return (
            <div
              key={t.id}
              className="p-5 rounded-xl bg-secondary/50 border border-border hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-lg">{t.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatLabels[t.format] ?? t.format} • {t.time_control}
                  </p>
                </div>
                <Badge className={`font-medium ${statusColors[status]}`}>
                  {statusLabels[status]}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{t.participants}/{t.max_participants} jogadores</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{startTimeStr}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="w-4 h-4 text-rank-gold" />
                  <span className="rank-gold font-semibold">R$ {prizePool.toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Coins className="w-4 h-4 text-muted-foreground" />
                  <span>Entrada: R$ {entryFee.toLocaleString("pt-BR")}</span>
                </div>
              </div>
              <Button
                onClick={() => handleJoin(t.name, entryFee)}
                disabled={status !== "open"}
                className="w-full"
                variant={status === "open" ? "default" : "secondary"}
              >
                {status === "open" ? "Participar" : status === "in_progress" ? "Em andamento" : "Finalizado"}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default DashboardTournaments;
