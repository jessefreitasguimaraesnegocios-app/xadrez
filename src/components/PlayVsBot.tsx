import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Clock, Zap, Timer, Infinity } from "lucide-react";
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

const TIME_OPTIONS = [
  { id: "bullet", name: "Bullet", time: "1+0", seconds: 60, icon: Zap, description: "Partidas ultra-rápidas", color: "text-bet-lose" },
  { id: "blitz", name: "Blitz", time: "3+2", seconds: 180, icon: Clock, description: "Ritmo acelerado", color: "text-accent" },
  { id: "rapid", name: "Rápida", time: "10+0", seconds: 600, icon: Timer, description: "Tempo para pensar", color: "text-primary" },
  { id: "classical", name: "Clássica", time: "30+0", seconds: 1800, icon: Infinity, description: "Partida completa", color: "text-bet-win" },
];

export type BotPlayerColor = "white" | "black" | "random";

const COLOR_OPTIONS: { id: BotPlayerColor; label: string }[] = [
  { id: "white", label: "Brancas" },
  { id: "black", label: "Pretas" },
  { id: "random", label: "Aleatório" },
];

interface PlayVsBotProps {
  onStartGame: (difficulty: BotDifficulty, timeControlSeconds: number, playerColor: "white" | "black") => void;
}

const PlayVsBot = ({ onStartGame }: PlayVsBotProps) => {
  const { blocksPlaying, minutesLeft, blockMinutes } = useMyTournaments();
  const [expanded, setExpanded] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<BotDifficulty>("normal");
  const [selectedTimeId, setSelectedTimeId] = useState<string>("rapid");
  const [selectedColor, setSelectedColor] = useState<BotPlayerColor>("white");

  const selectedTime = TIME_OPTIONS.find((t) => t.id === selectedTimeId) ?? TIME_OPTIONS[2];

  const handleStart = () => {
    if (blocksPlaying) return;
    const color: "white" | "black" =
      selectedColor === "random" ? (Math.random() < 0.5 ? "white" : "black") : selectedColor;
    onStartGame(selectedDifficulty, selectedTime.seconds, color);
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
      <Card className="rounded-lg border text-card-foreground shadow-sm p-6 bg-card border-border">
        {!expanded ? (
          <button
            type="button"
            onClick={() => !blocksPlaying && setExpanded(true)}
            className={`w-full flex items-center gap-3 text-left rounded-lg transition-all group ${
              blocksPlaying ? "opacity-60 cursor-not-allowed" : "hover:border-primary/50 cursor-pointer"
            }`}
          >
            <div className="p-2 rounded-lg bg-secondary group-hover:bg-primary/20 transition-colors">
              <Bot className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Contra o computador</h3>
              <p className="text-sm text-muted-foreground">Escolha dificuldade e tempo de partida</p>
            </div>
          </button>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Bot className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-display font-semibold">Contra o computador</h3>
                  <p className="text-sm text-muted-foreground">Escolha a cor, dificuldade e o tempo:</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
                Fechar
              </Button>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Sua cor</p>
              <div className="flex gap-3 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <Card
                    key={c.id}
                    className={`rounded-lg border text-card-foreground shadow-sm px-4 py-3 bg-card border-border transition-all cursor-pointer ${
                      selectedColor === c.id ? "border-primary bg-primary/10" : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedColor(c.id)}
                  >
                    <span className="font-display font-semibold text-sm">{c.label}</span>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Dificuldade</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {DIFFICULTIES.map((d) => (
                  <Card
                    key={d.id}
                    className={`rounded-lg border text-card-foreground shadow-sm p-3 bg-card border-border transition-all group cursor-pointer ${
                      selectedDifficulty === d.id ? "border-primary bg-primary/10" : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedDifficulty(d.id)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Bot className="w-4 h-4 text-muted-foreground" />
                      <span className="font-display font-semibold text-sm">{d.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.description}</p>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Tempo da partida</p>
              <div className="grid grid-cols-2 gap-4">
                {TIME_OPTIONS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Card
                      key={t.id}
                      className={`rounded-lg border text-card-foreground shadow-sm p-4 bg-card border-border transition-all group cursor-pointer ${
                        selectedTimeId === t.id ? "border-primary bg-primary/10" : "hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedTimeId(t.id)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-secondary">
                          <Icon className={`w-5 h-5 ${t.color}`} />
                        </div>
                        <div>
                          <h3 className="font-display font-semibold">{t.name}</h3>
                          <p className="text-sm text-muted-foreground">{t.time}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </Card>
                  );
                })}
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleStart}
              disabled={blocksPlaying}
            >
              <Bot className="w-4 h-4" />
              Iniciar partida
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PlayVsBot;
