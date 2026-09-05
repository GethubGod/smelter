import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, shadow, size, space, typeScale, weight } from '@/theme/tokens';

export interface TabBarItem {
  /** Route name. Passed back to `onPress`. */
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

export interface TabBarQuickActions {
  onPress: () => void;
  accessibilityLabel?: string;
}

export interface TabBarProps {
  tabs: readonly TabBarItem[];
  /** Route name of the active tab. */
  active: string;
  onPress: (name: string) => void;
  /** Appends the divider and the dots button, as on the employee Order tab. */
  quickActions?: TabBarQuickActions;
  testID?: string;
}

/** Clearance a screen must reserve below its content for the floating pill. */
export function getTabBarClearance(insetsBottom: number): number {
  return Math.max(insetsBottom, 10) + 4 + 54 + 12;
}

/**
 * The floating pill navigation, for both the employee and the manager role
 * (contract variant T1).
 *
 * Inactive tabs are icon only; the active tab expands with the tint fill and
 * its label. Presentational on purpose: the `_layout` files map their
 * navigator state onto `tabs`, `active` and `onPress`, and configure nothing
 * of their own.
 */
export function TabBar({ tabs, active, onPress, quickActions, testID }: TabBarProps) {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const iconSize = ds.icon(size.icon);

  return (
    <View
      pointerEvents="box-none"
      testID={testID}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(insets.bottom, 10) + 4,
        alignItems: 'center',
      }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          padding: ds.spacing(space[2] - 1),
          borderRadius: radius.pill,
          backgroundColor: color.card,
          borderWidth: 1,
          borderColor: color.hairline,
          ...shadow.tabBar,
        }}
      >
        {tabs.map((tab) => {
          const selected = tab.name === active;
          const tint = selected ? color.accent : color.tabInactive;
          const badge = tab.badge && tab.badge > 0 ? tab.badge : undefined;
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => onPress(tab.name)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={
                badge === undefined ? tab.label : `${tab.label}, ${badge} waiting`
              }
              accessibilityState={{ selected }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: ds.spacing(space[2] - 1),
                paddingVertical: ds.spacing(space[3] - 2),
                paddingHorizontal: ds.spacing(space[4] - 1),
                borderRadius: radius.pill,
                backgroundColor: selected ? color.tint : 'transparent',
              }}
            >
              <View>
                <Ionicons name={tab.icon} size={iconSize} color={tint} />
                {badge === undefined ? null : (
                  <View
                    style={{
                      position: 'absolute',
                      top: -5,
                      right: -8,
                      minWidth: size.badge,
                      height: size.badge,
                      paddingHorizontal: 3,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.pill,
                      backgroundColor: color.accent,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 9, fontWeight: weight.bold, color: color.onAccent }}
                    >
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                )}
              </View>
              {selected ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: ds.fontSize(typeScale.secondary),
                    fontWeight: weight.semibold,
                    color: color.accent,
                  }}
                >
                  {tab.label}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {quickActions ? (
          <>
            <View
              style={{
                width: 1,
                height: size.tabDivider,
                marginHorizontal: ds.spacing(space[1] + 1),
                backgroundColor: color.hairlineStrong,
              }}
            />
            <TouchableOpacity
              onPress={quickActions.onPress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={quickActions.accessibilityLabel ?? 'Quick actions'}
              style={{
                paddingVertical: ds.spacing(space[3] - 2),
                paddingHorizontal: ds.spacing(space[4] - 1),
                borderRadius: radius.pill,
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={iconSize} color={color.tabInactive} />
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
}
