import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, space, tracking, typeScale, weight } from '@/theme/tokens';

export interface SectionLabelProps {
  children: string;
  /** Render on the black auth surface. */
  onDark?: boolean;
  testID?: string;
  style?: StyleProp<TextStyle>;
}

/** Caption token in ink3, uppercase, 14 above and 4 below. */
export function SectionLabel({ children, onDark = false, testID, style }: SectionLabelProps) {
  const ds = useScaledStyles();

  return (
    <Text
      accessibilityRole="header"
      testID={testID}
      style={[
        {
          marginTop: ds.spacing(space[3] + 2),
          marginBottom: ds.spacing(space[1]),
          fontSize: ds.fontSize(typeScale.caption),
          fontWeight: weight.bold,
          letterSpacing: tracking.caption,
          textTransform: 'uppercase',
          color: onDark ? auth.dim : color.ink3,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
