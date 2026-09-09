import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, size, space, typeScale, weight } from '@/theme/tokens';
import { Button, type ButtonProps } from './Button';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  /** Optional secondary action, for example Retry on an error state. */
  action?: Pick<ButtonProps, 'label' | 'onPress'>;
  /** Errors use the alert icon colour and a Retry action. */
  tone?: 'neutral' | 'alert';
  compact?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The only empty state, and the only error state.
 *
 * Icon in a well circle, one bold line, one plain line, optional secondary
 * button. Error states pass `tone="alert"` with a Retry action.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = 'neutral',
  compact = false,
  testID,
  style,
}: EmptyStateProps) {
  const ds = useScaledStyles();
  const circle = ds.icon(compact ? 44 : size.emptyStateIcon);
  const iconColor = tone === 'alert' ? color.alert : color.ink2;

  return (
    <View
      testID={testID}
      style={[
        {
          alignItems: 'center',
          gap: ds.spacing(space[2]),
          paddingVertical: ds.spacing(compact ? space[4] : space[8]),
          paddingHorizontal: ds.spacing(space[5]),
        },
        style,
      ]}
    >
      <View
        style={{
          width: circle,
          height: circle,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          backgroundColor: tone === 'alert' ? color.alertBg : color.well,
        }}
      >
        <Ionicons name={icon} size={ds.icon(24)} color={iconColor} />
      </View>
      <Text
        accessibilityRole="header"
        style={{
          textAlign: 'center',
          fontSize: ds.fontSize(typeScale.body),
          fontWeight: weight.semibold,
          color: color.ink,
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            textAlign: 'center',
            fontSize: ds.fontSize(typeScale.secondary),
            color: color.ink2,
          }}
        >
          {body}
        </Text>
      ) : null}
      {action ? (
        <Button
          variant="secondary"
          size="small"
          label={action.label}
          onPress={action.onPress}
          style={{ marginTop: ds.spacing(space[1]) }}
        />
      ) : null}
    </View>
  );
}
