/**
 * Launch-time gate for the stock-check write queue (issue #74).
 *
 * The queue used to drain straight out of zustand's `onRehydrateStorage`.
 * That callback fires as soon as AsyncStorage hands the persisted queue back,
 * which is before Supabase has restored the session from SecureStore, so
 * `auth.uid()` was still null inside `start_or_resume_stock_check` and the
 * launch attempt failed with an auth error. The count then waited for the
 * next stock screen to open, and `syncError` briefly held a message about
 * being signed out that had nothing to do with connectivity.
 *
 * This module is the join between the two events. It holds no imports on
 * purpose: the auth store and the stock-check store both call into it, and
 * neither has to learn about the other.
 *
 * Semantics:
 *  - the drain fires once both the queue is in memory and the auth store has
 *    reported a restored session, whichever arrives last;
 *  - it fires once per session, so later token refreshes do not re-drain;
 *  - signing out re-arms it for the next user;
 *  - the restored session's user id is held here so the stock-check store can
 *    stamp queued writes with their owner and refuse to send one user's count
 *    under another user's JWT.
 */

type DrainFn = () => void;

let drain: DrainFn | null = null;
let queueRehydrated = false;
let authSessionRestored = false;
let drainedForCurrentSession = false;
let sessionUserId: string | null = null;

function maybeDrain(): void {
  if (!drain) return;
  if (!queueRehydrated || !authSessionRestored) return;
  if (drainedForCurrentSession) return;
  drainedForCurrentSession = true;
  drain();
}

/**
 * Registers the queue drain. Called once when the stock-check store module
 * loads. Registration order does not matter: if both notifications already
 * arrived, registering runs the drain immediately.
 */
export function registerStockQueueDrain(fn: DrainFn): void {
  drain = fn;
  maybeDrain();
}

/** The persisted queue is back in memory. */
export function notifyStockQueueRehydrated(): void {
  queueRehydrated = true;
  maybeDrain();
}

/**
 * The auth store has a usable session for `userId`: the Supabase client will
 * send that user's JWT, so the stock-check RPCs can resolve `auth.uid()`.
 *
 * A different user id than the one currently held means an account switch
 * that never passed through `notifyAuthSessionCleared` (fast user switching,
 * or a session adopted from a deep link). That re-arms the launch drain so
 * the arriving account still gets one, and re-points ownership so the
 * departing account's queued writes are no longer eligible to send.
 */
export function notifyAuthSessionRestored(userId: string): void {
  if (!userId) return;
  if (sessionUserId !== null && sessionUserId !== userId) {
    drainedForCurrentSession = false;
  }
  sessionUserId = userId;
  authSessionRestored = true;
  maybeDrain();
}

/**
 * The user signed out, switched accounts, or deleted the account. Re-arm for
 * the next session and drop the owner: with no owner, the stock-check store
 * holds the queue instead of sending it under whatever session arrives next.
 */
export function notifyAuthSessionCleared(): void {
  authSessionRestored = false;
  drainedForCurrentSession = false;
  sessionUserId = null;
}

/**
 * The user id the current session belongs to, or null when no session has
 * been reported (cold start before auth restore, or signed out). The
 * stock-check store stamps queued writes with it and drains only the writes
 * that match it.
 */
export function getStockQueueOwnerId(): string | null {
  return sessionUserId;
}

/**
 * Test seam: clears the launch flags so a cold start can be replayed. The
 * registered drain is left alone, because registration happens once when the
 * stock-check store module loads and cannot be replayed.
 */
export function __resetStockQueueDrainGate(): void {
  queueRehydrated = false;
  authSessionRestored = false;
  drainedForCurrentSession = false;
  sessionUserId = null;
}
