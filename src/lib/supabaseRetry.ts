/**
 * Runs an async function with retries and optional initial delay.
 * Reduces impact of transient network timeouts (e.g. ERR_CONNECTION_TIMED_OUT).
 */
const DEFAULT_RETRIES = 3;
const INITIAL_BACKOFF_MS = 800;
const MAX_BACKOFF_MS = 5000;

function isRetryableError(err: unknown): boolean {
  if (err == null) return false;
  const msg = typeof err === "object" && err !== null && "message" in err
    ? String((err as { message: unknown }).message)
    : String(err);
  const s = msg.toLowerCase();
  return (
    s.includes("timeout") ||
    s.includes("network") ||
    s.includes("failed to fetch") ||
    s.includes("connection") ||
    s.includes("econnreset") ||
    s.includes("econnrefused")
  );
}

/** Exported for callers that need to decide whether to throw for retry. */
export { isRetryableError };

export interface RetryOptions {
  /** Number of attempts (including first). Default 3. */
  retries?: number;
  /** Initial delay before first retry (ms). Default 800. */
  initialBackoffMs?: number;
  /** Max delay between retries (ms). Default 5000. */
  maxBackoffMs?: number;
  /** Delay before first attempt (for staggering). Default 0. */
  initialDelayMs?: number;
}

/**
 * Executes `fn()` with optional initial delay, then retries on retryable errors
 * with exponential backoff. Returns the result of `fn` or throws the last error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = DEFAULT_RETRIES,
    initialBackoffMs = INITIAL_BACKOFF_MS,
    maxBackoffMs = MAX_BACKOFF_MS,
    initialDelayMs = 0,
  } = options;

  if (initialDelayMs > 0) {
    await new Promise((r) => setTimeout(r, initialDelayMs));
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt === retries - 1;
      if (isLast || !isRetryableError(err)) throw err;
      const delay = Math.min(initialBackoffMs * Math.pow(2, attempt), maxBackoffMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Stagger offsets (ms) for initial Supabase fetches to avoid opening
 * many connections at once and reduce timeouts.
 */
export const SUPABASE_STAGGER = {
  gameInvites: 0,
  unreadDirectCount: 120,
  unreadBySender: 240,
  friendships: 80,
  tournaments: 60,
  myTournaments: 180,
} as const;
