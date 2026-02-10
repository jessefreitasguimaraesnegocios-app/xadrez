import { cn } from "@/lib/utils";
import { useChessGame, pieceSymbols, Square, type BotDifficulty, type PieceType } from "@/lib/chess";
import { playMoveSound, playCaptureSound } from "@/lib/sound";
import PromotionDialog from "./PromotionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useAppearance } from "@/contexts/AppearanceContext";

interface ChessBoardProps {
  size?: "sm" | "md" | "lg" | "xl";
  /** Em tela cheia o tabuleiro preenche o espaço disponível (max width/height). */
  fullscreen?: boolean;
  showControls?: boolean;
  botDifficulty?: BotDifficulty | null;
  /** When playing vs bot: which color the human plays. Board is flipped when black. */
  botPlayerColor?: "white" | "black";
  onTurnChange?: (turn: "white" | "black") => void;
  onGameOver?: () => void;
  onNewGame?: () => void;
  /** Called once when the first move (white) is played. */
  onFirstMove?: () => void;
  /** When true, board does not accept moves (e.g. after resign/draw/time up). */
  disabled?: boolean;
}

const ChessBoard = ({ size = "md", fullscreen = false, showControls = true, botDifficulty = null, botPlayerColor, onTurnChange, onGameOver, onNewGame, onFirstMove, disabled = false }: ChessBoardProps) => {
  const { boardTheme, pieceStyle } = useAppearance();
  const playerColor = botPlayerColor ?? "white";
  const flip = playerColor === "black";
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
    playerColor,
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
    sm: "w-72 h-72 shrink-0",
    md: "w-[420px] h-[420px] shrink-0",
    lg: "w-[600px] h-[600px] shrink-0",
    xl: fullscreen
      ? "w-full h-full min-w-0 min-h-0 max-w-full max-h-full aspect-square"
      : "w-full aspect-square max-w-[800px] min-w-0 shrink-0",
  };

  const squareSize = {
    sm: "w-9 h-9 text-2xl",
    md: "w-[52px] h-[52px] text-3xl",
    lg: "w-[75px] h-[75px] text-4xl",
    xl: "w-full h-full min-w-0 min-h-0 text-[min(5rem,12vw)] sm:text-5xl",
  };

  /** Peças capturadas = 75% do tamanho da peça no tabuleiro */
  const capturedPieceSizeClass = {
    sm: "text-[1.125rem]",
    md: "text-[1.4rem]",
    lg: "text-[1.69rem]",
    xl: "text-[min(3.75rem,9vw)] sm:text-[2.25rem]",
  }[size];

  const toGame = (displayRow: number, displayCol: number): Square =>
    flip ? { row: 7 - displayRow, col: displayCol } : { row: displayRow, col: displayCol };
  const toDisplay = (gameRow: number, gameCol: number) =>
    flip ? { row: 7 - gameRow, col: gameCol } : { row: gameRow, col: gameCol };

  const handleSquareClick = (displayRow: number, displayCol: number) => {
    if (disabled) return;
    if (gameState.isCheckmate || gameState.isStalemate) return;
    if (botDifficulty && gameState.currentTurn !== playerColor) return;
    const { row, col } = toGame(displayRow, displayCol);
    selectSquare({ row, col });
  };

  const isLightSquare = (row: number, col: number) => (row + col) % 2 === 0;
  const isSelected = (displayRow: number, displayCol: number) => {
    if (!selectedSquare) return false;
    const d = toDisplay(selectedSquare.row, selectedSquare.col);
    return d.row === displayRow && d.col === displayCol;
  };
  const isLegalMove = (displayRow: number, displayCol: number) => {
    const { row, col } = toGame(displayRow, displayCol);
    return legalMoves.some((m) => m.row === row && m.col === col);
  };
  const isLastMove = (displayRow: number, displayCol: number) => {
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (!lastMove) return false;
    const { row, col } = toGame(displayRow, displayCol);
    return (
      (lastMove.from.row === row && lastMove.from.col === col) ||
      (lastMove.to.row === row && lastMove.to.col === col)
    );
  };

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = flip ? ["1", "2", "3", "4", "5", "6", "7", "8"] : ["8", "7", "6", "5", "4", "3", "2", "1"];

  const pieceTypeOrder: PieceType[] = ["pawn", "knight", "bishop", "rook", "queen"];
  const capturedByWhite = (gameState.moveHistory ?? [])
    .filter((m) => m.piece?.color === "white" && m.captured)
    .map((m) => m.captured!);
  const capturedByBlack = (gameState.moveHistory ?? [])
    .filter((m) => m.piece?.color === "black" && m.captured)
    .map((m) => m.captured!);

  const countByType = (list: { type: PieceType }[]) => {
    const c: Record<PieceType, number> = { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0, king: 0 };
    list.forEach((p) => { if (p.type !== "king") c[p.type]++; });
    return c;
  };

  const CapturedRow = ({ pieces, pieceColor, pieceSizeClass }: { pieces: { type: PieceType; color: "white" | "black" }[]; pieceColor: "white" | "black"; pieceSizeClass: string }) => {
    const counts = countByType(pieces);
    const textClass = pieceColor === "white" ? "text-foreground" : "text-black";
    const outlineClass = pieceColor === "white" ? "captured-outline-dark" : "captured-outline-white";
    return (
      <div className="flex flex-wrap items-center gap-0.5">
        {pieceTypeOrder.map((type) => {
          const n = counts[type];
          if (n === 0) return null;
          const symbol = pieceSymbols[type][pieceColor];
          const maxIcons = type === "pawn" ? 2 : Math.min(n, 2);
          const showNumber = n > 2 || (type === "pawn" && n > 2);
          return (
            <div key={type} className="relative inline-flex items-center justify-center gap-0.5">
              {Array.from({ length: maxIcons }, (_, i) => (
                <span key={i} className={cn("leading-none", pieceSizeClass, textClass, outlineClass, `piece-style-${pieceStyle}`)}>
                  {symbol}
                </span>
              ))}
              {showNumber && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] font-medium tabular-nums text-muted-foreground">
                  {n}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", size === "xl" && "w-full max-w-full", fullscreen && "h-full justify-center")}>
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

      <div className={cn("relative", size === "xl" ? (fullscreen ? "w-full h-full min-w-0 min-h-0" : "w-full") : "inline-block")}>
        <div className={cn("relative", size === "xl" ? "w-full h-full min-w-0 min-h-0" : "inline-block")}>
          <div
            className={cn(
              "grid grid-cols-8 grid-rows-8 rounded-lg overflow-hidden shadow-2xl border-2 border-border",
              `board-theme-${boardTheme}`,
              sizeClasses[size],
              disabled && "pointer-events-none opacity-80"
            )}
          >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((displayRow) =>
            [0, 1, 2, 3, 4, 5, 6, 7].map((displayCol) => {
              const { row: gr, col: gc } = toGame(displayRow, displayCol);
              const piece = gameState.board[gr][gc];
              return (
              <button
                key={`${displayRow}-${displayCol}`}
                onClick={() => handleSquareClick(displayRow, displayCol)}
                className={cn(
                  squareSize[size],
                  "flex items-center justify-center transition-all duration-150 cursor-pointer relative",
                  isLightSquare(displayRow, displayCol)
                    ? "chess-square-light"
                    : "chess-square-dark",
                  isSelected(displayRow, displayCol) && "chess-square-highlight",
                  isLastMove(displayRow, displayCol) && "chess-square-last-move",
                  "hover:brightness-110"
                )}
              >
                {/* Coordenadas dentro do quadrado: rank (esquerda) e file (embaixo) */}
                {displayCol === 0 && (
                  <span className="absolute left-0.5 top-0.5 text-[10px] sm:text-xs font-medium text-muted-foreground/90 select-none pointer-events-none">
                    {ranks[displayRow]}
                  </span>
                )}
                {displayRow === 7 && (
                  <span className="absolute right-0.5 bottom-0.5 text-[10px] sm:text-xs font-medium text-muted-foreground/90 select-none pointer-events-none">
                    {files[displayCol]}
                  </span>
                )}

                {/* Legal move indicator */}
                {isLegalMove(displayRow, displayCol) && (
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
            );
            })
          )}
          </div>
        </div>

        {/* Peças capturadas: logo abaixo do tabuleiro; no mobile mesma largura do board, no PC 31% */}
        <div className="mt-1.5 lg:mt-2 w-full lg:w-[31.25%] min-w-0 flex flex-col gap-1">
          <CapturedRow pieces={capturedByWhite} pieceColor="black" pieceSizeClass={capturedPieceSizeClass} />
          <CapturedRow pieces={capturedByBlack} pieceColor="white" pieceSizeClass={capturedPieceSizeClass} />
        </div>
      </div>

      {/* Nova Partida: só aparece quando a partida termina (xeque-mate, empate, desistência, tempo) */}
      {showControls && disabled && (
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
