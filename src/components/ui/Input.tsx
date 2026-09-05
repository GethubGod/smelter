import React from 'react';
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, radius, size, space, typeScale } from '@/theme/tokens';
import { SectionLabel } from './SectionLabel';

export interface InputProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'accessibilityLabel'> {
  label?: string;
  /** Message under the field, in alert. */
  error?: string;
  /** Render on the black auth surface. */
  onDark?: boolean;
  /** Falls back to `label`, then `placeholder`. */
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * The only text field: 48 high, well background, control radius, placeholder
 * in ink3, error line in alert below. On black it uses the auth well.
 */
export function Input({
  label,
  error,
  onDark = false,
  accessibilityLabel,
  containerStyle,
  ...inputProps
}: InputProps) {
  const ds = useScaledStyles();
  const height = Math.max(size.touchMin, ds.spacing(size.input));

  return (
    <View style={containerStyle}>
      {label ? <SectionLabel onDark={onDark}>{label}</SectionLabel> : null}
      <TextInput
        {...inputProps}
        accessibilityLabel={accessibilityLabel ?? label ?? inputProps.placeholder}
        placeholderTextColor={onDark ? auth.dim : color.ink3}
        style={{
          height,
          paddingHorizontal: ds.spacing(space[3] + 2),
          borderRadius: radius.control,
          fontSize: ds.fontSize(typeScale.body),
          color: onDark ? auth.text : color.ink,
          backgroundColor: onDark ? auth.well : color.well,
          borderWidth: onDark ? 1 : 0,
          borderColor: onDark ? auth.wellBorder : undefined,
        }}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{
            marginTop: ds.spacing(space[1] + 2),
            fontSize: ds.fontSize(typeScale.secondary),
            color: color.alert,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
