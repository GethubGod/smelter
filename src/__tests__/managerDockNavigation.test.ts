import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ManagerLayout from '../../app/(manager)/_layout';

let mockHistory: string[] = [];
let mockFulfillmentEnabled = true;
const mockNavigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, Easing: { bezier: jest.fn() } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/components', () => ({ AuthLoadingScreen: () => null }));
jest.mock('@/hooks', () => ({
  useProtectedAuthGuard: () => ({ isChecking: false, resolvedRole: 'manager' }),
  useMyModules: () => ({ modules: { fulfillment: mockFulfillmentEnabled } }),
}));
jest.mock('@/features/fulfillment/useManagerFulfillmentOverview', () => ({ useManagerFulfillmentOverview: () => ({ supplierCount: 3 }) }));
jest.mock('@/components/ui/GlidePage', () => ({ GlidePage: () => null }));
jest.mock('@/lib/haptics', () => ({ ImpactFeedbackStyle: { Light: 'light' }, triggerImpactHaptic: jest.fn() }));
jest.mock('@/components/ui', () => ({
  TabBar: (props: object) => React.createElement('div', props),
}));
jest.mock('expo-router', () => {
  const Tabs = ({ tabBar }: { tabBar: (props: object) => React.ReactNode }) => {
    const names = [...new Set(['index', 'fulfillment', 'fulfillment-history', 'profile', ...mockHistory])];
    return tabBar({
      state: {
        routes: names.map(name => ({ name, key: name })),
        index: names.indexOf(mockHistory[mockHistory.length - 1]),
        history: mockHistory.map(key => ({ type: 'route', key })),
      },
      navigation: mockNavigation,
    });
  };
  Tabs.Screen = function MockScreen() { return null; };
  return { Tabs, Redirect: () => null };
});

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
beforeEach(() => { mockFulfillmentEnabled = true; jest.clearAllMocks(); });

function dock(history: string[]) {
  mockHistory = history;
  let tree: renderer.ReactTestRenderer | undefined;
  act(() => { tree = renderer.create(React.createElement(ManagerLayout)); });
  if (!tree) throw new Error('Layout did not render');
  const nodes = tree.root.findAll(node => typeof node.type === 'string' && node.type === 'div');
  const props = nodes[0]?.props;
  act(() => tree?.unmount());
  return props;
}

it('retains Fulfillment through supplier review and its nested format push', () => {
  expect(dock(['index', 'fulfillment', 'fulfillment-confirmation'])?.active).toBe('fulfillment');
  expect(dock(['fulfillment', 'fulfillment-confirmation', 'manager-settings/export-format'])?.active).toBe('fulfillment');
});
it('retains either Home or Settings when they open Inventory', () => {
  expect(dock(['profile', 'index', 'inventory'])?.active).toBe('index');
  expect(dock(['index', 'profile', 'inventory'])?.active).toBe('profile');
});
it('retains Settings through Team and member pushes, then follows a selected root', () => {
  expect(dock(['profile', 'manager-settings/team', 'manager-settings/team-member'])?.active).toBe('profile');
  expect(dock(['profile', 'manager-settings/team', 'index'])?.active).toBe('index');
});
it.each(['cart', 'orders', 'fulfillment-send-all', 'employee-reminders', 'manager-settings/quick-order-config', 'manager-settings/team-preview', 'manager-settings/access-codes'])('preserves the existing hidden dock on %s', route => {
  expect(dock(['profile', route])).toBeUndefined();
});
it('skips disabled Fulfillment history and supplies a parent for a direct push', () => {
  mockFulfillmentEnabled = false;
  expect(dock(['index', 'fulfillment', 'fulfillment-confirmation'])?.active).toBe('index');
  expect(dock(['manager-settings/team'])?.active).toBe('profile');
});
