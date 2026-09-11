import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ListRow } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { space } from '@/theme/tokens';

/** One row inside a settings card. The contract `ListRow`. */

interface SettingsCardRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string | null;
  onPress?: () => void;
  isLast?: boolean;
  destructive?: boolean;
  /** Rendered at the trailing edge instead of the chevron. */
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  accessibilityLabel?: string;
}

export function SettingsCardRow({
  icon,
  title,
  subtitle,
  onPress,
  isLast = false,
  destructive = false,
  rightElement,
  showChevron = true,
  accessibilityLabel,
}: SettingsCardRowProps) {
  const ds = useScaledStyles();

  // Action colour lives on buttons, never on a row title, so a destructive
  // entry is the contract's destructive Button.
  if (destructive) {
    return (
      <View style={{ paddingVertical: ds.spacing(space[3]) }}>
        <Button
          variant="destructive"
          icon={icon}
          label={title}
          accessibilityHint={accessibilityLabel === title ? undefined : accessibilityLabel}
          disabled={!onPress}
          onPress={onPress ?? (() => undefined)}
          fullWidth
        />
      </View>
    );
  }

  return (
    <ListRow
      icon={icon}
      title={title}
      subtitle={subtitle ?? undefined}
      onPress={onPress}
      right={rightElement}
      chevron={showChevron && !rightElement && Boolean(onPress)}
      last={isLast}
    />
  );
}

/** Card wrapper for settings rows. Rows carry their own padding. */
export function SettingsCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ds = useScaledStyles();

  return (
    <Card
      flush
      style={[{ paddingHorizontal: ds.spacing(space[3] + 2), overflow: 'hidden' }, style]}
    >
      {children}
    </Card>
  );
}
