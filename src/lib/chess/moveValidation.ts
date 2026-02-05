import { Piece, PieceColor, Square, GameState, CastlingRights } from './types';

export const isValidSquare = (row: number, col: number): boolean => {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
};

export const getPieceAt = (board: (Piece | null)[][], square: Square): Piece | null => {
  return board[square.row][square.col];
};

export const isEnemy = (piece1: Piece | null, piece2: Piece | null): boolean => {
  if (!piece1 || !piece2) return false;
  return piece1.color !== piece2.color;
};

export const isSameColor = (piece1: Piece | null, piece2: Piece | null): boolean => {
  if (!piece1 || !piece2) return false;
  return piece1.color === piece2.color;
};

// Get all squares a piece can potentially move to (without considering check)
export const getRawMoves = (
  board: (Piece | null)[][],
  from: Square,
  castlingRights: CastlingRights,
  enPassantTarget: Square | null
): Square[] => {
  const piece = getPieceAt(board, from);
  if (!piece) return [];

  switch (piece.type) {
    case 'pawn':
      return getPawnMoves(board, from, piece.color, enPassantTarget);
    case 'knight':
      return getKnightMoves(board, from, piece.color);
    case 'bishop':
      return getBishopMoves(board, from, piece.color);
    case 'rook':
      return getRookMoves(board, from, piece.color);
    case 'queen':
      return getQueenMoves(board, from, piece.color);
    case 'king':
      return getKingMoves(board, from, piece.color, castlingRights);
    default:
      return [];
  }
};

const getPawnMoves = (
  board: (Piece | null)[][],
  from: Square,
  color: PieceColor,
  enPassantTarget: Square | null
): Square[] => {
  const moves: Square[] = [];
  const direction = color === 'white' ? -1 : 1;
  const startRow = color === 'white' ? 6 : 1;

  // Forward move
  const forwardRow = from.row + direction;
  if (isValidSquare(forwardRow, from.col) && !board[forwardRow][from.col]) {
    moves.push({ row: forwardRow, col: from.col });

    // Double move from starting position
    if (from.row === startRow) {
      const doubleRow = from.row + 2 * direction;
      if (!board[doubleRow][from.col]) {
        moves.push({ row: doubleRow, col: from.col });
      }
    }
  }

  // Captures
  for (const colOffset of [-1, 1]) {
    const captureCol = from.col + colOffset;
    if (isValidSquare(forwardRow, captureCol)) {
      const target = board[forwardRow][captureCol];
      if (target && target.color !== color) {
        moves.push({ row: forwardRow, col: captureCol });
      }
      
      // En passant
      if (enPassantTarget && enPassantTarget.row === forwardRow && enPassantTarget.col === captureCol) {
        moves.push({ row: forwardRow, col: captureCol });
      }
    }
  }

  return moves;
};

const getKnightMoves = (board: (Piece | null)[][], from: Square, color: PieceColor): Square[] => {
  const moves: Square[] = [];
  const offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];

  for (const [dr, dc] of offsets) {
    const newRow = from.row + dr;
    const newCol = from.col + dc;
    if (isValidSquare(newRow, newCol)) {
      const target = board[newRow][newCol];
      if (!target || target.color !== color) {
        moves.push({ row: newRow, col: newCol });
      }
    }
  }

  return moves;
};

const getSlidingMoves = (
  board: (Piece | null)[][],
  from: Square,
  color: PieceColor,
  directions: [number, number][]
): Square[] => {
  const moves: Square[] = [];

  for (const [dr, dc] of directions) {
    let row = from.row + dr;
    let col = from.col + dc;

    while (isValidSquare(row, col)) {
      const target = board[row][col];
      if (!target) {
        moves.push({ row, col });
      } else {
        if (target.color !== color) {
          moves.push({ row, col });
        }
        break;
      }
      row += dr;
      col += dc;
    }
  }

  return moves;
};

const getBishopMoves = (board: (Piece | null)[][], from: Square, color: PieceColor): Square[] => {
  return getSlidingMoves(board, from, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
};

const getRookMoves = (board: (Piece | null)[][], from: Square, color: PieceColor): Square[] => {
  return getSlidingMoves(board, from, color, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
};

const getQueenMoves = (board: (Piece | null)[][], from: Square, color: PieceColor): Square[] => {
  return [
    ...getBishopMoves(board, from, color),
    ...getRookMoves(board, from, color)
  ];
};

const getKingMoves = (
  board: (Piece | null)[][],
  from: Square,
  color: PieceColor,
  castlingRights: CastlingRights
): Square[] => {
  const moves: Square[] = [];
  
  // Normal king moves
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const newRow = from.row + dr;
      const newCol = from.col + dc;
      if (isValidSquare(newRow, newCol)) {
        const target = board[newRow][newCol];
        if (!target || target.color !== color) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }
  }

  // Castling
  const row = color === 'white' ? 7 : 0;
  if (from.row === row && from.col === 4) {
    // Kingside
    const canKingside = color === 'white' ? castlingRights.whiteKingside : castlingRights.blackKingside;
    if (canKingside && !board[row][5] && !board[row][6]) {
      moves.push({ row, col: 6 });
    }

    // Queenside
    const canQueenside = color === 'white' ? castlingRights.whiteQueenside : castlingRights.blackQueenside;
    if (canQueenside && !board[row][1] && !board[row][2] && !board[row][3]) {
      moves.push({ row, col: 2 });
    }
  }

  return moves;
};

// Find the king's position
export const findKing = (board: (Piece | null)[][], color: PieceColor): Square | null => {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'king' && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
};

// Check if a square is attacked by any enemy piece
export const isSquareAttacked = (
  board: (Piece | null)[][],
  square: Square,
  attackerColor: PieceColor
): boolean => {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === attackerColor) {
        const moves = getRawMoves(
          board,
          { row, col },
          { whiteKingside: false, whiteQueenside: false, blackKingside: false, blackQueenside: false },
          null
        );
        if (moves.some(m => m.row === square.row && m.col === square.col)) {
          return true;
        }
      }
    }
  }
  return false;
};

// Check if the king is in check
export const isInCheck = (board: (Piece | null)[][], color: PieceColor): boolean => {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  const enemyColor = color === 'white' ? 'black' : 'white';
  return isSquareAttacked(board, kingPos, enemyColor);
};

// Make a move on a copy of the board
export const makeMove = (
  board: (Piece | null)[][],
  from: Square,
  to: Square
): (Piece | null)[][] => {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[from.row][from.col];
  
  if (!piece) return newBoard;

  // Handle en passant capture
  if (piece.type === 'pawn' && from.col !== to.col && !newBoard[to.row][to.col]) {
    newBoard[from.row][to.col] = null;
  }

  // Handle castling
  if (piece.type === 'king' && Math.abs(from.col - to.col) === 2) {
    if (to.col === 6) {
      // Kingside
      newBoard[from.row][5] = newBoard[from.row][7];
      newBoard[from.row][7] = null;
    } else if (to.col === 2) {
      // Queenside
      newBoard[from.row][3] = newBoard[from.row][0];
      newBoard[from.row][0] = null;
    }
  }

  newBoard[to.row][to.col] = piece;
  newBoard[from.row][from.col] = null;

  return newBoard;
};

// Get all legal moves for a piece (considering check)
export const getLegalMoves = (
  board: (Piece | null)[][],
  from: Square,
  castlingRights: CastlingRights,
  enPassantTarget: Square | null
): Square[] => {
  const piece = getPieceAt(board, from);
  if (!piece) return [];

  const rawMoves = getRawMoves(board, from, castlingRights, enPassantTarget);
  const legalMoves: Square[] = [];

  for (const to of rawMoves) {
    const newBoard = makeMove(board, from, to);
    
    // Check if this move leaves our king in check
    if (!isInCheck(newBoard, piece.color)) {
      // For castling, also check if king passes through check
      if (piece.type === 'king' && Math.abs(from.col - to.col) === 2) {
        const passingCol = from.col + (to.col > from.col ? 1 : -1);
        const passingBoard = makeMove(board, from, { row: from.row, col: passingCol });
        const enemyColor = piece.color === 'white' ? 'black' : 'white';
        
        if (isInCheck(board, piece.color) || isInCheck(passingBoard, piece.color)) {
          continue;
        }
      }
      legalMoves.push(to);
    }
  }

  return legalMoves;
};

// Check if a player has any legal moves
export const hasLegalMoves = (
  board: (Piece | null)[][],
  color: PieceColor,
  castlingRights: CastlingRights,
  enPassantTarget: Square | null
): boolean => {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const moves = getLegalMoves(board, { row, col }, castlingRights, enPassantTarget);
        if (moves.length > 0) return true;
      }
    }
  }
  return false;
};

// Check for checkmate
export const isCheckmate = (
  board: (Piece | null)[][],
  color: PieceColor,
  castlingRights: CastlingRights,
  enPassantTarget: Square | null
): boolean => {
  return isInCheck(board, color) && !hasLegalMoves(board, color, castlingRights, enPassantTarget);
};

// Check for stalemate
export const isStalemate = (
  board: (Piece | null)[][],
  color: PieceColor,
  castlingRights: CastlingRights,
  enPassantTarget: Square | null
): boolean => {
  return !isInCheck(board, color) && !hasLegalMoves(board, color, castlingRights, enPassantTarget);
};
