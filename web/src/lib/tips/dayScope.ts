// Whole-day card subtraction (Tips v3). Cash and gratuity are always dinner
// amounts. When the closer enters the whole-day card total, only the recorded
// lunch card amount is subtracted. The server recomputes this on save and is
// authoritative; the client copy drives the live receipt and card warning.
//
// MIRROR: supabase/functions/_shared/tips.ts carries a copy of this logic
// (edge functions cannot import from web/). Keep them in sync.

import { fromCents, toCents } from "./split";

export type EnteredScope = "shift" | "day";

export interface MealAmounts {
  cash: number;
  card: number;
  gratuity: number;
}

export interface DerivedAmounts {
  /** Shift-only figures in dollars, cent-exact. May be negative. */
  derived: MealAmounts;
  /** True when a lunch row existed and its card amount was subtracted. */
  subtracted: boolean;
}

/**
 * Derive the shift-only amounts from what the closer typed.
 *
 * On scope "day" with a lunch row on record, card is typed card − lunch card,
 * computed in integer cents. Cash and gratuity always pass through as dinner
 * amounts. On scope "shift", or on "day" with no lunch recorded, every typed
 * figure passes through unchanged and `subtracted` is false.
 */
export function deriveShiftAmounts(
  typed: MealAmounts,
  scope: EnteredScope,
  lunch: MealAmounts | null,
): DerivedAmounts {
  if (scope !== "day" || lunch === null) {
    return { derived: { ...typed }, subtracted: false };
  }
  return {
    derived: {
      cash: typed.cash,
      card: fromCents(toCents(typed.card) - toCents(lunch.card)),
      gratuity: typed.gratuity,
    },
    subtracted: true,
  };
}

/** True when any derived field is negative — the one blocking entry state. */
export function hasNegativeAmount(amounts: MealAmounts): boolean {
  return amounts.cash < 0 || amounts.card < 0 || amounts.gratuity < 0;
}

/** Entered total in dollars, cent-exact: cash + card + gratuity. */
export function enteredTotal(amounts: MealAmounts): number {
  return fromCents(
    toCents(amounts.cash) + toCents(amounts.card) + toCents(amounts.gratuity),
  );
}
