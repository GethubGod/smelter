import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space } from '@/theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  /** Drops the internal padding when the card only groups full-bleed rows. */
  flush?: boolean;
  testID?: string;
  /** Layout only: margins and flex. Never colour, radius or type. */
  style?: StyleProp<ViewStyle>;
}

/** The grouping surface. White, card radius, hairline border, no shadow. */
export function Card({ children, flush = false, testID, style }: CardProps) {
  const ds = useScaledStyles();

  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: color.card,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: color.hairline,
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
