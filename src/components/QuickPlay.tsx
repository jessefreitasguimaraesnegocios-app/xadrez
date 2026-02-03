import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Zap, Timer, Infinity, Loader2, X } from "lucide-react";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const gameTypes = [
  {
    id: "bullet",
    name: "Bullet",
    time: "1+0",
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
    time: "10+0",
    icon: Timer,
    description: "Tempo para pensar",
    color: "text-primary",
  },
  {
    id: "classical",
    name: "Clássica",
    time: "30+0",
    icon: Infinity,
    description: "Partida completa",
    color: "text-bet-win",
  },
];

interface QuickPlayProps {
  onStartGame: () => void;
}

const QuickPlay = ({ onStartGame }: QuickPlayProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isSearching, matchFound, joinQueue, leaveQueue } = useMatchmaking();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  const handleSelectMode = async (mode: typeof gameTypes[0]) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setSelectedMode(mode.id);
    await joinQueue(mode.time);
  };

  const handleCancel = async () => {
    await leaveQueue();
    setSelectedMode(null);
  };

  // If match found, start the game
  if (matchFound) {
    onStartGame();
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display font-bold text-xl">Jogar Agora</h2>
      
      {isSearching ? (
        <Card className="p-6 bg-card border-primary/50 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                {gameTypes.find(t => t.id === selectedMode)?.icon && (
                  <span className="text-lg">
                    {(() => {
                      const Icon = gameTypes.find(t => t.id === selectedMode)?.icon;
                      return Icon ? <Icon className="w-5 h-5" /> : null;
                    })()}
                  </span>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg">Buscando oponente...</h3>
              <p className="text-sm text-muted-foreground">
                Modo: {gameTypes.find(t => t.id === selectedMode)?.name} ({gameTypes.find(t => t.id === selectedMode)?.time})
              </p>
            </div>
            <Button variant="outline" onClick={handleCancel} className="gap-2">
              <X className="w-4 h-4" />
              Cancelar busca
            </Button>
          </div>
        </Card>
      ) : (
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
      )}

      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>
            Faça login
          </Button>{' '}
          para jogar online
        </p>
      )}
    </div>
  );
};

export default QuickPlay;
