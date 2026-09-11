import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import type { OrderingMode } from '@/features/ordering/types';
import {
  EMPLOYEE_ORDERING_MODE,
  MANAGER_ORDERING_MODE,
} from '@/features/ordering/modes';
import { BrowseInventoryScreenView } from './BrowseInventoryScreenView';
import { isBrowseCategory } from './config';

/**
 * The single implementation behind both browse routes.
 *
 * `/(tabs)/inventory-browse` and `/(manager)/browse` used to hold the same
 * body twice: identical deep-link parameter plumbing, differing only in which
 * ordering mode and home route they handed to `BrowseInventoryScreenView`.
 * Both route files are now thin wrappers around this screen, so the parameter
 * contract lives in one place.
 */
export interface BrowseInventoryRouteMode {
  mode: OrderingMode;
  /** Where the screen sends a user who backs out of browse. */
  fallbackRoute: string;
}

export const EMPLOYEE_BROWSE_ROUTE_MODE: BrowseInventoryRouteMode = {
  mode: EMPLOYEE_ORDERING_MODE,
  fallbackRoute: '/(tabs)',
};

export const MANAGER_BROWSE_ROUTE_MODE: BrowseInventoryRouteMode = {
  mode: MANAGER_ORDERING_MODE,
  fallbackRoute: '/(manager)',
};

function getParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function BrowseInventoryRouteScreen({
  mode,
  fallbackRoute,
}: BrowseInventoryRouteMode) {
  const params = useLocalSearchParams<{
    category?: string | string[];
    focusSearch?: string | string[];
    focusItemId?: string | string[];
    expandItem?: string | string[];
    addItem?: string | string[];
    requestId?: string | string[];
  }>();
  const categoryParam = getParamValue(params.category);
  const focusSearchParam = getParamValue(params.focusSearch);
  const focusItemIdParam = getParamValue(params.focusItemId);
  const expandItemParam = getParamValue(params.expandItem);
  const addItemParam = getParamValue(params.addItem);
  const requestIdParam = getParamValue(params.requestId);

  return (
    <BrowseInventoryScreenView
      mode={mode}
      fallbackRoute={fallbackRoute}
      initialCategory={isBrowseCategory(categoryParam) ? categoryParam : null}
      autoFocusSearch={focusSearchParam === '1'}
      initialFocusItemId={focusItemIdParam ?? null}
      autoExpandFocusedItem={expandItemParam === '1'}
      addFocusedItemOnArrival={addItemParam === '1'}
      focusRequestId={requestIdParam ?? null}
    />
  );
}
