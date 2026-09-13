/**
 * Phase 3 — module access logic: role-default fallbacks, effective module
 * derivation, tab-list building, and the subscription-driven store that keeps
 * tab sets live when a manager flips a toggle.
 */

const mockGetModulesForUser = jest.fn();
const mockSubscribeToMyModules = jest.fn();

jest.mock('@/services/userModules', () => ({
  getModulesForUser: (...args: unknown[]) => mockGetModulesForUser(...args),
  subscribeToMyModules: (...args: unknown[]) => mockSubscribeToMyModules(...args),
}));

/* eslint-disable import/first -- Dependencies must be mocked before importing. */
import {
  MODULE_KEYS,
  getManageableModuleKeys,
  getRoleDefaultModules,
  getVisibleEmployeeTabs,
  getVisibleManagerTabs,
  resolveEffectiveModules,
} from '../store/moduleStore.helpers';
import { acquireModuleAccess, useModuleStore } from '../store/moduleStore';

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('role default modules', () => {
  it('gives employees only the ordering checklist by default', () => {
    expect(getRoleDefaultModules('employee')).toEqual({
      ordering_simple: true,
      ordering_advanced: false,
      stock_check: false,
      tips: false,
      fulfillment: false,
    });
  });

  it('keeps Advanced and Stock check off for managers too', () => {
    expect(getRoleDefaultModules('manager')).toEqual({
      ordering_simple: true,
      ordering_advanced: false,
      stock_check: false,
      tips: true,
      fulfillment: true,
    });
  });

  it('treats an unresolved role like an employee (least privilege)', () => {
    expect(getRoleDefaultModules(null)).toEqual(getRoleDefaultModules('employee'));
  });
});

describe('resolveEffectiveModules', () => {
  it('returns pure role defaults when nothing was fetched (fetch failure fallback)', () => {
    expect(resolveEffectiveModules('employee', null)).toEqual(
      getRoleDefaultModules('employee'),
    );
  });

  it('overlays fetched states on top of role defaults', () => {
    const effective = resolveEffectiveModules('employee', [
      { key: 'ordering_advanced', enabled: true },
      { key: 'stock_check', enabled: false },
    ]);

    expect(effective).toEqual({
      ordering_simple: true,
      ordering_advanced: true,
      stock_check: false,
      tips: false,
      fulfillment: false,
    });
  });

  it('lets fetched states disable manager defaults', () => {
    const effective = resolveEffectiveModules('manager', [
      { key: 'fulfillment', enabled: false },
    ]);

    expect(effective.fulfillment).toBe(false);
    expect(effective.ordering_advanced).toBe(false);
  });
});

describe('employee tab list (floating pill)', () => {
  it('is checklist-first for default employees: Order / History / Settings', () => {
    expect(getVisibleEmployeeTabs(getRoleDefaultModules('employee'))).toEqual([
      'simple-order',
      'history',
      'settings',
    ]);
  });

  it('drops the Order tab when ordering_simple is switched off', () => {
    const modules = { ...getRoleDefaultModules('employee'), ordering_simple: false };
    expect(getVisibleEmployeeTabs(modules)).toEqual([
      'history',
      'settings',
    ]);
  });

  it('never adds Advanced or Cart for a stale ordering_advanced override', () => {
    const modules = {
      ...getRoleDefaultModules('employee'),
      ordering_simple: false,
      ordering_advanced: true,
    };
    expect(getVisibleEmployeeTabs(modules)).toEqual([
      'history',
      'settings',
    ]);
  });

  it('keeps Order / History / Settings when both ordering keys are on', () => {
    const modules = {
      ...getRoleDefaultModules('employee'),
      ordering_simple: true,
      ordering_advanced: true,
    };
    expect(getVisibleEmployeeTabs(modules)).toEqual([
      'simple-order',
      'history',
      'settings',
    ]);
  });

  it('never shows Home or Cart to a checklist-only employee', () => {
    const tabs = getVisibleEmployeeTabs(getRoleDefaultModules('employee'));
    expect(tabs).not.toContain('index');
    expect(tabs).not.toContain('cart');
  });

  it('never renders a tips tab yet, even when the module is enabled (Phase 4 ships the surface)', () => {
    const modules = { ...getRoleDefaultModules('employee'), tips: true };
    expect(getVisibleEmployeeTabs(modules)).not.toContain('tips');
  });
});

describe('manager tab list', () => {
  it('uses Home, Fulfillment, History, and Settings for default managers', () => {
    expect(getVisibleManagerTabs(getRoleDefaultModules('manager'))).toEqual([
      'index',
      'fulfillment',
      'fulfillment-history',
      'profile',
    ]);
  });

  it('drops the fulfillment tab when the module is off', () => {
    const modules = { ...getRoleDefaultModules('manager'), fulfillment: false };
    expect(getVisibleManagerTabs(modules)).toEqual([
      'index',
      'fulfillment-history',
      'profile',
    ]);
  });

  it('never adds Quick Order for a stale ordering_advanced override', () => {
    const modules = { ...getRoleDefaultModules('manager'), ordering_advanced: true };
    expect(getVisibleManagerTabs(modules)).toEqual([
      'index',
      'fulfillment',
      'fulfillment-history',
      'profile',
    ]);
  });
});

describe('manageable module keys', () => {
  it('excludes hidden and manager-side modules for employees', () => {
    expect(getManageableModuleKeys('employee')).toEqual([
      'ordering_simple',
      'tips',
    ]);
  });

  it('excludes hidden modules from manager editing', () => {
    expect(getManageableModuleKeys('manager')).toEqual([
      'ordering_simple',
      'tips',
      'fulfillment',
    ]);
  });

  it('retains hidden compatibility keys for guards and stored overrides', () => {
    expect(MODULE_KEYS).toEqual(expect.arrayContaining([
      'ordering_advanced',
      'stock_check',
    ]));
  });
});

describe('module store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useModuleStore.setState({ userId: null, fetched: null, status: 'idle' });
    mockSubscribeToMyModules.mockReturnValue(jest.fn());
  });

  it('loads the effective module set and marks the store ready', async () => {
    mockGetModulesForUser.mockResolvedValue([{ key: 'stock_check', enabled: true }]);

    await useModuleStore.getState().load('user-1');

    expect(useModuleStore.getState()).toMatchObject({
      userId: 'user-1',
      fetched: [{ key: 'stock_check', enabled: true }],
      status: 'ready',
    });
    expect(mockGetModulesForUser).toHaveBeenCalledWith('user-1');
  });

  it('falls back to no data (role defaults downstream) when the fetch fails', async () => {
    mockGetModulesForUser.mockRejectedValue(new Error('network down'));

    await useModuleStore.getState().load('user-1');

    expect(useModuleStore.getState()).toMatchObject({
      userId: 'user-1',
      fetched: null,
      status: 'error',
    });
    // Downstream consumers resolve to role defaults so nobody is locked out.
    expect(resolveEffectiveModules('employee', null).stock_check).toBe(false);
  });

  it('keeps last-known data when a refresh for the same user fails', async () => {
    mockGetModulesForUser.mockResolvedValueOnce([{ key: 'tips', enabled: true }]);
    await useModuleStore.getState().load('user-1');

    mockGetModulesForUser.mockRejectedValueOnce(new Error('flaky'));
    await useModuleStore.getState().load('user-1');

    expect(useModuleStore.getState()).toMatchObject({
      fetched: [{ key: 'tips', enabled: true }],
      status: 'error',
    });
  });

  it('drops stale data when a different user loads', async () => {
    mockGetModulesForUser.mockResolvedValueOnce([{ key: 'tips', enabled: true }]);
    await useModuleStore.getState().load('user-1');

    let resolveSecond: (value: unknown) => void = () => {};
    mockGetModulesForUser.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSecond = resolve;
      }),
    );
    const secondLoad = useModuleStore.getState().load('user-2');

    // While in flight, the first user's data must not leak to the second.
    expect(useModuleStore.getState()).toMatchObject({
      userId: 'user-2',
      fetched: null,
      status: 'loading',
    });

    resolveSecond([{ key: 'fulfillment', enabled: false }]);
    await secondLoad;

    expect(useModuleStore.getState()).toMatchObject({
      fetched: [{ key: 'fulfillment', enabled: false }],
      status: 'ready',
    });
  });

  it('does not restore revoked modules when an older request finishes last', async () => {
    let resolveOlder: (value: unknown) => void = () => {};
    mockGetModulesForUser.mockReturnValueOnce(new Promise((resolve) => { resolveOlder = resolve; }));
    const older = useModuleStore.getState().load('user-1');
    mockGetModulesForUser.mockResolvedValueOnce([{ key: 'fulfillment', enabled: false }]);
    await useModuleStore.getState().load('user-1');
    resolveOlder([{ key: 'fulfillment', enabled: true }]);
    await older;

    expect(useModuleStore.getState().fetched).toEqual([{ key: 'fulfillment', enabled: false }]);
  });

  it('ignores an old request after reset and sign-in by the same user', async () => {
    let resolveOlder: (value: unknown) => void = () => {};
    mockGetModulesForUser.mockReturnValueOnce(new Promise((resolve) => { resolveOlder = resolve; }));
    const older = useModuleStore.getState().load('user-1');
    useModuleStore.getState().reset();
    mockGetModulesForUser.mockResolvedValueOnce([{ key: 'fulfillment', enabled: false }]);
    await useModuleStore.getState().load('user-1');
    resolveOlder([{ key: 'fulfillment', enabled: true }]);
    await older;

    expect(useModuleStore.getState().fetched).toEqual([{ key: 'fulfillment', enabled: false }]);
  });

  it('subscribes once, reloads on realtime changes, and tears down on last release', async () => {
    const unsubscribe = jest.fn();
    let realtimeCallback: () => void = () => {};
    mockSubscribeToMyModules.mockImplementation((onChange: () => void) => {
      realtimeCallback = onChange;
      return unsubscribe;
    });
    mockGetModulesForUser.mockResolvedValue([{ key: 'ordering_simple', enabled: true }]);

    const releaseA = acquireModuleAccess('user-1');
    const releaseB = acquireModuleAccess('user-1');
    await flushPromises();

    expect(mockSubscribeToMyModules).toHaveBeenCalledTimes(1);
    expect(mockSubscribeToMyModules).toHaveBeenCalledWith(expect.any(Function), 'user-1');
    expect(mockGetModulesForUser).toHaveBeenCalledTimes(1);

    // A manager flips a toggle → realtime callback → reload (live tab flip).
    mockGetModulesForUser.mockResolvedValue([{ key: 'ordering_simple', enabled: false }]);
    realtimeCallback();
    await flushPromises();

    expect(mockGetModulesForUser).toHaveBeenCalledTimes(2);
    expect(useModuleStore.getState().fetched).toEqual([
      { key: 'ordering_simple', enabled: false },
    ]);

    releaseA();
    expect(unsubscribe).not.toHaveBeenCalled();

    releaseB();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(useModuleStore.getState()).toMatchObject({
      userId: null,
      fetched: null,
      status: 'idle',
    });
  });
});
