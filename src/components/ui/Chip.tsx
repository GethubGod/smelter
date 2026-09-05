import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, size, space, typeScale, weight } from '@/theme/tokens';

export interface ChipProps {
  label: string;
  selected?: boolean;
  /** Optional count badge, for example the number of orders behind a filter. */
  count?: number;
  onPress: () => void;
  testID?: string;
}

/**
 * A list filter. Multi or single select, optional count. Chips scroll
 * horizontally; use `Segment` when exactly one of a fixed set must be chosen.
 */
export function Chip({ label, selected = false, count, onPress, testID }: ChipProps) {
  const ds = useScaledStyles();
  const height = ds.spacing(size.chip);
  const slop = Math.max(0, Math.ceil((size.touchMin - height) / 2));
  const text = selected ? color.onAccent : color.ink2;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected }}
      testID={testID}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(space[2] - 2),
        height,
        paddingHorizontal: ds.spacing(space[3] + 1),
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? color.accent : color.hairlineStrong,
        backgroundColor: selected ? color.accent : color.card,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontSize: ds.fontSize(typeScale.secondary), fontWeight: weight.semibold, color: text }}
      >
        {label}
      </Text>
      {count === undefined ? null : (
        <View
          style={{
            paddingHorizontal: ds.spacing(space[2] - 2),
            paddingVertical: 1,
            borderRadius: radius.pill,
            backgroundColor: selected ? 'rgba(255, 255, 255, 0.25)' : color.hairline,
          }}
        >
          <Text style={{ fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.semibold, color: text }}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
