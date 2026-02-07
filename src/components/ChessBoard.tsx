import { cn } from "@/lib/utils";
import { useChessGame, pieceSymbols, Square, type BotDifficulty } from "@/lib/chess";
import { playMoveSound, playCaptureSound } from "@/lib/sound";
import PromotionDialog from "./PromotionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useAppearance } from "@/contexts/AppearanceContext";

interface ChessBoardProps {
  size?: "sm" | "md" | "lg" | "xl";
  showControls?: boolean;
  botDifficulty?: BotDifficulty | null;
  onTurnChange?: (turn: "white" | "black") => void;
  onGameOver?: () => void;
  onNewGame?: () => void;
  /** Called once when the first move (white) is played. */
  onFirstMove?: () => void;
  /** When true, board does not accept moves (e.g. after resign/draw/time up). */
  disabled?: boolean;
}

const ChessBoard = ({ size = "md", showControls = true, botDifficulty = null, onTurnChange, onGameOver, onNewGame, onFirstMove, disabled = false }: ChessBoardProps) => {
  const { boardTheme, pieceStyle } = useAppearance();
  const {
    gameState,
    selectedSquare,
    legalMoves,
    promotionPending,
    selectSquare,
    handlePromotion,
    cancelPromotion,
    resetGame,
  } = useChessGame({
    botDifficulty,
    onTurnChange,
    onGameOver,
    onFirstMove,
    onMoveSound: (wasCapture) => (wasCapture ? playCaptureSound() : playMoveSound()),
  });

  const handleNewGame = () => {
    resetGame();
    onNewGame?.();
  };

  const sizeClasses = {
    sm: "w-64 h-64 shrink-0",
    md: "w-[400px] h-[400px] shrink-0",
    lg: "w-[560px] h-[560px] shrink-0",
    xl: "w-[min(80vmin,800px)] aspect-square max-w-full shrink-0",
  };

  const squareSize = {
    sm: "w-8 h-8 text-xl",
    md: "w-[50px] h-[50px] text-3xl",
    lg: "w-[70px] h-[70px] text-4xl",
    xl: "w-full h-full min-w-0 min-h-0 text-4xl sm:text-5xl",
  };

  const handleSquareClick = (row: number, col: number) => {
    if (disabled) return;
    if (gameState.isCheckmate || gameState.isStalemate) return;
    if (botDifficulty && gameState.currentTurn === "black") return;
    selectSquare({ row, col });
  };

  const isLightSquare = (row: number, col: number) => (row + col) % 2 === 0;
  const isSelected = (row: number, col: number) => 
    selectedSquare?.row === row && selectedSquare?.col === col;
  const isLegalMove = (row: number, col: number) => 
    legalMoves.some((m) => m.row === row && m.col === col);
  const isLastMove = (row: number, col: number) => {
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (!lastMove) return false;
    return (
      (lastMove.from.row === row && lastMove.from.col === col) ||
      (lastMove.to.row === row && lastMove.to.col === col)
    );
  };

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Game Status */}
      {showControls && (
        <div className="flex items-center gap-4">
          <Badge 
            variant={gameState.currentTurn === 'white' ? 'default' : 'secondary'}
            className="text-sm px-3 py-1"
          >
            {gameState.currentTurn === 'white' ? '⚪ Brancas' : '⚫ Pretas'}
          </Badge>
          
          {gameState.isCheck && !gameState.isCheckmate && (
            <Badge variant="destructive" className="text-sm px-3 py-1 animate-pulse">
              Xeque!
            </Badge>
          )}
          
          {gameState.isCheckmate && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              Xeque-mate! {gameState.currentTurn === 'white' ? 'Pretas' : 'Brancas'} vencem!
            </Badge>
          )}
          
          {gameState.isStalemate && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              Empate por afogamento!
            </Badge>
          )}
        </div>
      )}

      <div className="relative inline-block">
        {/* Rank labels */}
        <div className="absolute -left-6 top-0 h-full flex flex-col justify-around text-muted-foreground text-sm font-medium">
          {ranks.map((rank) => (
            <span key={rank}>{rank}</span>
          ))}
        </div>

        {/* File labels */}
        <div className="absolute -bottom-6 left-0 w-full flex justify-around text-muted-foreground text-sm font-medium">
          {files.map((file) => (
            <span key={file}>{file}</span>
          ))}
        </div>

        <div
          className={cn(
            "grid grid-cols-8 grid-rows-8 rounded-lg overflow-hidden shadow-2xl border-2 border-border",
            `board-theme-${boardTheme}`,
            sizeClasses[size],
            disabled && "pointer-events-none opacity-80"
          )}
        >
          {gameState.board.map((row, rowIndex) =>
            row.map((piece, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
                className={cn(
                  squareSize[size],
                  "flex items-center justify-center transition-all duration-150 cursor-pointer relative",
                  isLightSquare(rowIndex, colIndex)
                    ? "chess-square-light"
                    : "chess-square-dark",
                  isSelected(rowIndex, colIndex) && "chess-square-highlight",
                  isLastMove(rowIndex, colIndex) && "chess-square-last-move",
                  "hover:brightness-110"
                )}
              >
                {/* Legal move indicator */}
                {isLegalMove(rowIndex, colIndex) && (
                  <div
                    className={cn(
                      "absolute rounded-full",
                      piece
                        ? "w-full h-full border-4 border-accent/60"
                        : "w-3 h-3 bg-accent/60"
                    )}
                  />
                )}

                {/* Piece */}
                {piece && (
                  <span
                    className={cn(
                      "relative z-10 drop-shadow-lg select-none",
                      `piece-style-${pieceStyle}`,
                      piece.color === "white"
                        ? "text-foreground"
                        : "text-background"
                    )}
                  >
                    {pieceSymbols[piece.type][piece.color]}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Controls */}
      {showControls && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewGame}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Nova Partida
        </Button>
      )}

      {/* Promotion Dialog */}
      <PromotionDialog
        isOpen={!!promotionPending}
        color={gameState.currentTurn === 'white' ? 'black' : 'white'}
        onSelect={handlePromotion}
        onCancel={cancelPromotion}
      />
    </div>
  );
};

export default ChessBoard;
