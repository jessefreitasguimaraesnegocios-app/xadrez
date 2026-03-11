import type { PieceType } from "@/lib/chess/types";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * Calls the Edge Function that uses OpenAI to parse voice transcript into piece + square.
 * Works without user session. On error or when AI is unavailable, use fallback parser.
 */
export async function parseVoiceCommandWithAI(
  transcript: string
): Promise<{ ok: true; pieceType: PieceType; square: string } | { ok: false; fallback: boolean }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, fallback: true };
  }
  const url = `${SUPABASE_URL}/functions/v1/parse-voice-command`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ transcript: transcript.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.pieceType && data.square) {
      const pieceType = String(data.pieceType).toLowerCase() as PieceType;
      const square = String(data.square).toLowerCase().replace(/\s+/g, "");
      const validPieces: PieceType[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];
      const validFile = /^[a-h]$/.test(square[0]);
      const validRank = /^[1-8]$/.test(square[1]);
      if (validPieces.includes(pieceType) && validFile && validRank) {
        return { ok: true, pieceType, square };
      }
    }
    return { ok: false, fallback: !!data.fallback };
  } catch {
    return { ok: false, fallback: true };
  }
}
