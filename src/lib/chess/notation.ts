import type { Square } from './types';

const FILE_REGEX = /^[a-h]$/i;
const RANK_REGEX = /^[1-8]$/;

/**
 * Converts algebraic notation (e.g. "a1", "b3", "h8") to a Square.
 * a1 = bottom-left for white; row 7, col 0.
 */
export function notationToSquare(notation: string): Square | null {
  const s = notation.trim().toLowerCase().replace(/\s+/g, '');
  if (s.length < 2) return null;
  const file = s[0];
  const rankChar = s[1];
  if (!FILE_REGEX.test(file) || !RANK_REGEX.test(rankChar)) return null;
  const rankNum = parseInt(rankChar, 10);
  const col = file.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = 8 - rankNum;
  return { row, col };
}

/**
 * Converts a Square to algebraic notation (e.g. "b3").
 */
export function squareToNotation(sq: Square): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + sq.col);
  const rank = 8 - sq.row;
  return `${file}${rank}`;
}
