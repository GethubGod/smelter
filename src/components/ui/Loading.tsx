import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { color, space } from '@/theme/tokens';

export interface LoadingProps {
  /** `screen` centres in the available space; `inline` sits in a row or a button. */
  size?: 'screen' | 'inline';
  /** Inline spinners inherit the surrounding text colour. */
  color?: string;
  label?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The only loading affordance.
 *
 * `LoadingIndicator` is the single host of the native `ActivityIndicator`;
 * everything else in the app goes through this wrapper so there is one size,
 * one colour and one accessibility label.
 */
export function Loading({
  size = 'screen',
  color: tint,
  label = 'Loading',
  testID,
  style,
}: LoadingProps) {
  if (size === 'inline') {
    return (
      <View accessibilityLabel={label} testID={testID} style={style}>
        <LoadingIndicator size="small" color={tint ?? color.accent} />
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space[6],
        },
        style,
      ]}
    >
      <LoadingIndicator size="medium" color={tint ?? color.accent} />
    </View>
  );
}
