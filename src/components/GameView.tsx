import { useState, useCallback, useEffect, useRef } from "react";
import ChessBoard from "./ChessBoard";
import BettingPanel from "./BettingPanel";
import GameChat from "./GameChat";
import GameTimer from "./GameTimer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Flag, RotateCcw, Bot, Maximize2, Minimize2, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnlineGame } from "@/hooks/useOnlineGame";
import type { BotDifficulty } from "@/lib/chess";
import { cn } from "@/lib/utils";

const BOT_LABELS: Record<BotDifficulty, string> = {
  easy: "Fácil",
  normal: "Normal",
  hard: "Difícil",
  very_hard: "Muito difícil",
  impossible: "Impossível",
};

interface GameViewProps {
  withBetting?: boolean;
  gameId?: string | null;
  timeControl?: number; // in seconds (e.g., 600 for 10 minutes)
  isBotGame?: boolean;
  botDifficulty?: BotDifficulty | null;
  /** When playing vs bot: which color the human plays. Default white. */
  botPlayerColor?: "white" | "black";
  /** Chamado quando a partida termina (xeque-mate, empate, desistência, tempo). Usado para exibir de novo a barra inferior no mobile. */
  onGameOverChange?: (isOver: boolean) => void;
  /** Em partida vs bot: ao clicar em Nova Partida, chama isto (ex.: para sortear nova cor no modo aleatório). */
  onNewGameRequested?: () => void;
  /** Chamado quando a partida de fato começa (ex.: primeira jogada). Usado para esconder "Voltar ao menu" durante o jogo. */
  onGameStartedChange?: (started: boolean) => void;
}

const GameView = ({
  withBetting = false,
  gameId = null,
  timeControl = 600,
  isBotGame = false,
  botDifficulty = null,
  botPlayerColor = "white",
  onGameOverChange,
  onNewGameRequested,
  onGameStartedChange,
}: GameViewProps) => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const isOnlineGame = !!gameId && !isBotGame;
  const {
    game: onlineGame,
    gameState: onlineGameState,
    playerColor: onlinePlayerColor,
    opponent: onlineOpponent,
    loading: onlineLoading,
    error: onlineError,
    isMyTurn,
    makeMove,
    betAmount: onlineBetAmount,
    timeControlSeconds: onlineTimeControlSeconds,
    lastFinishReward,
  } = useOnlineGame(isOnlineGame ? gameId : null, user?.id ?? null);

  const effectiveTimeControl = isOnlineGame ? onlineTimeControlSeconds : timeControl;

  const [showBetting, setShowBetting] = useState(withBetting && !isBotGame);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerTime, setPlayerTime] = useState(effectiveTimeControl);
  const [opponentTime, setOpponentTime] = useState(effectiveTimeControl);
  const [serverWhiteDisplaySec, setServerWhiteDisplaySec] = useState<number | null>(null);
  const [serverBlackDisplaySec, setServerBlackDisplaySec] = useState<number | null>(null);
  const [timerResetKey, setTimerResetKey] = useState(0);
  const [hasClockStarted, setHasClockStarted] = useState(false);
  const [preGameCountdown, setPreGameCountdown] = useState(30);
  const preGameTimeUpFired = useRef(false);
  const [showGameChat, setShowGameChat] = useState(false);
  const [gameResult, setGameResult] = useState<'win' | 'lose' | 'draw' | null>(null);

  const opponentLabel =
    isBotGame && botDifficulty
      ? `Bot (${BOT_LABELS[botDifficulty]})`
      : isOnlineGame && onlineOpponent
        ? onlineOpponent.display_name || onlineOpponent.username
        : "Oponente";
  const opponentElo = isOnlineGame && onlineOpponent ? onlineOpponent.elo_rating : 1920;

  const handlePlayerTimeUp = useCallback(() => {
    if (isGameOver) return;
    setGameResult('lose');
    setIsGameOver(true);
    toast({
      variant: 'destructive',
      title: 'Tempo esgotado!',
      description: 'Você perdeu por tempo.',
    });
  }, [isGameOver]);

  const handleOpponentTimeUp = useCallback(() => {
    if (isGameOver) return;
    setGameResult('win');
    setIsGameOver(true);
    toast({
      title: 'Vitória!',
      description: 'Seu oponente perdeu por tempo.',
    });
  }, [isGameOver]);

  const handleResign = useCallback(() => {
    if (isGameOver) return;
    setGameResult('lose');
    setIsGameOver(true);
    toast({
      variant: "destructive",
      title: "Desistência",
      description: "Você desistiu. Vitória das pretas.",
    });
  }, [isGameOver]);

  const handleOfferDraw = useCallback(() => {
    if (isGameOver) return;
    setGameResult('draw');
    setIsGameOver(true);
    toast({
      title: "Empate",
      description: "Empate aceito. Partida encerrada.",
    });
  }, [isGameOver]);

  const handleTurnChange = useCallback(
    (turn: "white" | "black") => {
      const color = isBotGame ? botPlayerColor : isOnlineGame ? onlinePlayerColor : "white";
      setIsPlayerTurn(turn === color);
    },
    [isBotGame, botPlayerColor, isOnlineGame, onlinePlayerColor]
  );

  const handleFirstMove = useCallback(() => {
    setHasClockStarted(true);
    onGameStartedChange?.(true);
  }, [onGameStartedChange]);

  const handleNewGame = useCallback(() => {
    preGameTimeUpFired.current = false;
    setGameResult(null);
    setIsGameOver(false);
    setIsPlayerTurn(true);
    setPlayerTime(effectiveTimeControl);
    setOpponentTime(effectiveTimeControl);
    setTimerResetKey((k) => k + 1);
    setHasClockStarted(false);
    setPreGameCountdown(30);
  }, [effectiveTimeControl]);

  const handleBoardGameOver = useCallback(
    (result?: 'white_wins' | 'black_wins' | 'draw') => {
      const myColor = isBotGame ? botPlayerColor : (onlinePlayerColor ?? 'white');
      if (result === 'draw') {
        setGameResult('draw');
      } else if (result) {
        const won =
          (result === 'white_wins' && myColor === 'white') || (result === 'black_wins' && myColor === 'black');
        setGameResult(won ? 'win' : 'lose');
      }
      setIsGameOver(true);
    },
    [isBotGame, botPlayerColor, onlinePlayerColor]
  );

  useEffect(() => {
    if (hasClockStarted || isGameOver) return;
    setPlayerTime(effectiveTimeControl);
    setOpponentTime(effectiveTimeControl);
    setTimerResetKey((k) => k + 1);
  }, [effectiveTimeControl, hasClockStarted, isGameOver]);

  useEffect(() => {
    preGameTimeUpFired.current = false;
    setGameResult(null);
    setIsGameOver(false);
    setIsPlayerTurn(isBotGame ? botPlayerColor === "white" : true);
    setPreGameCountdown(30);
    // Em partida online o relógio só começa após a primeira jogada (handleFirstMove)
    if (isOnlineGame) {
      setHasClockStarted(false);
    } else if (isBotGame && botPlayerColor === "black") {
      setHasClockStarted(true);
    } else {
      setHasClockStarted(false);
    }
  }, [isBotGame, botDifficulty, botPlayerColor, isOnlineGame]);

  // Pre-game: 30s to make first move; if time runs out, cancel game
  useEffect(() => {
    if (hasClockStarted || isGameOver) return;
    const interval = setInterval(() => {
      setPreGameCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasClockStarted, isGameOver]);

  useEffect(() => {
    if (hasClockStarted || isGameOver || preGameCountdown > 0) return;
    if (preGameTimeUpFired.current) return;
    preGameTimeUpFired.current = true;
    setGameResult('lose');
    setIsGameOver(true);
    toast({
      variant: "destructive",
      title: "Partida cancelada",
      description: "Você não fez a primeira jogada a tempo (30s).",
    });
  }, [hasClockStarted, isGameOver, preGameCountdown, toast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    onGameOverChange?.(isGameOver);
  }, [isGameOver, onGameOverChange]);

  const onlineGameOver = isOnlineGame && onlineGameState && (onlineGameState.isCheckmate || onlineGameState.isStalemate || onlineGameState.isDraw);
  useEffect(() => {
    if (onlineGameOver) onGameOverChange?.(true);
  }, [onlineGameOver, onGameOverChange]);

  // Server-driven clock: display = server_remaining - (now - last_move_at) for active side
  useEffect(() => {
    if (!isOnlineGame || !onlineGame?.last_move_at || onlineGame.status !== "in_progress") {
      if (isOnlineGame && onlineGame?.status !== "in_progress") {
        setServerWhiteDisplaySec(onlineGame?.white_remaining_time ?? null);
        setServerBlackDisplaySec(onlineGame?.black_remaining_time ?? null);
      }
      return;
    }
    const lastMoveAtUnix = new Date(onlineGame.last_move_at).getTime() / 1000;
    const whiteSec = onlineGame.white_remaining_time ?? 0;
    const blackSec = onlineGame.black_remaining_time ?? 0;
    const isWhiteTurn = onlineGameState?.currentTurn === "white";

    const tick = () => {
      const nowSec = Date.now() / 1000;
      const elapsed = Math.max(0, nowSec - lastMoveAtUnix);
      setServerWhiteDisplaySec(Math.max(0, isWhiteTurn ? whiteSec - elapsed : whiteSec));
      setServerBlackDisplaySec(Math.max(0, !isWhiteTurn ? blackSec - elapsed : blackSec));
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [isOnlineGame, onlineGame?.last_move_at, onlineGame?.white_remaining_time, onlineGame?.black_remaining_time, onlineGame?.status, onlineGameState?.currentTurn]);

  // Sync isGameOver when server marks game completed (e.g. time, checkmate, draw)
  useEffect(() => {
    if (!isOnlineGame || !onlineGame || onlineGame.status !== "completed") return;
    const result = onlineGame.result;
    if (!result) return;
    setIsGameOver(true);
    if (result === "draw") {
      setGameResult("draw");
    } else {
      const myColor = onlinePlayerColor ?? "white";
      setGameResult((result === "white_wins" && myColor === "white") || (result === "black_wins" && myColor === "black") ? "win" : "lose");
    }
    onGameOverChange?.(true);
  }, [isOnlineGame, onlineGame?.status, onlineGame?.result, onlinePlayerColor, onGameOverChange]);

  // Online: clock is "started" once there is at least one move (e.g. we joined as black and white already moved)
  useEffect(() => {
    if (!isOnlineGame || !onlineGame) return;
    const moveCount = Array.isArray(onlineGame.move_history) ? onlineGame.move_history.length : 0;
    if (moveCount > 0) setHasClockStarted(true);
  }, [isOnlineGame, onlineGame?.move_history]);

  if (isOnlineGame && onlineLoading && !onlineGameState) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Carregando partida...</p>
      </div>
    );
  }
  if (isOnlineGame && onlineError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <p>{onlineError}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row gap-4 lg:gap-6",
        isFullscreen && "fixed inset-0 z-50 bg-background p-2 sm:p-4 overflow-auto flex-col"
      )}
    >
      {/* Main Game Area */}
      <div className={cn("flex-1 space-y-3 lg:space-y-4 min-w-0 flex flex-col", isFullscreen && "min-h-0")}>
        {/* Opponent Info */}
        <Card className={cn("bg-card border-border", isMobile ? "p-3" : "p-4")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                {isBotGame ? (
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <Bot className="w-5 h-5" />
                  </AvatarFallback>
                ) : isOnlineGame && onlineOpponent ? (
                  <>
                    <AvatarImage src={onlineOpponent.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {(onlineOpponent.display_name || onlineOpponent.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </>
                ) : (
                  <AvatarFallback className="bg-muted text-muted-foreground">OP</AvatarFallback>
                )}
              </Avatar>
              <div>
                <p className="font-medium">{opponentLabel}</p>
                <p className="text-sm text-muted-foreground">
                  {isBotGame ? "Jogador virtual" : `${opponentElo} ELO`}
                  {isOnlineGame && onlineBetAmount != null && (
                    <span className="ml-1 text-primary font-medium">• Aposta R$ {onlineBetAmount.toFixed(2)}</span>
                  )}
                </p>
              </div>
            </div>
            <GameTimer
              key={`opponent-timer-${timerResetKey}`}
              initialTime={opponentTime}
              isActive={hasClockStarted && !isGameOver && !isPlayerTurn && !isBotGame}
              isPlayer={false}
              onTimeUp={handleOpponentTimeUp}
              displayTime={isOnlineGame && serverWhiteDisplaySec != null && serverBlackDisplaySec != null
                ? (onlinePlayerColor === "white" ? serverBlackDisplaySec : serverWhiteDisplaySec)
                : undefined}
            />
          </div>
        </Card>

        {/* Chess Board */}
        <div className={cn("relative flex justify-center py-2 lg:py-4 w-full min-w-0", isFullscreen && "flex-1 min-h-0 items-center justify-center")}>
          <ChessBoard
            size={isFullscreen ? "xl" : isMobile ? "xl" : "lg"}
            fullscreen={isFullscreen}
            botDifficulty={botDifficulty}
            botPlayerColor={isBotGame ? botPlayerColor : isOnlineGame ? (onlinePlayerColor ?? undefined) : undefined}
            onTurnChange={handleTurnChange}
            onGameOver={handleBoardGameOver}
            onNewGame={onNewGameRequested ?? handleNewGame}
            onFirstMove={handleFirstMove}
            disabled={isGameOver || (isOnlineGame ? !isMyTurn || !!onlineGameState?.isCheckmate || !!onlineGameState?.isStalemate : false)}
            syncState={isOnlineGame ? onlineGameState ?? null : undefined}
            onMove={isOnlineGame ? makeMove : undefined}
          />
          {isGameOver && gameResult && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div
                className={cn(
                  "px-8 py-6 rounded-2xl shadow-2xl text-center font-display font-bold text-2xl sm:text-3xl border-2",
                  gameResult === "win" && "bg-primary text-primary-foreground border-primary",
                  gameResult === "lose" && "bg-destructive text-destructive-foreground border-destructive",
                  gameResult === "draw" && "bg-muted text-muted-foreground border-border"
                )}
              >
                {gameResult === "win" && "Você Ganhou"}
                {gameResult === "lose" && "Você Perdeu"}
                {gameResult === "draw" && "Empate"}
                {gameResult === "win" && isOnlineGame && lastFinishReward && (
                  <div className="mt-3 text-lg font-normal space-y-0.5">
                    {lastFinishReward.eloChange != null && lastFinishReward.eloChange !== 0 && (
                      <p className="tabular-nums">
                        {lastFinishReward.eloChange > 0 ? "+" : ""}{lastFinishReward.eloChange} ELO
                      </p>
                    )}
                    {lastFinishReward.amountWon != null && lastFinishReward.amountWon > 0 && (
                      <p className="tabular-nums">+R$ {lastFinishReward.amountWon.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Player Info */}
        <Card className={cn("bg-card border-border", isMobile ? "p-3" : "p-4")}>
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
            {hasClockStarted ? (
              <GameTimer
                key={`player-timer-${timerResetKey}`}
                initialTime={playerTime}
                isActive={hasClockStarted && !isGameOver && isPlayerTurn}
                isPlayer={true}
                onTimeUp={handlePlayerTimeUp}
                displayTime={isOnlineGame && serverWhiteDisplaySec != null && serverBlackDisplaySec != null
                  ? (onlinePlayerColor === "white" ? serverWhiteDisplaySec : serverBlackDisplaySec)
                  : undefined}
              />
            ) : (
              <div
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl transition-all duration-300 ring-2 ring-primary",
                  preGameCountdown <= 10 && "bg-destructive text-destructive-foreground animate-pulse",
                  preGameCountdown > 10 && "bg-secondary text-secondary-foreground"
                )}
                title="Faça sua primeira jogada em 30 segundos"
              >
                <span className="text-sm font-sans font-normal mr-1">1ª jogada:</span>
                {String(Math.floor(preGameCountdown / 60)).padStart(2, "0")}:
                {String(preGameCountdown % 60).padStart(2, "0")}
              </div>
            )}
          </div>
        </Card>

        {/* Game Controls */}
        <div className={cn("flex flex-wrap gap-2", isMobile && "gap-2")}>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          {isOnlineGame && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => setShowGameChat(true)}
              title="Chat da partida"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </Button>
          )}
          <Button
            variant="secondary"
            className="flex-1 gap-2 min-w-[140px]"
            onClick={handleOfferDraw}
            disabled={isGameOver}
          >
            <RotateCcw className="w-4 h-4" />
            Propor Empate
          </Button>
          <Button
            variant="destructive"
            className="flex-1 gap-2 min-w-[140px]"
            onClick={handleResign}
            disabled={isGameOver}
          >
            <Flag className="w-4 h-4" />
            Desistir
          </Button>
        </div>
      </div>

      {/* Betting Panel - oculto em tela cheia para dar espaço ao tabuleiro */}
      {showBetting && !isFullscreen && (
        <div className="lg:w-[360px]">
          <BettingPanel
            playerName={profile?.display_name || profile?.username || 'Você'}
            playerRating={profile?.elo_rating || 1200}
            opponentName={isOnlineGame && onlineOpponent ? (onlineOpponent.display_name || onlineOpponent.username) : 'Oponente'}
            opponentRating={isOnlineGame && onlineOpponent ? onlineOpponent.elo_rating : 1920}
            minBet={10}
            maxBet={500}
            matchBetAmount={isOnlineGame ? onlineBetAmount ?? null : null}
            isGameOver={isOnlineGame && !!onlineGameState && (onlineGameState.isCheckmate || onlineGameState.isStalemate || onlineGameState.isDraw)}
            result={isOnlineGame && onlineGameState ? (onlineGameState.isCheckmate ? (onlineGameState.currentTurn === 'white' ? 'black_wins' : 'white_wins') : (onlineGameState.isStalemate || onlineGameState.isDraw) ? 'draw' : null) : null}
            playerAvatarUrl={profile?.avatar_url ?? null}
            opponentAvatarUrl={isOnlineGame && onlineOpponent ? (onlineOpponent.avatar_url ?? null) : null}
          />
        </div>
      )}

      {/* Game Chat - oculto em tela cheia; botão "Chat" nos controles abre o painel */}
      {!isFullscreen && (
        <GameChat
          gameId={gameId}
          opponentUserId={isOnlineGame && onlineOpponent ? onlineOpponent.user_id : null}
          open={showGameChat}
          onOpenChange={setShowGameChat}
        />
      )}
    </div>
  );
};

export default GameView;
