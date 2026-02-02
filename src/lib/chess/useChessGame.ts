import { useState, useCallback } from 'react';
import { 
  GameState, 
  Piece, 
  Square, 
  Move, 
  PieceColor, 
  PieceType,
  INITIAL_BOARD,
  CastlingRights 
} from './types';
import { 
  getLegalMoves, 
  makeMove as makeMoveOnBoard, 
  isInCheck, 
  isCheckmate, 
  isStalemate,
  getPieceAt
} from './moveValidation';

const initialCastlingRights: CastlingRights = {
  whiteKingside: true,
  whiteQueenside: true,
  blackKingside: true,
  blackQueenside: true,
};

const createInitialState = (): GameState => ({
  board: INITIAL_BOARD.map(row => row.map(p => p ? { ...p } : null)),
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
});

export const useChessGame = () => {
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);

  const selectSquare = useCallback((square: Square) => {
    const piece = getPieceAt(gameState.board, square);

    // If a piece is already selected
    if (selectedSquare) {
      // Check if clicking on a legal move square
      const isLegalMove = legalMoves.some(m => m.row === square.row && m.col === square.col);
      
      if (isLegalMove) {
        const movingPiece = getPieceAt(gameState.board, selectedSquare);
        
        // Check for pawn promotion
        if (movingPiece?.type === 'pawn') {
          const promotionRow = movingPiece.color === 'white' ? 0 : 7;
          if (square.row === promotionRow) {
            setPromotionPending({ from: selectedSquare, to: square });
            return;
          }
        }
        
        executeMove(selectedSquare, square);
        return;
      }

      // If clicking on own piece, select it instead
      if (piece && piece.color === gameState.currentTurn) {
        const moves = getLegalMoves(
          gameState.board,
          square,
          gameState.castlingRights,
          gameState.enPassantTarget
        );
        setSelectedSquare(square);
        setLegalMoves(moves);
        return;
      }

      // Deselect
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // Select a piece of current turn
    if (piece && piece.color === gameState.currentTurn) {
      const moves = getLegalMoves(
        gameState.board,
        square,
        gameState.castlingRights,
        gameState.enPassantTarget
      );
      setSelectedSquare(square);
      setLegalMoves(moves);
    }
  }, [gameState, selectedSquare, legalMoves]);

  const executeMove = useCallback((from: Square, to: Square, promotion?: PieceType) => {
    setGameState(prev => {
      const piece = getPieceAt(prev.board, from);
      if (!piece) return prev;

      const captured = getPieceAt(prev.board, to);
      let newBoard = makeMoveOnBoard(prev.board, from, to);
      
      // Handle promotion
      if (promotion && piece.type === 'pawn') {
        newBoard[to.row][to.col] = { type: promotion, color: piece.color };
      }

      // Update castling rights
      const newCastlingRights = { ...prev.castlingRights };
      
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
        if (from.row === 7 && from.col === 0) newCastlingRights.whiteQueenside = false;
        if (from.row === 7 && from.col === 7) newCastlingRights.whiteKingside = false;
        if (from.row === 0 && from.col === 0) newCastlingRights.blackQueenside = false;
        if (from.row === 0 && from.col === 7) newCastlingRights.blackKingside = false;
      }

      // Update en passant target
      let enPassantTarget: Square | null = null;
      if (piece.type === 'pawn' && Math.abs(from.row - to.row) === 2) {
        enPassantTarget = {
          row: (from.row + to.row) / 2,
          col: from.col
        };
      }

      const nextTurn: PieceColor = prev.currentTurn === 'white' ? 'black' : 'white';
      const check = isInCheck(newBoard, nextTurn);
      const checkmate = isCheckmate(newBoard, nextTurn, newCastlingRights, enPassantTarget);
      const stalemate = isStalemate(newBoard, nextTurn, newCastlingRights, enPassantTarget);

      // Create move record
      const move: Move = {
        from,
        to,
        piece,
        captured: captured || undefined,
        promotion,
        isEnPassant: piece.type === 'pawn' && from.col !== to.col && !captured,
        isCastling: piece.type === 'king' && Math.abs(from.col - to.col) === 2
          ? (to.col > from.col ? 'kingside' : 'queenside')
          : undefined,
        isCheck: check,
        isCheckmate: checkmate,
      };

      return {
        board: newBoard,
        currentTurn: nextTurn,
        castlingRights: newCastlingRights,
        enPassantTarget,
        halfMoveClock: piece.type === 'pawn' || captured ? 0 : prev.halfMoveClock + 1,
        fullMoveNumber: prev.currentTurn === 'black' ? prev.fullMoveNumber + 1 : prev.fullMoveNumber,
        isCheck: check,
        isCheckmate: checkmate,
        isStalemate: stalemate,
        isDraw: stalemate || prev.halfMoveClock >= 100,
        moveHistory: [...prev.moveHistory, move],
      };
    });

    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionPending(null);
  }, []);

  const handlePromotion = useCallback((pieceType: PieceType) => {
    if (promotionPending) {
      executeMove(promotionPending.from, promotionPending.to, pieceType);
    }
  }, [promotionPending, executeMove]);

  const cancelPromotion = useCallback(() => {
    setPromotionPending(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);

  const resetGame = useCallback(() => {
    setGameState(createInitialState());
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionPending(null);
  }, []);

  return {
    gameState,
    selectedSquare,
    legalMoves,
    promotionPending,
    selectSquare,
    handlePromotion,
    cancelPromotion,
    resetGame,
  };
};
