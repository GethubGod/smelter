import React from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space, typeScale, weight } from '@/theme/tokens';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Icon tile on the left. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Right slot: a value, a toggle, a stepper, a small Button, a StatusPill. */
  right?: React.ReactNode;
  /** Draws the chevron in the right slot. Ignored when `right` is set. */
  chevron?: boolean;
  onPress?: () => void;
  /** Last row in a group drops its separator. */
  last?: boolean;
  disabled?: boolean;
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
  right,
  chevron = false,
  onPress,
  last = false,
  disabled = false,
  accessibilityHint,
  testID,
  style,
}: ListRowProps) {
  const ds = useScaledStyles();
  const tile = ds.icon(32);

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
          borderBottomColor: color.hairline,
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
            backgroundColor: color.well,
          }}
        >
          <Ionicons name={icon} size={ds.icon(16)} color={color.ink2} />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: ds.fontSize(typeScale.body),
            fontWeight: weight.semibold,
            color: color.ink,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right ?? (chevron ? <Ionicons name="chevron-forward" size={ds.icon(18)} color={color.ink3} /> : null)}
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
      accessibilityState={{ disabled }}
      testID={testID}
    >
      {body}
    </TouchableOpacity>
  );
}
