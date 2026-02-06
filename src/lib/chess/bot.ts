import type { GameState, PieceType, Square } from "./types";
import {
  getPieceAt,
  getLegalMoves,
  makeMove,
  isInCheck,
  isCheckmate,
} from "./moveValidation";

export type BotDifficulty =
  | "easy"
  | "normal"
  | "hard"
  | "very_hard"
  | "impossible";

const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

export interface BotMove {
  from: Square;
  to: Square;
  promotion?: PieceType;
}

function getAllLegalMoves(state: GameState): BotMove[] {
  const moves: BotMove[] = [];
  const color = state.currentTurn;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = getPieceAt(state.board, { row, col });
      if (!piece || piece.color !== color) continue;
      const toSquares = getLegalMoves(
        state.board,
        { row, col },
        state.castlingRights,
        state.enPassantTarget
      );
      for (const to of toSquares) {
        const from: Square = { row, col };
        if (piece.type === "pawn" && (to.row === 0 || to.row === 7)) {
          moves.push({ from, to, promotion: "queen" });
        } else {
          moves.push({ from, to });
        }
      }
    }
  }
  return moves;
}

function applyMove(
  state: GameState,
  move: BotMove
): (Piece | null)[][] {
  const board = makeMove(state.board, move.from, move.to);
  if (move.promotion) {
    const piece = board[move.to.row][move.to.col];
    if (piece)
      board[move.to.row][move.to.col] = { type: move.promotion, color: piece.color };
  }
  return board;
}

function materialEval(board: (Piece | null)[][]): number {
  let score = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = board[row][col];
      if (!p) continue;
      const v = PIECE_VALUES[p.type];
      score += p.color === "white" ? v : -v;
    }
  }
  return score;
}

function evaluateBoard(state: GameState, move: BotMove): number {
  const board = applyMove(state, move);
  let score = materialEval(board);
  const enemyColor = state.currentTurn === "white" ? "black" : "white";
  if (isCheckmate(board, enemyColor, state.castlingRights, null)) score += 1000;
  else if (isInCheck(board, enemyColor)) score += 50;
  if (isCheckmate(board, state.currentTurn, state.castlingRights, null)) score -= 1000;
  return state.currentTurn === "black" ? -score : score;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DEPTH: Record<BotDifficulty, number> = {
  easy: 0,
  normal: 0,
  hard: 1,
  very_hard: 2,
  impossible: 3,
};

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): number {
  const moves = getAllLegalMoves(state);
  if (depth === 0 || moves.length === 0) {
    return materialEval(state.board);
  }
  const enemyColor = state.currentTurn === "white" ? "black" : "white";
  const nextTurn = state.currentTurn === "white" ? "black" : "white";
  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const board = applyMove(state, move);
      const newState: GameState = {
        ...state,
        board,
        currentTurn: nextTurn,
      };
      const evalScore = minimax(newState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const board = applyMove(state, move);
      const newState: GameState = {
        ...state,
        board,
        currentTurn: nextTurn,
      };
      const evalScore = minimax(newState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function getBotMove(state: GameState, difficulty: BotDifficulty): BotMove | null {
  const moves = getAllLegalMoves(state);
  if (moves.length === 0) return null;

  const depth = DEPTH[difficulty];

  if (difficulty === "easy") {
    return pickRandom(moves);
  }

  if (difficulty === "normal") {
    const captures = moves.filter((m) => {
      const piece = getPieceAt(state.board, m.to);
      return piece !== null;
    });
    const pool = captures.length > 0 ? captures : moves;
    return pickRandom(pool);
  }

  let bestMove: BotMove = moves[0];
  let bestScore = difficulty === "hard" || difficulty === "very_hard" || difficulty === "impossible"
    ? (state.currentTurn === "black" ? Infinity : -Infinity)
    : 0;

  for (const move of moves) {
    const board = applyMove(state, move);
    const newState: GameState = {
      ...state,
      board,
      currentTurn: state.currentTurn === "white" ? "black" : "white",
    };
    const score = minimax(
      newState,
      depth,
      -Infinity,
      Infinity,
      true
    );
    const isBetter =
      state.currentTurn === "black"
        ? score < bestScore
        : score > bestScore;
    if (isBetter) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
