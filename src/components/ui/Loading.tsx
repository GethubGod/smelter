import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { color, space } from '@/theme/tokens';

export interface LoadingProps {
  /** `screen` centres in the available space; `inline` sits in a row or a button. */
  size?: 'screen' | 'inline';
  /** Inline spinners inherit the surrounding text colour. */
  color?: string;
  /** Announced by VoiceOver. Give it context: "Loading orders", not "Loading". */
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
 *
 * `LoadingIndicator` announces itself as a progressbar labelled "Loading",
 * which would drown out the caller's `label`. This wrapper is the labelled
 * accessibility element and the indicator underneath it is hidden from the
 * tree, so VoiceOver reads the caller's label exactly once.
 */
export function Loading({
  size = 'screen',
  color: tint,
  label = 'Loading',
  testID,
  style,
}: LoadingProps) {
  const indicator = (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LoadingIndicator
        size={size === 'inline' ? 'small' : 'medium'}
        color={tint ?? color.accent}
        text={label}
      />
    </View>
  );

  if (size === 'inline') {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        testID={testID}
        style={style}
      >
        {indicator}
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
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
      {indicator}
    </View>
  );
}
