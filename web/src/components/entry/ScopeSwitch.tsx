"use client";

// Whole-day-card vs dinner-only scope for the amounts card. Cash and gratuity
// are always dinner amounts. Lunch has no switch and records what was typed.

import type { EnteredScope } from "@/lib/tips/dayScope";
import { Segmented } from "./Segmented";

const SCOPE_OPTIONS = [
  { value: "day", label: "Whole day (card)" },
  { value: "shift", label: "Dinner only" },
] as const;

export function ScopeSwitch({
  value,
  onChange,
  disabled = false,
}: {
  value: EnteredScope;
  onChange: (next: EnteredScope) => void;
  disabled?: boolean;
}) {
  return (
    <Segmented
      options={SCOPE_OPTIONS}
      value={value}
      onChange={onChange}
      compact
      wellTrack
      disabled={disabled}
    />
  );
}
