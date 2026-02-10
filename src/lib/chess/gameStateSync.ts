import {
  GameState,
  Move,
  Piece,
  PieceColor,
  PieceType,
  Square,
  CastlingRights,
  SerializedMove,
  INITIAL_BOARD,
} from './types';
import { getPieceAt, makeMove, isInCheck, isCheckmate, isStalemate } from './moveValidation';

const initialCastlingRights: CastlingRights = {
  whiteKingside: true,
  whiteQueenside: true,
  blackKingside: true,
  blackQueenside: true,
};

export function createInitialState(): GameState {
  return {
    board: INITIAL_BOARD.map((row) => row.map((p) => (p ? { ...p } : null))),
    currentTurn: 'white',
    castlingRights: { ...initialCastlingRights },
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    moveHistory: [],
  };
}

export function serializeMove(move: Move): SerializedMove {
  return {
    from: { row: move.from.row, col: move.from.col },
    to: { row: move.to.row, col: move.to.col },
    piece: { type: move.piece.type, color: move.piece.color },
    ...(move.promotion && { promotion: move.promotion }),
    ...(move.captured && { captured: { type: move.captured.type, color: move.captured.color } }),
  };
}

export function deserializeMove(m: SerializedMove): Move {
  const from: Square = { row: m.from.row, col: m.from.col };
  const to: Square = { row: m.to.row, col: m.to.col };
  const piece: Piece = { type: m.piece.type, color: m.piece.color };
  const captured = m.captured ? { type: m.captured.type, color: m.captured.color } as Piece : undefined;
  return { from, to, piece, captured, promotion: m.promotion };
}

/** Aplica um movimento a um GameState e retorna o novo estado (para replay/sync). */
export function applyMoveToState(state: GameState, move: Move): GameState {
  const { board, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber, moveHistory } = state;
  const piece = getPieceAt(board, move.from);
  if (!piece) return state;
  const captured = getPieceAt(board, move.to);

  let newBoard = makeMove(board, move.from, move.to);
  if (move.promotion && piece.type === 'pawn') {
    newBoard = newBoard.map((row) => [...row]);
    newBoard[move.to.row][move.to.col] = { type: move.promotion, color: piece.color };
  }

  const newCastlingRights = { ...castlingRights };
  if (piece.type === 'king') {
    if (piece.color === 'white') {
      newCastlingRights.whiteKingside = false;
      newCastlingRights.whiteQueenside = false;
    } else {
      newCastlingRights.blackKingside = false;
      newCastlingRights.blackQueenside = false;
    }
  }
  if (piece.type === 'rook') {
    if (move.from.row === 7 && move.from.col === 0) newCastlingRights.whiteQueenside = false;
    if (move.from.row === 7 && move.from.col === 7) newCastlingRights.whiteKingside = false;
    if (move.from.row === 0 && move.from.col === 0) newCastlingRights.blackQueenside = false;
    if (move.from.row === 0 && move.from.col === 7) newCastlingRights.blackKingside = false;
  }

  let newEnPassant: Square | null = null;
  if (piece.type === 'pawn' && Math.abs(move.from.row - move.to.row) === 2) {
    newEnPassant = { row: (move.from.row + move.to.row) / 2, col: move.from.col };
  }

  const nextTurn: PieceColor = state.currentTurn === 'white' ? 'black' : 'white';
  const check = isInCheck(newBoard, nextTurn);
  const checkmate = isCheckmate(newBoard, nextTurn, newCastlingRights, newEnPassant);
  const stalemate = isStalemate(newBoard, nextTurn, newCastlingRights, newEnPassant);

  const fullMoveRecord: Move = {
    ...move,
    isCheck: check,
    isCheckmate: checkmate,
  };

  return {
    board: newBoard,
    currentTurn: nextTurn,
    castlingRights: newCastlingRights,
    enPassantTarget: newEnPassant,
    halfMoveClock: piece.type === 'pawn' || captured ? 0 : halfMoveClock + 1,
    fullMoveNumber: state.currentTurn === 'black' ? fullMoveNumber + 1 : fullMoveNumber,
    isCheck: check,
    isCheckmate: checkmate,
    isStalemate: stalemate,
    isDraw: stalemate || halfMoveClock >= 100,
    moveHistory: [...moveHistory, fullMoveRecord],
  };
}

/** Replay de move_history serializado para obter o GameState atual. */
export function replayMoveHistory(serializedHistory: SerializedMove[]): GameState {
  let state = createInitialState();
  for (const m of serializedHistory) {
    const move = deserializeMove(m);
    state = applyMoveToState(state, move);
  }
  return state;
}
