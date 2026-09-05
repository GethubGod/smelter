import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space, typeScale, weight } from '@/theme/tokens';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentProps<T extends string> {
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
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
  style,
}: SegmentProps<T>) {
  const ds = useScaledStyles();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          padding: ds.spacing(space[1] - 1),
          borderRadius: radius.pill,
          backgroundColor: color.well,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: ds.spacing(space[2] - 1),
              borderRadius: radius.pill,
              backgroundColor: selected ? color.accent : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                fontWeight: weight.semibold,
                color: selected ? color.onAccent : color.ink2,
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
