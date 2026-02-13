import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, Users, Clock, Coins, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  onJoinSuccess?: () => void;
}

const TournamentCard = ({
  id,
  name,
  participants,
  maxParticipants,
  prizePool,
  entryFee,
  startTime,
  status,
  format,
  onJoinSuccess,
}: TournamentCardProps) => {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [joining, setJoining] = useState(false);

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

  const handleConfirmJoin = async () => {
    setJoining(true);
    const { data, error } = await supabase
      .rpc("join_tournament_atomic", { p_tournament_id: String(id) });
    setJoining(false);
    setConfirmOpen(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao se inscrever",
        description: error.message,
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.ok === false && row.error_message) {
      toast({
        variant: "destructive",
        title: "Não foi possível se inscrever",
        description: row.error_message,
      });
      return;
    }

    toast({
      title: "Inscrito com sucesso!",
      description: entryFee > 0
        ? `R$ ${entryFee.toFixed(2)} foram descontados da sua carteira. Ao final do torneio, o campeão recebe o prêmio em dinheiro; demais participantes ganham pontos.`
        : `Você está inscrito no torneio ${name}.`,
    });
    onJoinSuccess?.();
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
        onClick={() => status === "open" && setConfirmOpen(true)}
        disabled={status !== "open"}
        className="w-full"
        variant={status === "open" ? "default" : "secondary"}
      >
        {status === "open" ? "Participar" : status === "in_progress" ? "Em andamento" : "Finalizado"}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar inscrição</AlertDialogTitle>
            <AlertDialogDescription>
              Inscrever-se em <strong>{name}</strong>? A taxa de entrada de{" "}
              <strong>R$ {entryFee.toFixed(2)}</strong> será descontada da sua carteira e somada ao prêmio do torneio.
              Ao final, o campeão recebe todo o valor em dinheiro (e pontos); os demais participantes ganham apenas pontos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={joining}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmJoin(); }}
              disabled={joining}
            >
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar e pagar entrada"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TournamentCard;
