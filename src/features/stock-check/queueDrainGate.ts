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
 *  - signing out re-arms it for the next user.
 */

type DrainFn = () => void;

let drain: DrainFn | null = null;
let queueRehydrated = false;
let authSessionRestored = false;
let drainedForCurrentSession = false;

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
 * The auth store has a usable session: the Supabase client will send a JWT,
 * so the stock-check RPCs can resolve `auth.uid()`.
 */
export function notifyAuthSessionRestored(): void {
  authSessionRestored = true;
  maybeDrain();
}

/** The user signed out (or was signed out). Re-arm for the next session. */
export function notifyAuthSessionCleared(): void {
  authSessionRestored = false;
  drainedForCurrentSession = false;
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
}
