import { useState } from "react";
import { cn } from "@/lib/utils";

const initialBoard = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  ["p", "p", "p", "p", "p", "p", "p", "p"],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["P", "P", "P", "P", "P", "P", "P", "P"],
  ["R", "N", "B", "Q", "K", "B", "N", "R"],
];

const pieceSymbols: Record<string, string> = {
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
};

interface ChessBoardProps {
  size?: "sm" | "md" | "lg";
}

const ChessBoard = ({ size = "md" }: ChessBoardProps) => {
  const [board, setBoard] = useState(initialBoard);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<[number, number][]>([]);

  const sizeClasses = {
    sm: "w-64 h-64",
    md: "w-[400px] h-[400px]",
    lg: "w-[560px] h-[560px]",
  };

  const squareSize = {
    sm: "w-8 h-8 text-xl",
    md: "w-[50px] h-[50px] text-3xl",
    lg: "w-[70px] h-[70px] text-4xl",
  };

  const handleSquareClick = (row: number, col: number) => {
    const piece = board[row][col];
    
    if (selected) {
      const [selRow, selCol] = selected;
      const selectedPiece = board[selRow][selCol];
      
      // Simple move validation (basic)
      if (selRow !== row || selCol !== col) {
        const newBoard = board.map(r => [...r]);
        newBoard[row][col] = selectedPiece;
        newBoard[selRow][selCol] = "";
        setBoard(newBoard);
      }
      
      setSelected(null);
      setPossibleMoves([]);
    } else if (piece) {
      setSelected([row, col]);
      // Basic possible moves (simplified - just show adjacent squares)
      const moves: [number, number][] = [];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && (dr !== 0 || dc !== 0)) {
            moves.push([nr, nc]);
          }
        }
      }
      setPossibleMoves(moves);
    }
  };

  const isLightSquare = (row: number, col: number) => (row + col) % 2 === 0;
  const isSelected = (row: number, col: number) => selected?.[0] === row && selected?.[1] === col;
  const isPossibleMove = (row: number, col: number) => 
    possibleMoves.some(([r, c]) => r === row && c === col);

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

  return (
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

      <div className={cn("grid grid-cols-8 rounded-lg overflow-hidden shadow-2xl glow-primary", sizeClasses[size])}>
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => handleSquareClick(rowIndex, colIndex)}
              className={cn(
                squareSize[size],
                "flex items-center justify-center transition-all duration-150 cursor-pointer hover:brightness-110",
                isLightSquare(rowIndex, colIndex) ? "chess-square-light" : "chess-square-dark",
                isSelected(rowIndex, colIndex) && "chess-square-highlight",
                isPossibleMove(rowIndex, colIndex) && "chess-square-move",
                piece && piece === piece.toUpperCase() ? "text-foreground drop-shadow-lg" : "text-background drop-shadow-lg"
              )}
            >
              {piece && pieceSymbols[piece]}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default ChessBoard;
