import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bot } from "lucide-react";
import type { BotDifficulty } from "@/lib/chess";
import { useMyTournaments } from "@/hooks/useMyTournaments";
import { Alert, AlertDescription } from "@/components/ui/alert";

const DIFFICULTIES: { id: BotDifficulty; label: string; description: string }[] = [
  { id: "easy", label: "Fácil", description: "Jogadas aleatórias" },
  { id: "normal", label: "Normal", description: "Prefere capturas" },
  { id: "hard", label: "Difícil", description: "Pensa 1 jogada à frente" },
  { id: "very_hard", label: "Muito difícil", description: "Pensa 2 jogadas à frente" },
  { id: "impossible", label: "Impossível", description: "Pensa 3 jogadas à frente" },
];

interface PlayVsBotProps {
  onStartGame: (difficulty: BotDifficulty) => void;
}

const PlayVsBot = ({ onStartGame }: PlayVsBotProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BotDifficulty>("normal");
  const { blocksPlaying, minutesLeft, blockMinutes } = useMyTournaments();

  const handleStart = () => {
    if (blocksPlaying) return;
    onStartGame(selected);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-xl">Jogar com Bot</h2>
      {blocksPlaying && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertDescription>
            Seu torneio começa em {minutesLeft} min. Não é possível iniciar partidas nos últimos {blockMinutes} minutos antes do início.
          </AlertDescription>
        </Alert>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (next && blocksPlaying) return; setOpen(next); }}>
        <DialogTrigger asChild>
          <Card
            className={`p-4 bg-card border-border transition-all group ${
              blocksPlaying ? "opacity-60 cursor-not-allowed" : "hover:border-primary/50 cursor-pointer"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary group-hover:bg-primary/20 transition-colors">
                <Bot className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Contra o computador</h3>
                <p className="text-sm text-muted-foreground">Fácil, Normal, Difícil, Muito difícil ou Impossível</p>
              </div>
            </div>
          </Card>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha a dificuldade do bot</DialogTitle>
            <DialogDescription>
              Você joga com as brancas. O bot joga com as pretas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelected(d.id)}
                className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                  selected === d.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">{d.label}</span>
                <span className="text-sm text-muted-foreground">{d.description}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleStart} disabled={blocksPlaying}>Iniciar partida</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlayVsBot;
