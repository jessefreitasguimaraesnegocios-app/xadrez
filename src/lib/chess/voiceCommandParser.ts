import type { PieceType } from './types';

/** Language code for SpeechRecognition (e.g. pt-BR, en-US). */
export const VOICE_LANG_CODES: Record<string, string> = {
  'pt-BR': 'Português',
  'en-US': 'English',
  'zh-CN': 'Mandarin',
  'hi-IN': 'Hindi',
  'es-ES': 'Español',
  'fr-FR': 'Français',
  'ar-SA': 'Arabic',
  'bn-IN': 'Bengali',
  'ru-RU': 'Russian',
  'ur-PK': 'Urdu',
} as const;

/**
 * Keywords for each piece type in multiple languages (lowercase).
 * Used to parse voice commands like "knight b3" or "cavalo b3".
 */
const PIECE_KEYWORDS: Record<PieceType, string[]> = {
  king: [
    'king', 'rei', 're', '王', '帅', 'raja', 'rey', 'roi', 'malik', 'король', 'korol', 'shah', 'shahrukh',
  ],
  queen: [
    'queen', 'dama', 'rainha', '后', 'rani', 'reina', 'reine', 'malika', 'ferz', 'ферзь', 'ferz', 'wazeer',
  ],
  rook: [
    'rook', 'torre', '车', 'hathi', 'hathi', 'torre', 'tour', 'rukh', 'rook', 'ладья', 'ladya', 'rukh',
  ],
  bishop: [
    'bishop', 'bispo', '象', 'oont', 'alfil', 'fou', 'fil', 'bishop', 'слон', 'slon', 'fil',
  ],
  knight: [
    'knight', 'cavalo', 'horse', '马', 'ghoda', 'ghora', 'caballo', 'cavalier', 'hissan', 'knight', 'конь', 'kon', 'asp',
  ],
  pawn: [
    'pawn', 'peão', 'peon', 'pion', '兵', 'pyada', 'peón', 'pion', 'baidaq', 'pawn', 'пешка', 'peshka', 'pyada',
  ],
};

const SQUARE_REGEX = /\b([a-h])\s*([1-8])\b/i;

export interface ParsedVoiceCommand {
  pieceType: PieceType;
  square: string;
}

/**
 * Parses a voice transcript into piece type and square (e.g. "cavalo b3" -> { pieceType: 'knight', square: 'b3' }).
 * Tries to recognize piece names in all supported languages.
 */
export function parseVoiceCommand(transcript: string, _lang?: string): ParsedVoiceCommand | null {
  const normalized = transcript.trim().toLowerCase().replace(/\s+/g, ' ');
  const squareMatch = normalized.match(SQUARE_REGEX);
  if (!squareMatch) return null;
  const square = `${squareMatch[1].toLowerCase()}${squareMatch[2]}`;

  let foundPiece: PieceType | null = null;
  let longestMatch = 0;

  for (const [pieceType, keywords] of Object.entries(PIECE_KEYWORDS) as [PieceType, string[]][]) {
    for (const kw of keywords) {
      if (kw.length < 2) continue;
      const idx = normalized.indexOf(kw);
      if (idx !== -1 && kw.length > longestMatch) {
        longestMatch = kw.length;
        foundPiece = pieceType;
      }
    }
  }

  if (!foundPiece) return null;
  return { pieceType: foundPiece, square };
}
