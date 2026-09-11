import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, radius, space } from '@/theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  /** Drops the internal padding when the card only groups full-bleed rows. */
  flush?: boolean;
  /** Black auth surfaces: the well fill and its border instead of white. */
  onDark?: boolean;
  /** The recommended or chosen card in a picker. Draws the accent border. */
  selected?: boolean;
  testID?: string;
  /** Layout only: margins and flex. Never colour, radius or type. */
  style?: StyleProp<ViewStyle>;
}

/** The grouping surface. White, card radius, hairline border, no shadow. */
export function Card({
  children,
  flush = false,
  onDark = false,
  selected = false,
  testID,
  style,
}: CardProps) {
  const ds = useScaledStyles();
  const borderColor = selected ? color.accent : onDark ? auth.wellBorder : color.hairline;

  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: onDark ? auth.well : color.card,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: flush ? 0 : ds.spacing(space[3] + 2),
          paddingVertical: flush ? 0 : ds.spacing(space[3]),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
