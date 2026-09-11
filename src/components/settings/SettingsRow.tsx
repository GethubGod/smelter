import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ListRow } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { space } from '@/theme/tokens';

export interface SettingsRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  /** Renders the contract's destructive Button instead of a row. */
  destructive?: boolean;
  rightElement?: React.ReactNode;
  disabled?: boolean;
  showBorder?: boolean;
  /**
   * @deprecated The contract has one icon tile and one hairline. Accepted so
   * screens outside this sweep keep compiling; ignored.
   */
  iconColor?: string;
  /** @deprecated See `iconColor`. */
  iconBgColor?: string;
  /** @deprecated See `iconColor`. */
  borderColor?: string;
}

/**
 * A settings entry. Non-destructive rows are the contract `ListRow`.
 *
 * Destructive entries render `Button variant="destructive"`: the contract puts
 * action colour on buttons, and `ListRow` has no destructive tone.
 */
export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  destructive = false,
  rightElement,
  disabled = false,
  showBorder = true,
}: SettingsRowProps) {
  const ds = useScaledStyles();

  if (destructive) {
    return (
      <View style={{ paddingVertical: ds.spacing(space[3]) }}>
        <Button
          variant="destructive"
          label={title}
          icon={icon}
          onPress={onPress ?? (() => undefined)}
          disabled={disabled || !onPress}
          fullWidth
        />
      </View>
    );
  }

  return (
    <ListRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      right={rightElement}
      chevron={showChevron && !rightElement}
      disabled={disabled}
      last={!showBorder}
    />
  );
}
