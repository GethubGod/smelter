import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';

interface ScreenHeaderBaseProps {
  title: string;
  subtitle?: string;
  /** One right-hand slot: a `Button size="small"`, a chip, or a header icon. */
  right?: React.ReactNode;
  /** Render on the black auth surface. */
  onDark?: boolean;
  /** The header owns the top safe-area padding so screens stop doing it. */
  includeSafeArea?: boolean;
  backAccessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * `mode` and `onBack` are one decision, not two.
 *
 * A pushed header without a handler used to type-check and then render no back
 * control at all, stranding the screen. Modelling the two modes as a union
 * makes that a compile error, and makes a stray `onBack` on a root header an
 * error too.
 */
export type ScreenHeaderProps = ScreenHeaderBaseProps &
  (
    | {
        /** `root` is a tab screen and has no back. */
        mode?: 'root';
        onBack?: never;
      }
    | {
        /** `pushed` has the circle back button, so it must have a handler. */
        mode: 'pushed';
        onBack: () => void;
      }
  );

/**
 * The only screen header (contract variant H1).
 *
 * Root tab screens get a 28pt display title with the action on the right.
 * Pushed screens get a 40pt well circle back button and a 20pt title beside
 * it, subtitle underneath. It owns safe-area padding.
 */
export function ScreenHeader({
  title,
  mode = 'root',
  subtitle,
  right,
  onBack,
  onDark = false,
  includeSafeArea = true,
  backAccessibilityLabel = 'Back',
  testID,
  style,
}: ScreenHeaderProps) {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const pushed = mode === 'pushed';
  const circle = Math.max(size.touchMin, ds.icon(size.headerCircle));
  const titleColor = onDark ? auth.text : color.ink;
  const subtitleColor = onDark ? auth.dim : color.ink2;

  return (
    <View
      testID={testID}
      style={[
        {
          paddingTop: (includeSafeArea ? insets.top : 0) + ds.spacing(space[1]),
          paddingHorizontal: ds.spacing(space[4]),
          paddingBottom: ds.spacing(space[3] - 2),
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(space[3]) }}>
        {/* The union above guarantees a handler whenever mode is pushed. */}
        {pushed ? (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: circle,
              height: circle,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: onDark ? auth.well : color.well,
            }}
          >
            <Ionicons name="chevron-back" size={ds.icon(18)} color={titleColor} />
          </TouchableOpacity>
        ) : null}

        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={pushed ? 1 : 2}
            style={{
              fontSize: ds.fontSize(pushed ? typeScale.title : typeScale.display),
              fontWeight: weight.bold,
              letterSpacing: pushed ? tracking.title : tracking.display,
              color: titleColor,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                marginTop: ds.spacing(space[1] / 2),
                fontSize: ds.fontSize(typeScale.secondary),
                color: subtitleColor,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right}
      </View>
    </View>
  );
}
