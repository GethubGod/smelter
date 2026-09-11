import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, radius, space, typeScale, weight } from '@/theme/tokens';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /**
   * Icon tile on the left. An Ionicons name draws the standard glyph; an
   * element is drawn in the same tile, for the few marks Ionicons lacks.
   */
  icon?: keyof typeof Ionicons.glyphMap | React.ReactElement;
  /** Black auth surfaces: light text on the well fill instead of dark on white. */
  onDark?: boolean;
  /** Right slot: a value, a toggle, a stepper, a small Button, a StatusPill. */
  right?: React.ReactNode;
  /** Draws the chevron in the right slot. Ignored when `right` is set. */
  chevron?: boolean;
  onPress?: () => void;
  /** Last row in a group drops its separator. */
  last?: boolean;
  disabled?: boolean;
  /**
   * Marks the row as the chosen one in a picker, so the reader announces
   * "selected". Additive: rows that are not part of a choice leave it unset.
   */
  selected?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The settings, team, inventory and order list building block. Rows group
 * inside a `Card` and carry the hairline separator themselves.
 */
export function ListRow({
  title,
  subtitle,
  icon,
  onDark = false,
  right,
  chevron = false,
  onPress,
  last = false,
  disabled = false,
  selected,
  accessibilityHint,
  testID,
  style,
}: ListRowProps) {
  const ds = useScaledStyles();
  const tile = ds.icon(32);
  const titleColor = onDark ? auth.text : color.ink;
  const subtitleColor = onDark ? auth.dim : color.ink2;

  const body = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(space[3]),
          minHeight: ds.spacing(44),
          paddingVertical: ds.spacing(space[3] - 2),
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: onDark ? auth.wellBorder : color.hairline,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: tile,
            height: tile,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.control,
            backgroundColor: onDark ? auth.wellBorder : color.well,
          }}
        >
          {typeof icon === 'string' ? (
            <Ionicons name={icon} size={ds.icon(16)} color={onDark ? auth.text : color.ink2} />
          ) : (
            icon
          )}
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: ds.fontSize(typeScale.body),
            fontWeight: weight.semibold,
            color: titleColor,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={{ fontSize: ds.fontSize(typeScale.secondary), color: subtitleColor }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ??
        (chevron ? (
          <Ionicons
            name="chevron-forward"
            size={ds.icon(18)}
            color={onDark ? auth.dim : color.ink3}
          />
        ) : null)}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessible={false}>
        {body}
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected === undefined ? { disabled } : { disabled, selected }}
      testID={testID}
    >
      {body}
    </TouchableOpacity>
  );
}
