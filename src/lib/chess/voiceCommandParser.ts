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

/**
 * Normalizes transcript for file letters that are often misrecognized (especially D and E).
 * Runs before the main square regex so "the 4", "de 4", "i 5", "e 5" etc. are recognized.
 */
function normalizeTranscriptForSquares(text: string): string {
  let s = text.trim().toLowerCase().replace(/\s+/g, ' ');
  // Rank numbers often misheard: "for"->4, "ate"->8, "to"/"too"->2, "free"/"tree"->3, "sex"->6, "heaven"/"seven"->7
  const rankWords: Record<string, string> = {
    one: '1', two: '2', to: '2', too: '2', three: '3', tree: '3', free: '3', thrice: '3',
    four: '4', for: '4', forr: '4', fore: '4',
    five: '5', fife: '5',
    six: '6', sex: '6', sicks: '6',
    seven: '7', heaven: '7',
    eight: '8', ate: '8',
  };
  for (const [word, digit] of Object.entries(rankWords)) {
    const re = new RegExp(`\\b${word}\\b`, 'g');
    s = s.replace(re, digit);
  }
  // D: "the", "de", "dê", "day", "di" + number -> d + number
  s = s.replace(/\b(the|de|dê|day|di)\s*([1-8])\b/g, 'd$2');
  // "d i 4" (d and i heard separately) -> d4
  s = s.replace(/\bd\s*i\s*([1-8])\b/g, 'd$1');
  // E: "ee", "he", "eh" + number -> e + number
  s = s.replace(/\b(ee|he|eh)\s*([1-8])\b/g, 'e$2');
  // "i" alone before number (e.g. "cavalo i 3" = knight e3) -> e + number
  s = s.replace(/\bi\s*([1-8])\b/g, 'e$1');
  // B: "be", "bee" + number
  s = s.replace(/\b(be|bee)\s*([1-8])\b/g, 'b$2');
  // C: "see", "sea", "ce" + number
  s = s.replace(/\b(see|sea|ce)\s*([1-8])\b/g, 'c$2');
  // G: "jee", "ge" + number
  s = s.replace(/\b(jee|ge)\s*([1-8])\b/g, 'g$2');
  return s;
}

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
  const normalizedForSquare = normalizeTranscriptForSquares(transcript);
  let squareMatch = normalizedForSquare.match(SQUARE_REGEX);
  if (!squareMatch) squareMatch = normalized.match(SQUARE_REGEX);
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
