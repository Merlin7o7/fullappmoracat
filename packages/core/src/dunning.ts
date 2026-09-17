/**
 * Dunning (T7) — what happens when an opted-in renewal charge fails.
 *
 * The ladder is short and loud, never silent: retry on the day the term ends,
 * two days later, and five days later. Benefits stay on for a grace week so a
 * transient decline never costs a member their cat's record (R064/R068). The
 * numbers live here so the engine, the copy and the tests agree on one truth.
 */

/** Days after term end at which each charge attempt runs (attempt 1, 2, 3). */
export const DUNNING_OFFSETS_DAYS = [0, 2, 5] as const;
export const MAX_DUNNING_ATTEMPTS = DUNNING_OFFSETS_DAYS.length;
/** Benefits keep running this long past term end while we retry. */
export const GRACE_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * When the next attempt is due after `attemptsMade` (1-based count of attempts
 * already run). Null once the ladder is exhausted.
 */
export function nextDunningAt(termEndsAt: Date, attemptsMade: number): Date | null {
  if (attemptsMade >= MAX_DUNNING_ATTEMPTS) return null;
  const offset = DUNNING_OFFSETS_DAYS[attemptsMade];
  if (offset === undefined) return null;
  return new Date(termEndsAt.getTime() + offset * DAY_MS);
}

/** The last moment benefits stay on while a failed renewal is retried. */
export function graceUntil(termEndsAt: Date): Date {
  return new Date(termEndsAt.getTime() + GRACE_DAYS * DAY_MS);
}

/** Whether a given attempt number (1-based) is the final one in the ladder. */
export function isFinalAttempt(attemptNumber: number): boolean {
  return attemptNumber >= MAX_DUNNING_ATTEMPTS;
}
