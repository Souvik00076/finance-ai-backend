// All user-facing dates are India time (UTC+05:30), matching finance-ai-api analytics.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Epoch ms → "YYYY-MM-DD" in IST. */
export function istDateString(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → epoch ms of 00:00 IST that day, or null if not a real calendar date. */
export function istDayStartMs(date: string): number | null {
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utcMidnight = Date.UTC(y, mo - 1, d);
  const check = new Date(utcMidnight);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null; // e.g. 2026-02-30
  }
  return utcMidnight - IST_OFFSET_MS;
}

/**
 * Decides when an earning happened.
 * Uses the model's date if it is a real date not after the message's day (IST);
 * otherwise falls back to the message time.
 */
export function resolveEarnedAt(
  date: string | null | undefined,
  messageMs: number,
): { earnedAtMs: number; fromMessage: boolean } {
  // A month without a day ("2026-07") means the 1st of that month.
  if (date && /^\d{4}-\d{2}$/.test(date)) date = `${date}-01`;
  if (date) {
    const dayStart = istDayStartMs(date);
    if (dayStart !== null && date <= istDateString(messageMs)) {
      return { earnedAtMs: dayStart, fromMessage: true };
    }
  }
  return { earnedAtMs: messageMs, fromMessage: false };
}
