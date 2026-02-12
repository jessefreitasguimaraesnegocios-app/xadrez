import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Clock, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface TournamentCardProps {
  id: number | string;
  name: string;
  participants: number;
  maxParticipants: number;
  prizePool: number;
  entryFee: number;
  startTime: string;
  status: "open" | "in_progress" | "finished";
  format: string;
}

const TournamentCard = ({
  name,
  participants,
  maxParticipants,
  prizePool,
  entryFee,
  startTime,
  status,
  format,
}: TournamentCardProps) => {
  const { toast } = useToast();

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

  const handleJoin = () => {
    toast({
      title: "Inscrito com sucesso!",
      description: `Você foi inscrito no torneio ${name}. Taxa de entrada: R$ ${entryFee}`,
    });
  };

  return (
    <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all glow-primary">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg">{name}</h3>
          <p className="text-sm text-muted-foreground">{format}</p>
        </div>
        <Badge className={cn("font-medium", statusColors[status])}>
          {statusLabels[status]}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span>
            {participants}/{maxParticipants} jogadores
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span>{startTime}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-rank-gold" />
          <span className="rank-gold font-semibold">R$ {prizePool.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Coins className="w-4 h-4 text-muted-foreground" />
          <span>Entrada: R$ {entryFee}</span>
        </div>
      </div>

      <Button
        onClick={handleJoin}
        disabled={status !== "open"}
        className="w-full"
        variant={status === "open" ? "default" : "secondary"}
      >
        {status === "open" ? "Participar" : status === "in_progress" ? "Em andamento" : "Finalizado"}
      </Button>
    </div>
  );
};

export default TournamentCard;
