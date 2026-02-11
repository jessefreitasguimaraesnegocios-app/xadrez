import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Zap, Timer, Infinity, Loader2, X, Wallet } from "lucide-react";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useMyTournaments } from "@/hooks/useMyTournaments";
import { useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";

const DEFAULT_BET = 5;
const MIN_BALANCE_TO_BET = 1;

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
  onStartGame: (gameId?: string | null) => void;
}

const QuickPlay = ({ onStartGame }: QuickPlayProps) => {
  const { user } = useAuth();
  const { balance_available } = useWallet();
  const { blocksPlaying, minutesLeft, blockMinutes } = useMyTournaments();
  const navigate = useNavigate();
  const { isSearching, matchFound, gameId, joinQueue, leaveQueue } = useMatchmaking();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  const canBet = user && balance_available >= MIN_BALANCE_TO_BET;
  const betAmount = canBet ? DEFAULT_BET : 0;

  const handleSelectMode = async (mode: typeof gameTypes[0]) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (blocksPlaying) return;
    if (balance_available < MIN_BALANCE_TO_BET) {
      navigate('/wallet');
      return;
    }

    setSelectedMode(mode.id);
    await joinQueue(mode.time, betAmount);
  };

  const handleCancel = async () => {
    await leaveQueue();
    setSelectedMode(null);
  };

  useEffect(() => {
    if (matchFound && gameId) {
      onStartGame(gameId);
    }
  }, [matchFound, gameId, onStartGame]);

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
        <>
          {blocksPlaying && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertDescription>
                Seu torneio começa em {minutesLeft} min. Não é possível entrar em partidas nos últimos {blockMinutes} minutos antes do início.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-4">
            {gameTypes.map((type) => (
              <Card
                key={type.id}
                className={`p-4 bg-card border-border transition-all group ${
                  blocksPlaying ? "opacity-60 cursor-not-allowed" : "hover:border-primary/50 cursor-pointer"
                }`}
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
        </>
      )}

      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>
            Faça login
          </Button>{' '}
          para jogar online
        </p>
      )}

      {user && balance_available < MIN_BALANCE_TO_BET && (
        <Card className="p-4 bg-muted/50 border-border text-center">
          <p className="text-sm text-muted-foreground mb-2">Saldo insuficiente para apostar.</p>
          <Link to="/wallet">
            <Button className="gap-2">
              <Wallet className="w-4 h-4" />
              Depositar para jogar
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-2">Aposta mínima: R$ {MIN_BALANCE_TO_BET.toFixed(2)} • Máxima: R$ 500,00</p>
        </Card>
      )}
    </div>
  );
};

export default QuickPlay;
