import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  glassColors,
  glassTypography,
} from '@/theme/design';
import { typeScale, weight } from '@/theme/tokens';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function SectionHeader({
  title,
  actionLabel,
  onPressAction,
}: SectionHeaderProps) {
  const ds = useScaledStyles();

  return (
    <View className="flex-row items-center justify-between">
      <Text
        style={{
          color: glassColors.textSecondary,
          fontSize: glassTypography.sectionLabel,
          fontWeight: weight.semibold,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {actionLabel && onPressAction ? (
        <TouchableOpacity onPress={onPressAction} hitSlop={8}>
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.secondary),
              fontWeight: weight.semibold,
              color: glassColors.accent,
            }}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
