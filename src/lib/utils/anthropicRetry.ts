/**
 * anthropicRetry.ts
 *
 * Wraps an Anthropic API call with exponential backoff retry logic.
 * Retries on 5xx errors (transient server errors) and 529 (overloaded).
 * Does NOT retry on 4xx errors (auth, rate limit, bad request) — those
 * require a code or configuration fix, not a retry.
 *
 * Default: 3 attempts, 2s → 4s → 8s backoff.
 */

const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;

function isRetryableError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const status = (err as { status?: number }).status;
    if (status !== undefined && RETRYABLE_STATUS_CODES.has(status)) return true;
    // Anthropic SDK wraps errors with a message containing the status
    const message = (err as { message?: string }).message ?? "";
    if (/^5\d\d /.test(message)) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withAnthropicRetry<T>(
  fn: () => Promise<T>,
  label = "anthropic"
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === MAX_ATTEMPTS) {
        throw err;
      }
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 2s, 4s, 8s
      console.warn(
        `[${label}] Retryable error on attempt ${attempt}/${MAX_ATTEMPTS}, retrying in ${delayMs}ms:`,
        (err as { message?: string }).message ?? err
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}
