import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, radius, size, space, typeScale, weight } from '@/theme/tokens';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Dims the option, drops it out of the tab order and refuses the press. */
  disabled?: boolean;
}

export interface SegmentProps<T extends string> {
  onDark?: boolean;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Picks exactly one of two to four options. Fills the width, sits on the well
 * track, active option takes the accent. Use `Chip` for list filters.
 */
export function Segment<T extends string>({
  onDark = false,
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
  style,
}: SegmentProps<T>) {
  const ds = useScaledStyles();
  // The rendered pill keeps the contract height, so the track keeps its shape;
  // the 44pt target is restored with vertical hitSlop, the same trick Button
  // and Chip use. Horizontal slop is unnecessary: each option is flex: 1, so it
  // already spans its share of the full row width. minHeight rather than a
  // fixed height, so the pill can still grow with the large text setting.
  const optionHeight = ds.spacing(size.chip);
  const slop = Math.max(0, Math.ceil((size.touchMin - optionHeight) / 2));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          padding: ds.spacing(space[1] - 1),
          borderRadius: onDark ? radius.control : radius.pill,
          backgroundColor: onDark ? auth.well : color.well,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const disabled = option.disabled === true;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={
              disabled ? { selected, checked: selected, disabled: true } : { selected, checked: selected }
            }
            hitSlop={{ top: slop, bottom: slop, left: 0, right: 0 }}
            style={{
              opacity: disabled ? 0.4 : 1,
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: optionHeight,
              paddingVertical: ds.spacing(space[2] - 1),
              borderRadius: onDark ? radius.control : radius.pill,
              backgroundColor: selected ? (onDark ? auth.text : color.accent) : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                fontWeight: weight.semibold,
                color: onDark ? (selected ? auth.bg : auth.dim) : (selected ? color.onAccent : color.ink2),
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
