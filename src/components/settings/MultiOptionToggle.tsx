import React, { useMemo } from 'react';
import { Segment, type SegmentOption } from '@/components/ui';

interface Option<T> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface MultiOptionToggleProps<T> {
  options: Option<T>[];
  value: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * The contract `Segment`, adapted for the numeric option values the display
 * settings use. `Segment` keys on strings, so values round-trip through
 * `String(value)`.
 *
 * A per-option `disabled` reaches `Segment`, so an unavailable option is dimmed
 * and announced as disabled instead of looking pressable and doing nothing.
 */
export function MultiOptionToggle<T extends string | number>({
  options,
  value,
  onValueChange,
  disabled = false,
}: MultiOptionToggleProps<T>) {
  const segmentOptions = useMemo<SegmentOption<string>[]>(
    () =>
      options.map((option) => ({
        value: String(option.value),
        label: option.label,
        disabled: disabled || option.disabled === true,
      })),
    [disabled, options],
  );

  const handleChange = (next: string) => {
    if (disabled) return;
    const match = options.find((option) => String(option.value) === next);
    if (!match || match.disabled) return;
    onValueChange(match.value);
  };

  return (
    <Segment
      options={segmentOptions}
      value={String(value)}
      onChange={handleChange}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  );
}
