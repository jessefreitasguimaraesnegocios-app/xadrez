import { useState } from "react";
import ChessBoard from "./ChessBoard";
import BettingPanel from "./BettingPanel";
import GameChat from "./GameChat";
import GameTimer from "./GameTimer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Flag, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface GameViewProps {
  withBetting?: boolean;
  gameId?: string | null;
  timeControl?: number; // in seconds (e.g., 600 for 10 minutes)
}

const GameView = ({ withBetting = false, gameId = null, timeControl = 600 }: GameViewProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [showBetting, setShowBetting] = useState(withBetting);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [playerTime, setPlayerTime] = useState(timeControl);
  const [opponentTime, setOpponentTime] = useState(timeControl);

  const handlePlayerTimeUp = () => {
    toast({
      variant: 'destructive',
      title: 'Tempo esgotado!',
      description: 'Você perdeu por tempo.',
    });
  };

  const handleOpponentTimeUp = () => {
    toast({
      title: 'Vitória!',
      description: 'Seu oponente perdeu por tempo.',
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Game Area */}
      <div className="flex-1 space-y-4">
        {/* Opponent Info */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-muted text-muted-foreground">OP</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">Oponente</p>
                <p className="text-sm text-muted-foreground">1920 ELO</p>
              </div>
            </div>
            <GameTimer
              initialTime={opponentTime}
              isActive={!isPlayerTurn}
              isPlayer={false}
              onTimeUp={handleOpponentTimeUp}
            />
          </div>
        </Card>

        {/* Chess Board */}
        <div className="flex justify-center py-4">
          <ChessBoard size="lg" />
        </div>

        {/* Player Info */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 ring-2 ring-primary">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {profile?.username?.slice(0, 2).toUpperCase() || 'VC'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{profile?.display_name || profile?.username || 'Você'}</p>
                <p className="text-sm text-muted-foreground">{profile?.elo_rating || 1200} ELO</p>
              </div>
            </div>
            <GameTimer
              initialTime={playerTime}
              isActive={isPlayerTurn}
              isPlayer={true}
              onTimeUp={handlePlayerTimeUp}
            />
          </div>
        </Card>

        {/* Game Controls */}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 gap-2">
            <RotateCcw className="w-4 h-4" />
            Propor Empate
          </Button>
          <Button variant="destructive" className="flex-1 gap-2">
            <Flag className="w-4 h-4" />
            Desistir
          </Button>
        </div>
      </div>

      {/* Betting Panel */}
      {showBetting && (
        <div className="lg:w-[360px]">
          <BettingPanel
            playerName={profile?.display_name || profile?.username || 'Você'}
            playerRating={profile?.elo_rating || 1200}
            opponentName="Oponente"
            opponentRating={1920}
            minBet={10}
            maxBet={500}
          />
        </div>
      )}

      {/* Game Chat */}
      <GameChat gameId={gameId} />
    </div>
  );
};

export default GameView;
