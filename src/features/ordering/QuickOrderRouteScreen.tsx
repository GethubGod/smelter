import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useModuleAccessGuard } from '@/hooks';
import { ScreenHeader } from '@/components/ui';
import { color } from '@/theme/tokens';
import type { OrderingMode } from './types';
import { EMPLOYEE_ORDERING_MODE, MANAGER_ORDERING_MODE } from './modes';
import { QuickOrderScreen } from './QuickOrderScreen';

/**
 * The single implementation behind both advanced-ordering routes.
 *
 * `/(tabs)/quick-order` and `/(manager)/quick-order` used to repeat the same
 * body: the `ordering_advanced` module guard, the error boundary and the chat
 * screen, differing only in the ordering mode, the home route the guard
 * redirects to, the boundary's title and whether the surface carries its own
 * header. Both route files are now thin wrappers around this screen.
 */
export interface QuickOrderRouteMode {
  mode: OrderingMode;
  /** Where the module guard sends a user whose `ordering_advanced` is off. */
  homeHref: Href;
  /** Title for the error boundary that wraps the chat screen. */
  errorTitle: string;
  /**
   * Header rendered above the chat screen, or `null` when the surface relies
   * on the navigator's own header.
   */
  headerTitle: string | null;
}

/**
 * Phase 3: this surface is gated by the ordering_advanced module. Deep links
 * to a disabled module redirect home, mirroring how role guards behave.
 *
 * The tab bar shows the space-constrained "Advanced" label, so the employee
 * route keeps the full name visible on the screen itself.
 */
export const EMPLOYEE_QUICK_ORDER_ROUTE_MODE: QuickOrderRouteMode = {
  mode: EMPLOYEE_ORDERING_MODE,
  homeHref: '/(tabs)',
  errorTitle: 'Advanced ordering unavailable',
  headerTitle: 'Advanced ordering',
};

/**
 * Phase 3: the manager Quick Order surface honors the same ordering_advanced
 * module toggle the dashboard exposes for manager rows (managers default
 * all-on, so nothing changes until a manager is explicitly toggled off).
 */
export const MANAGER_QUICK_ORDER_ROUTE_MODE: QuickOrderRouteMode = {
  mode: MANAGER_ORDERING_MODE,
  homeHref: '/(manager)',
  errorTitle: 'Quick Order unavailable',
  headerTitle: null,
};

export function QuickOrderRouteScreen({
  mode,
  homeHref,
  errorTitle,
  headerTitle,
}: QuickOrderRouteMode) {
  const guard = useModuleAccessGuard('ordering_advanced', homeHref);

  if (guard.isChecking) {
    return null;
  }

  if (guard.redirectTo) {
    return <Redirect href={guard.redirectTo} />;
  }

  const boundary = (
    <ErrorBoundary title={errorTitle}>
      <QuickOrderScreen mode={mode} />
    </ErrorBoundary>
  );

  if (!headerTitle) {
    return boundary;
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.page }}>
      <ScreenHeader title={headerTitle} />
      {boundary}
    </View>
  );
}
