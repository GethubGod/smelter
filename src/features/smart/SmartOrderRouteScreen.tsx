import React from 'react';
import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import type { OrderingMode } from '@/features/ordering/types';
import {
  EMPLOYEE_ORDERING_MODE,
  MANAGER_ORDERING_MODE,
} from '@/features/ordering/modes';
import { SmartOrderScreen } from './SmartOrderScreen';

/**
 * Smart Order stays behind a flag for launch. Flip this to expose the page on
 * every surface whose route mode opts in.
 */
export const SMART_ORDER_ENABLED = false;

/**
 * The single implementation behind both voice routes.
 *
 * `/(tabs)/voice` and `/(manager)/voice` used to repeat the same body: decide
 * whether Smart Order is exposed, and otherwise redirect to that group's home.
 * Both route files are now thin wrappers around this screen.
 */
export interface SmartOrderRouteMode {
  mode: OrderingMode;
  /** Where the route sends a user while Smart Order is not exposed. */
  homeHref: Href;
  /** Whether this surface shows Smart Order at all. */
  exposed: boolean;
}

/**
 * The employee route stays in place for launch stability, but Smart Order is
 * never exposed in employee mode, flag or no flag.
 */
export const EMPLOYEE_SMART_ORDER_ROUTE_MODE: SmartOrderRouteMode = {
  mode: EMPLOYEE_ORDERING_MODE,
  homeHref: '/(tabs)',
  exposed: false,
};

export const MANAGER_SMART_ORDER_ROUTE_MODE: SmartOrderRouteMode = {
  mode: MANAGER_ORDERING_MODE,
  homeHref: '/(manager)',
  exposed: SMART_ORDER_ENABLED,
};

export function SmartOrderRouteScreen({ mode, homeHref, exposed }: SmartOrderRouteMode) {
  if (!exposed) {
    return <Redirect href={homeHref} />;
  }

  return <SmartOrderScreen mode={mode} />;
}
