import React from 'react';
import { Platform, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ListRow } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color } from '@/theme/tokens';

interface SettingToggleProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  showBorder?: boolean;
  /**
   * @deprecated The contract has one icon tile. Accepted so screens outside
   * this sweep keep compiling; ignored.
   */
  iconColor?: string;
  /** @deprecated See `iconColor`. */
  iconBgColor?: string;
}

/** A `ListRow` with the switch in its right slot. */
export function SettingToggle({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  disabled = false,
  showBorder = true,
}: SettingToggleProps) {
  const ds = useScaledStyles();
  const switchScale = ds.isLarge ? 1.15 : ds.isCompact ? 0.95 : 1;

  return (
    <ListRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      disabled={disabled}
      last={!showBorder}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          accessibilityLabel={title}
          trackColor={{ false: color.well, true: color.accent }}
          thumbColor={Platform.OS === 'android' ? color.card : undefined}
          ios_backgroundColor={color.well}
          disabled={disabled}
          style={{ transform: [{ scaleX: switchScale }, { scaleY: switchScale }] }}
        />
      }
    />
  );
}
