import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { glassHairlineWidth } from '@/theme/design';
import { color, radius, typeScale, weight } from '@/theme/tokens';

export interface TabButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  size: number;
  focused: boolean;
}

/**
 * Custom tab button: renders a soft rounded bubble enclosing both
 * the icon and label when active, matching the Babytuna design system.
 */
export function TabButton({ name, label, color: glyphColor, size, focused }: TabButtonProps) {
  return (
    <View
      style={{
        width: 76,
        height: 50,
        borderRadius: radius.sheet,
        paddingTop: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? color.tint : 'transparent',
        borderWidth: focused ? glassHairlineWidth : 0,
        borderColor: focused ? color.tint : 'transparent',
      }}
    >
      <Ionicons name={name} size={size} color={glyphColor} />
      <Text
        style={{
          fontSize: typeScale.caption,
          fontWeight: focused ? weight.semibold : weight.regular,
          color: glyphColor,
          marginTop: 3,
          letterSpacing: 0.1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
