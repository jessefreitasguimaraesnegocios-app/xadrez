import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Coins, AlertTriangle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BettingPanelProps {
  playerName: string;
  playerRating: number;
  opponentName: string;
  opponentRating: number;
  minBet?: number;
  maxBet?: number;
  /** Quando a partida já é apostada (ex.: desafio com amigo), exibe os dados da aposta */
  matchBetAmount?: number | null;
  /** Partida encerrada: exibe resultado (white_wins, black_wins, draw) */
  isGameOver?: boolean;
  result?: string | null;
}

const BettingPanel = ({
  playerName,
  playerRating,
  opponentName,
  opponentRating,
  minBet = 10,
  maxBet = 1000,
  matchBetAmount,
  isGameOver,
  result,
}: BettingPanelProps) => {
  const [betAmount, setBetAmount] = useState(minBet);
  const [confirmed, setConfirmed] = useState(false);
  const { toast } = useToast();

  const isBetMatch = matchBetAmount != null && matchBetAmount > 0;
  const potentialWin = (isBetMatch ? matchBetAmount : betAmount) * 0.8;
  const platformFee = (isBetMatch ? matchBetAmount : betAmount) * 0.2;

  const handleConfirmBet = () => {
    setConfirmed(true);
    toast({
      title: "Aposta confirmada!",
      description: `Você apostou R$ ${betAmount}. Boa sorte!`,
    });
  };

  const handleSliderChange = (value: number[]) => {
    setBetAmount(value[0]);
  };

  const resultLabel = result === "white_wins" ? "Brancas vencem" : result === "black_wins" ? "Pretas vencem" : result === "draw" ? "Empate" : null;

  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Coins className="w-5 h-5 text-accent" />
        <h3 className="font-display font-bold text-lg">
          {isBetMatch ? "Partida apostada" : "Apostar na Partida"}
        </h3>
      </div>

      {/* Dados da aposta quando a partida já é apostada */}
      {isBetMatch && (
        <div className="mb-4 p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
          <p className="font-medium text-sm">Aposta da partida</p>
          <p className="text-2xl font-mono font-bold text-primary">R$ {Number(matchBetAmount).toFixed(2)}</p>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Potencial ganho (80%): R$ {(matchBetAmount * 0.8).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Taxa da plataforma (20%): R$ {(matchBetAmount * 0.2).toFixed(2)}</span>
          </div>
          {isGameOver && resultLabel && (
            <p className="pt-2 mt-2 border-t border-border font-medium text-foreground">
              Resultado: {resultLabel}
            </p>
          )}
        </div>
      )}

      {/* Players */}
      <div className="flex items-center justify-between mb-6 p-4 rounded-lg bg-secondary">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 ring-2 ring-bet-win">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {playerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{playerName}</p>
            <p className="text-sm text-muted-foreground">{playerRating} ELO</p>
          </div>
        </div>
        
        <span className="font-display font-bold text-2xl text-muted-foreground">VS</span>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-medium">{opponentName}</p>
            <p className="text-sm text-muted-foreground">{opponentRating} ELO</p>
          </div>
          <Avatar className="w-12 h-12 ring-2 ring-bet-lose">
            <AvatarFallback className="bg-muted text-muted-foreground">
              {opponentName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Formulário de nova aposta só quando a partida não é apostada */}
      {!isBetMatch && (
        <>
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Valor da Aposta</label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">R$</span>
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.min(maxBet, Math.max(minBet, Number(e.target.value))))}
                  className="w-24 bg-secondary text-right font-mono"
                  min={minBet}
                  max={maxBet}
                />
              </div>
            </div>
            <Slider
              value={[betAmount]}
              onValueChange={handleSliderChange}
              min={minBet}
              max={maxBet}
              step={10}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Min: R$ {minBet}</span>
              <span>Max: R$ {maxBet}</span>
            </div>
          </div>
          <div className="space-y-3 p-4 rounded-lg bg-muted mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-bet-win" />
                Potencial Ganho (80%)
              </span>
              <span className="font-mono font-semibold text-bet-win">R$ {potentialWin.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Taxa da plataforma (20%)</span>
              <span className="font-mono text-muted-foreground">R$ {platformFee.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 text-accent text-sm mb-4">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>Apostas são irrevogáveis após a confirmação. Jogue com responsabilidade.</p>
          </div>
          <Button
            onClick={handleConfirmBet}
            disabled={confirmed}
            className="w-full glow-accent"
            size="lg"
          >
            {confirmed ? "Aposta Confirmada" : `Confirmar Aposta de R$ ${betAmount}`}
          </Button>
        </>
      )}
    </div>
  );
};

export default BettingPanel;
