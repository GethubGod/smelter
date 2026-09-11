/**
 * Guards for the Advanced ordering composer send path.
 *
 * The Advanced ordering screen is wrapped in an `ErrorBoundary`, which catches
 * errors thrown during render and commit. The composer send path does two
 * things that run in exactly those phases:
 *
 *   1. It seeds `parsedItems` from `quick_order_sessions.parsed_items` after a
 *      cold launch. Those rows are raw persisted JSON, so unlike freshly parsed
 *      rows they never went through `normalizeQuickOrderItemForDisplay` and can
 *      carry a stale `status` / `action` next to an unresolved unit.
 *   2. It applies the parse result inside a `setParsedItems` updater, which
 *      React invokes during the render phase.
 *
 * Both are handled here so a cart row with no resolved unit can only ever
 * produce a visible resolve prompt or a visible inline error, never an
 * unhandled throw that unmounts the screen into the error boundary.
 */

import {
  hasParsedItemName,
  normalizeQuickOrderItemForDisplay,
  type ParsedQuickOrderItem,
} from './quickOrderItems';

/** Error code used for the inline pill when the cart update itself fails. */
export const QUICK_ORDER_CART_APPLY_ERROR_CODE = 'cart_apply_failed';

/**
 * Rebuilds the parsed-item cart from a persisted `parsed_items` payload.
 *
 * Anything we can render a row for is kept: a name, a raw token, or an
 * inventory id. A nameless row still gets a visible "Unknown item" row plus an
 * issue indicator rather than being silently dropped.
 *
 * Every surviving row is then run through
 * {@link normalizeQuickOrderItemForDisplay}, the same pass every freshly parsed
 * row goes through. That is what guarantees a rehydrated row with an unresolved
 * unit carries `status: 'missing_unit'` and `action: 'Choose unit'` — a visible
 * resolve prompt — instead of whatever stale shape happened to be persisted.
 */
export function normalizePersistedQuickOrderItems(
  value: unknown,
): ParsedQuickOrderItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) =>
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry as ParsedQuickOrderItem)
        : null,
    )
    .filter((entry): entry is ParsedQuickOrderItem =>
      Boolean(
        entry &&
          (hasParsedItemName(entry) ||
            entry.raw_token?.trim() ||
            entry.raw_text?.trim() ||
            entry.item_id),
      ),
    )
    .map((entry) => normalizeQuickOrderItemForDisplay(entry));
}

/** Outcome of a guarded cart update. `error` is null on success. */
export type QuickOrderCartApplyResult<TSnapshot> = {
  /** The cart to commit: the computed one on success, the current one on failure. */
  items: ParsedQuickOrderItem[];
  /** Everything the caller needs after a successful apply, or null on failure. */
  snapshot: TSnapshot | null;
  error: unknown;
};

/**
 * Runs the body of a `setParsedItems` updater inside a try/catch.
 *
 * React calls state updaters during render, so a throw in there reaches the
 * screen's error boundary and replaces the whole surface. Instead this returns
 * the cart unchanged and hands the error back to the caller, which surfaces it
 * as an inline error pill the user can retry from.
 */
export function applyQuickOrderCartUpdate<TSnapshot>(
  current: ParsedQuickOrderItem[],
  compute: () => { items: ParsedQuickOrderItem[]; snapshot: TSnapshot },
): QuickOrderCartApplyResult<TSnapshot> {
  try {
    const result = compute();
    if (!Array.isArray(result.items)) {
      return { items: current, snapshot: null, error: new Error('Cart update produced no items.') };
    }
    return { items: result.items, snapshot: result.snapshot, error: null };
  } catch (error) {
    return { items: current, snapshot: null, error: error ?? new Error('Cart update failed.') };
  }
}
