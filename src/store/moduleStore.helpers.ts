// Pure module-access logic. Role defaults here MUST mirror the latest SQL
// get_effective_modules definition. Advanced ordering and Stock check remain
// compatibility keys for guarded routes and stored overrides, but 2.4 does not
// expose either module in daily navigation or manager-facing controls.

import type { ModuleKey, ModuleState } from '@/services/userModules';
import type { UserRole } from '@/types';

export type EffectiveModules = Record<ModuleKey, boolean>;

export const MODULE_KEYS: readonly ModuleKey[] = [
  'ordering_simple',
  'ordering_advanced',
  'stock_check',
  'tips',
  'fulfillment',
] as const;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  ordering_simple: 'Simple ordering',
  ordering_advanced: 'Advanced ordering (Beta)',
  stock_check: 'Stock check',
  tips: 'Tips',
  fulfillment: 'Fulfillment',
};

const MANAGEABLE_MODULE_KEYS: readonly ModuleKey[] = [
  'ordering_simple',
  'tips',
  'fulfillment',
] as const;

/**
 * Module keys a manager can toggle for a given user. Fulfillment is a
 * manager-side surface, so employee rows never expose it.
 */
export function getManageableModuleKeys(role: UserRole): ModuleKey[] {
  return role === 'manager'
    ? [...MANAGEABLE_MODULE_KEYS]
    : MANAGEABLE_MODULE_KEYS.filter((key) => key !== 'fulfillment');
}

export function getRoleDefaultModules(role: UserRole | null): EffectiveModules {
  const isManager = role === 'manager';
  return {
    ordering_simple: true,
    ordering_advanced: false,
    stock_check: false,
    tips: isManager,
    fulfillment: isManager,
  };
}

/**
 * Effective module map for a user: role defaults overlaid with whatever the
 * server returned. `fetched: null` (nothing loaded / fetch failed) yields the
 * pure role defaults.
 */
export function resolveEffectiveModules(
  role: UserRole | null,
  fetched: ModuleState[] | null,
): EffectiveModules {
  const effective = getRoleDefaultModules(role);
  for (const state of fetched ?? []) {
    if (MODULE_KEYS.includes(state.key)) {
      effective[state.key] = state.enabled;
    }
  }
  return effective;
}

/**
 * Employee tab-bar entries, in display order. Advanced and Cart stay hidden
 * even if an older explicit override still enables ordering_advanced. Their
 * route guards remain intact for compatibility.
 *
 * TODO-PHASE4: append a 'tips' tab (gated by modules.tips) once the tips
 * surface ships. The gate exists today but must never show a broken screen,
 * so no tab is rendered yet.
 */
export function getVisibleEmployeeTabs(modules: EffectiveModules): string[] {
  const tabs: string[] = [];
  if (modules.ordering_simple) tabs.push('simple-order');
  tabs.push('history');
  tabs.push('settings');
  return tabs;
}

/** Manager tab-bar entries, in display order, for a given module map. */
export function getVisibleManagerTabs(modules: EffectiveModules): string[] {
  const tabs: string[] = ['index'];
  if (modules.fulfillment) tabs.push('fulfillment');
  tabs.push('fulfillment-history');
  tabs.push('profile');
  return tabs;
}
