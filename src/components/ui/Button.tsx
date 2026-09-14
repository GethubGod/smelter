import React, { useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, motion, radius, size, space, typeScale, weight } from '@/theme/tokens';
import { Loading } from './Loading';

export type ButtonVariant = 'primary' | 'secondary' | 'ink' | 'white' | 'destructive';
export type ButtonSize = 'default' | 'small';
export type ButtonShape = 'pill';

const BUTTON_RADIUS: Record<ButtonShape, number> = {
  pill: radius.pill,
};

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary for the one main action, secondary for the alternative, destructive for delete and suspend. */
  variant?: ButtonVariant;
  /** `small` is the inline row action (Add, Remind, Order). */
  size?: ButtonSize;
  shape?: ButtonShape;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  leading?: React.ReactNode;
  /** Full width in forms (the default), hugging in rows. */
  fullWidth?: boolean;
  /** Render on the black auth surface. */
  onDark?: boolean;
  accessibilityHint?: string;
  testID?: string;
  /** Layout only: margins and flex. Never colour, radius or type. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The only button in the app.
 *
 * One primary button is visible per screen; everything else is secondary or
 * small. Status colours never appear here: destructive uses the alert pair.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size: buttonSize = 'default',
  shape = 'pill',
  loading = false,
  disabled = false,
  icon,
  leading,
  fullWidth,
  onDark = false,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const ds = useScaledStyles();
  const pressScale = useRef(new Animated.Value(1)).current;
  const isSmall = buttonSize === 'small';
  const inert = disabled || loading;
  const stretches = fullWidth ?? !isSmall;

  const palette = resolvePalette(variant, disabled, onDark);
  // Small buttons stay at the contract's 34pt so they line up with chips; the
  // touch target is restored with hitSlop rather than by growing the pill.
  const height = isSmall
    ? ds.spacing(size.buttonSmall)
    : Math.max(size.touchMin, ds.spacing(onDark ? size.authButton : size.button));
  const slop = Math.max(0, Math.ceil((size.touchMin - height) / 2));
  const fontSize = ds.fontSize(isSmall ? typeScale.secondary : typeScale.body);
  const iconSize = ds.icon(isSmall ? typeScale.secondary : typeScale.body) + 2;

  const animatePress = (toValue: number) => {
    Animated.timing(pressScale, {
      toValue,
      duration: ds.reduceMotion ? 1 : 90,
      easing: Easing.bezier(...motion.ease),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        { alignSelf: stretches ? 'stretch' : 'flex-start', transform: [{ scale: pressScale }] },
        style,
      ]}
    >
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => animatePress(0.98)}
      onPressOut={() => animatePress(1)}
      disabled={inert}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy: loading }}
      testID={testID}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: ds.spacing(onDark ? 10 : space[2]),
          height,
          minHeight: height,
          paddingHorizontal: ds.spacing(isSmall ? space[3] + 2 : space[5]),
          borderRadius: BUTTON_RADIUS[shape],
          backgroundColor: palette.background,
          borderWidth: palette.border ? 1 : 0,
          borderColor: palette.border,
          alignSelf: 'stretch',
        },
      ]}
    >
      {loading ? (
        <Loading size="inline" color={palette.text} label={`${label}, working`} />
      ) : (
        <>
          {leading}
          {icon ? <Ionicons name={icon} size={iconSize} color={palette.text} /> : null}
          <Text
            numberOfLines={1}
            style={{
              fontSize,
              fontWeight: weight.semibold,
              color: palette.text,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
}

function resolvePalette(
  variant: ButtonVariant,
  disabled: boolean,
  onDark: boolean,
): { background: string; text: string; border?: string } {
  if (disabled) {
    return { background: color.disabled, text: color.onAccent };
  }
  if (variant === 'primary') {
    return { background: color.accent, text: color.onAccent };
  }
  if (variant === 'ink') {
    return { background: auth.text, text: color.onAccent };
  }
  if (variant === 'white') {
    return { background: auth.well, text: auth.text, border: auth.buttonRing };
  }
  if (variant === 'destructive') {
    return { background: color.card, text: color.alert };
  }
  return onDark
    ? { background: auth.well, text: auth.text, border: auth.hair }
    : { background: color.card, text: color.ink };
}
