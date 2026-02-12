import { useState, useCallback, useEffect, useRef } from 'react';
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
import { getBotMove, type BotDifficulty } from './bot';

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

export interface UseChessGameOptions {
  botDifficulty?: BotDifficulty | null;
  /** When playing vs bot: which color the human plays. Bot plays the opposite. Default white. */
  playerColor?: PieceColor;
  onTurnChange?: (turn: PieceColor) => void;
  /** Chamado quando a partida termina. result: quem venceu ou 'draw'. */
  onGameOver?: (result?: 'white_wins' | 'black_wins' | 'draw') => void;
  /** Called once when the first move is played (white). */
  onFirstMove?: () => void;
  /** Called after each move; wasCapture true if a piece was taken. */
  onMoveSound?: (wasCapture: boolean) => void;
  /** Modo online: estado vindo do servidor (partida PvP). */
  syncState?: GameState | null;
  /** Modo online: ao jogar, chama isto em vez de atualizar estado local. */
  onMove?: (move: Move) => void;
}

export const useChessGame = (options?: UseChessGameOptions) => {
  const botDifficulty = options?.botDifficulty ?? null;
  const playerColor = options?.playerColor ?? 'white';
  const botColor: PieceColor = playerColor === 'white' ? 'black' : 'white';
  const onTurnChange = options?.onTurnChange;
  const onGameOver = options?.onGameOver;
  const onFirstMove = options?.onFirstMove;
  const onMoveSound = options?.onMoveSound;
  const syncState = options?.syncState;
  const onMove = options?.onMove;
  const isControlled = syncState != null && typeof onMove === 'function';

  const [localState, setLocalState] = useState<GameState>(createInitialState);
  const gameState = isControlled ? (syncState ?? localState) : localState;
  const setGameState = setLocalState;

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);
  const botScheduled = useRef(false);
  const onFirstMoveCalled = useRef(false);
  const gameStateRef = useRef(gameState);
  const onMoveSoundRef = useRef(onMoveSound);
  gameStateRef.current = gameState;
  onMoveSoundRef.current = onMoveSound;

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
    const prev = gameStateRef.current;
    const prevBoard = prev.board;
    const piece = getPieceAt(prevBoard, from);
    if (!piece) return;
    const captured = getPieceAt(prevBoard, to);

    const cap = getPieceAt(prev.board, to);
    let newBoard = makeMoveOnBoard(prev.board, from, to);
    if (promotion && piece.type === 'pawn') {
      newBoard = newBoard.map(row => [...row]);
      newBoard[to.row][to.col] = { type: promotion, color: piece.color };
    }
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
    let enPassantTarget: Square | null = null;
    if (piece.type === 'pawn' && Math.abs(from.row - to.row) === 2) {
      enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
    }
    const nextTurn: PieceColor = prev.currentTurn === 'white' ? 'black' : 'white';
    const check = isInCheck(newBoard, nextTurn);
    const checkmate = isCheckmate(newBoard, nextTurn, newCastlingRights, enPassantTarget);

    const move: Move = {
      from,
      to,
      piece,
      captured: cap || undefined,
      promotion,
      isEnPassant: piece.type === 'pawn' && from.col !== to.col && !cap,
      isCastling: piece.type === 'king' && Math.abs(from.col - to.col) === 2
        ? (to.col > from.col ? 'kingside' : 'queenside')
        : undefined,
      isCheck: check,
      isCheckmate: checkmate,
    };

    if (isControlled && onMove) {
      onMove(move);
      setSelectedSquare(null);
      setLegalMoves([]);
      setPromotionPending(null);
      onMoveSoundRef.current?.(!!captured);
      return;
    }

    setGameState({
      board: newBoard,
      currentTurn: nextTurn,
      castlingRights: newCastlingRights,
      enPassantTarget,
      halfMoveClock: piece.type === 'pawn' || cap ? 0 : prev.halfMoveClock + 1,
      fullMoveNumber: prev.currentTurn === 'black' ? prev.fullMoveNumber + 1 : prev.fullMoveNumber,
      isCheck: check,
      isCheckmate: checkmate,
      isStalemate: isStalemate(newBoard, nextTurn, newCastlingRights, enPassantTarget),
      isDraw: prev.halfMoveClock >= 100,
      moveHistory: [...prev.moveHistory, move],
    });
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionPending(null);
    onMoveSoundRef.current?.(!!captured);
  }, [isControlled, onMove]);

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

  useEffect(() => {
    onTurnChange?.(gameState.currentTurn);
  }, [gameState.currentTurn, onTurnChange]);

  useEffect(() => {
    if (gameState.isCheckmate) {
      const result: 'white_wins' | 'black_wins' = gameState.currentTurn === 'white' ? 'black_wins' : 'white_wins';
      onGameOver?.(result);
    } else if (gameState.isStalemate || gameState.isDraw) {
      onGameOver?.('draw');
    }
  }, [gameState.isCheckmate, gameState.isStalemate, gameState.isDraw, gameState.currentTurn, onGameOver]);

  useEffect(() => {
    if (gameState.moveHistory.length === 1 && !onFirstMoveCalled.current) {
      onFirstMoveCalled.current = true;
      onFirstMove?.();
    }
  }, [gameState.moveHistory.length, onFirstMove]);

  useEffect(() => {
    if (
      !botDifficulty ||
      gameState.currentTurn !== botColor ||
      gameState.isCheckmate ||
      gameState.isStalemate ||
      promotionPending ||
      botScheduled.current
    )
      return;
    botScheduled.current = true;
    const t = setTimeout(() => {
      const move = getBotMove(gameState, botDifficulty);
      botScheduled.current = false;
      if (move) executeMove(move.from, move.to, move.promotion);
    }, 350);
    return () => clearTimeout(t);
  }, [botDifficulty, botColor, gameState, promotionPending, executeMove]);

  const resetGame = useCallback(() => {
    botScheduled.current = false;
    onFirstMoveCalled.current = false;
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
