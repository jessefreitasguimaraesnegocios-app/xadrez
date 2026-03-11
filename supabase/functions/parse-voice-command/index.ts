import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PIECE_TYPES = ["king", "queen", "rook", "bishop", "knight", "pawn"] as const;
const FILES = "abcdefgh";
const RANKS = "12345678";

function isValidPieceType(s: string): boolean {
  return PIECE_TYPES.includes(s as (typeof PIECE_TYPES)[number]);
}
function isValidSquare(s: string): boolean {
  if (s.length !== 2) return false;
  const f = s[0].toLowerCase();
  const r = s[1];
  return FILES.includes(f) && RANKS.includes(r);
}

const SYSTEM_PROMPT = `You are a chess voice command parser. The user speaks in any language (Portuguese, English, Spanish, French, Mandarin, Hindi, Arabic, etc.) to say a chess move: which piece to move and to which square.

Rules:
- Piece must be one of: king, queen, rook, bishop, knight, pawn (in English, lowercase).
- Square must be algebraic notation: one letter a-h (file) and one digit 1-8 (rank), e.g. e4, d5, b3.
- Extract ONLY the piece and the destination square. Ignore disambiguation (e.g. "knight c to b3" -> piece: knight, square: b3).
- If the transcript is unclear or not a valid move command, respond with {"error": "unparseable"}.
- Respond with a single JSON object only, no markdown or extra text. Valid keys: "pieceType", "square", or "error".`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "transcript_required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ai_unavailable", fallback: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const userMessage = `Transcript: "${transcript}"`;
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          max_tokens: 80,
          temperature: 0,
        }),
      });
    } catch (fetchErr) {
      return new Response(
        JSON.stringify({ error: "ai_network_error", fallback: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: "ai_error", details: errText.slice(0, 200), fallback: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = await res.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "ai_bad_response", fallback: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
    const content = data?.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : content;
    let parsed: { pieceType?: string; square?: string; error?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(
        JSON.stringify({ error: "unparseable", fallback: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (parsed.error) {
      return new Response(
        JSON.stringify({ error: parsed.error, fallback: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const pieceType = typeof parsed.pieceType === "string" ? parsed.pieceType.trim().toLowerCase() : "";
    const square = typeof parsed.square === "string" ? parsed.square.trim().toLowerCase().replace(/\s+/g, "") : "";
    if (!isValidPieceType(pieceType) || !isValidSquare(square)) {
      return new Response(
        JSON.stringify({ error: "invalid_format", fallback: true }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ pieceType, square }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(e), fallback: true }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
