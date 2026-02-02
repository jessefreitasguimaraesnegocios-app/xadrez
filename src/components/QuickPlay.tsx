import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Zap, Timer, Infinity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const gameTypes = [
  {
    id: "bullet",
    name: "Bullet",
    time: "1 min",
    icon: Zap,
    description: "Partidas ultra-rápidas",
    color: "text-bet-lose",
  },
  {
    id: "blitz",
    name: "Blitz",
    time: "3+2",
    icon: Clock,
    description: "Ritmo acelerado",
    color: "text-accent",
  },
  {
    id: "rapid",
    name: "Rápida",
    time: "10 min",
    icon: Timer,
    description: "Tempo para pensar",
    color: "text-primary",
  },
  {
    id: "classical",
    name: "Clássica",
    time: "30 min",
    icon: Infinity,
    description: "Partida completa",
    color: "text-bet-win",
  },
];

interface QuickPlayProps {
  onStartGame: () => void;
}

const QuickPlay = ({ onStartGame }: QuickPlayProps) => {
  const { toast } = useToast();

  const handleSelectMode = (mode: typeof gameTypes[0]) => {
    toast({
      title: "Buscando partida...",
      description: `Procurando oponente para ${mode.name} (${mode.time})`,
    });
    onStartGame();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-xl">Jogar Agora</h2>
      <div className="grid grid-cols-2 gap-4">
        {gameTypes.map((type) => (
          <Card
            key={type.id}
            className="p-4 bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
            onClick={() => handleSelectMode(type)}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg bg-secondary group-hover:bg-primary/20 transition-colors`}>
                <type.icon className={`w-5 h-5 ${type.color}`} />
              </div>
              <div>
                <h3 className="font-display font-semibold">{type.name}</h3>
                <p className="text-sm text-muted-foreground">{type.time}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{type.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default QuickPlay;
