import React from 'react';
import { Easing } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AuthLoadingScreen } from '@/components';
import { useMyModules, useProtectedAuthGuard } from '@/hooks';
import { TabBar, type TabBarItem } from '@/components/ui';
import { GlidePage } from '@/components/ui/GlidePage';
import { useManagerFulfillmentOverview } from '@/features/fulfillment/useManagerFulfillmentOverview';
import { motion } from '@/theme/tokens';
import { ImpactFeedbackStyle, triggerImpactHaptic } from '@/lib/haptics';

const ROOT_ROUTES = new Set(['index', 'fulfillment', 'fulfillment-history', 'profile']);
const PUSHED_DOCK_ROUTES = new Set([
  'inventory', 'fulfillment-confirmation', 'manager-settings/export-format',
  'manager-settings/team', 'manager-settings/team-invite',
  'manager-settings/team-member', 'manager-settings/team-defaults',
]);
const HIDDEN_DOCK_ROUTES = new Set(['orders', 'orders/pending', 'cart', 'fulfillment-send-all', 'past-orders/index', 'past-orders/[id]']);

function ManagerTabBar({ state, navigation, fulfillmentEnabled }: BottomTabBarProps & { fulfillmentEnabled: boolean }) {
  const { supplierCount } = useManagerFulfillmentOverview();
  const current = state.routes[state.index]?.name ?? 'index';
  if (!PUSHED_DOCK_ROUTES.has(current) && (HIDDEN_DOCK_ROUTES.has(current) || current.startsWith('manager-settings/') || current.startsWith('employee-reminders'))) return null;
  const tabs: TabBarItem[] = [
    { name: 'index', label: 'Home', icon: 'home-outline' },
    ...(fulfillmentEnabled ? [{ name: 'fulfillment', label: 'Fulfillment', icon: 'clipboard-outline' as const, badge: supplierCount }] : []),
    { name: 'fulfillment-history', label: 'History', icon: 'time-outline' },
    { name: 'profile', label: 'Settings', icon: 'person-outline' },
  ];
  const visibleRoots = new Set(tabs.map(tab => tab.name));
  const parent = [...state.history].reverse().flatMap(entry => {
    if (entry.type !== 'route') return [];
    const route = state.routes.find(candidate => candidate.key === entry.key);
    return route && visibleRoots.has(route.name) ? [route.name] : [];
  })[0];
  const fallback = current.startsWith('manager-settings/') ? 'profile'
    : current === 'fulfillment-confirmation' && fulfillmentEnabled ? 'fulfillment'
      : current.includes('history') ? 'fulfillment-history' : 'index';
  return <TabBar tabs={tabs} active={visibleRoots.has(current) ? current : parent ?? fallback} onPress={name => {
    const route = state.routes.find(entry => entry.name === name);
    const event = navigation.emit({ type: 'tabPress', target: route?.key, canPreventDefault: true });
    if (!event.defaultPrevented) { void triggerImpactHaptic(ImpactFeedbackStyle.Light); navigation.navigate(name); }
  }} />;
}

export default function ManagerLayout() {
  const guard = useProtectedAuthGuard({ requireManager: true });
  const { modules } = useMyModules(guard.resolvedRole);
  if (guard.isChecking) return <AuthLoadingScreen />;
  if (guard.redirectTo) return <Redirect href={guard.redirectTo} />;
  return <>
    <StatusBar style="dark" />
    <Tabs backBehavior="history" detachInactiveScreens={false}
      screenLayout={({ children, route, navigation }) => <GlidePage pushed={!ROOT_ROUTES.has(route.name)} onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('index')}>{children}</GlidePage>}
      screenOptions={{ headerShown: false, animation: 'fade', transitionSpec: { animation: 'timing', config: { duration: 340, easing: Easing.bezier(...motion.ease) } }, sceneStyleInterpolator: () => ({ sceneStyle: {} }) }}
      tabBar={props => <ManagerTabBar {...props} fulfillmentEnabled={modules.fulfillment} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="fulfillment" options={{ title: 'Fulfillment', href: modules.fulfillment ? undefined : null }} />
      <Tabs.Screen name="fulfillment-history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Settings' }} />
      <Tabs.Screen name="browse" options={{ href: null }} />
      <Tabs.Screen name="quick-order" options={{ href: null }} />
      <Tabs.Screen name="voice" options={{ href: null }} />
      {/* Hidden screens (accessible via navigation) */}
      <Tabs.Screen name="orders" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="orders/pending" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="inventory" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="export-fish-order" options={{ href: null }} />
      <Tabs.Screen name="fulfillment-confirmation" options={{ href: null }} />
      <Tabs.Screen name="fulfillment-send-all" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="fulfillment-history-detail" options={{ href: null }} />
      <Tabs.Screen name="past-orders/index" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="past-orders/[id]" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="manager-settings/export-format" options={{ href: null }} />
      <Tabs.Screen name="manager-settings/user-management" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="manager-settings/profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="manager-settings/quick-order-config" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="manager-settings/supplier-contacts" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="manager-settings/team" options={{ href: null }} />
      <Tabs.Screen name="manager-settings/team-invite" options={{ href: null }} />
      <Tabs.Screen name="manager-settings/team-invite-link" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="manager-settings/team-member" options={{ href: null }} />
      <Tabs.Screen name="manager-settings/team-preview" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="manager-settings/team-defaults" options={{ href: null }} />
      <Tabs.Screen name="employee-reminders" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="employee-reminders-recurring" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="employee-reminders-settings" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="employee-reminders-delivery" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  </>;
}
