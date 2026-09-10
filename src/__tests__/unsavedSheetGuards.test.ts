import React from 'react';
import renderer, { act } from 'react-test-renderer';

/**
 * Call-site half of the unsaved-input guard. The primitive is covered in
 * sheetUnsavedInput.test.ts; here the two manager sheets that clear their draft
 * on close must stop being dismissable the moment they hold unsaved input.
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Modal: 'Modal',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  Switch: 'Switch',
  RefreshControl: 'RefreshControl',
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios', select: (values: Record<string, unknown>) => values.ios ?? values.default },
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/hooks/useScaledStyles', () => ({
  useScaledStyles: () => ({
    spacing: (n: number) => n,
    fontSize: (n: number) => n,
    icon: (n: number) => n,
    buttonH: 50,
    rowH: 56,
  }),
}));
jest.mock('@/hooks/useManagedRefresh', () => ({
  useManagedRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));
jest.mock('@/components/ManagerScaleContainer', () => ({ ManagerScaleContainer: 'ManagerScaleContainer' }));
jest.mock('@/components', () => ({ GlassSurface: 'GlassSurface', StackScreenHeader: 'StackScreenHeader' }));
jest.mock('@/components/ui/Loading', () => ({ Loading: 'Loading' }));
jest.mock('@/components/ui/Button', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference the top-level React import
  const ReactModule = require('react');
  return {
    Button: (props: Record<string, unknown>) => ReactModule.createElement('Button', props),
  };
});

// The sheet is a host element here so the guard prop can be read off it.
jest.mock('@/components/ui/Sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference the top-level React import
  const ReactModule = require('react');
  return {
    Sheet: (props: { children?: React.ReactNode }) =>
      ReactModule.createElement('Sheet', props, props.children),
  };
});

const listRecurringReminderRules = jest.fn();
const listEmployeesWithReminderStatus = jest.fn();
jest.mock('@/services', () => ({
  listRecurringReminderRules: () => listRecurringReminderRules(),
  listEmployeesWithReminderStatus: () => listEmployeesWithReminderStatus(),
  deleteRecurringReminderRule: jest.fn(),
  evaluateRecurringReminderRules: jest.fn(),
  upsertRecurringReminderRule: jest.fn(),
}));

const authState = {
  user: { id: 'manager-1', role: 'manager', name: 'Manager' },
  locations: [{ id: 'loc-1', name: 'Sushi' }],
  fetchLocations: jest.fn(),
};
jest.mock('@/store', () => ({
  useAuthStore: Object.assign(
    (selector?: (state: unknown) => unknown) => (selector ? selector(authState) : authState),
    { getState: () => authState }
  ),
}));

function emptyQuery() {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  for (const method of ['select', 'or', 'order', 'limit', 'in', 'eq', 'insert', 'update', 'neq']) {
    query[method] = chain;
  }
  query.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return query;
}
jest.mock('@/lib/supabase', () => ({ supabase: { from: () => emptyQuery() } }));

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference the top-level React import
  const ReactModule = require('react');
  return {
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
    useFocusEffect: (callback: () => void) => ReactModule.useEffect(callback, [callback]),
  };
});

/* eslint-disable import/first -- every mock above must land before the screens load */
import RecurringRemindersScreen from '../../app/(manager)/employee-reminders-recurring';
import { QuickOrderReviewQueueScreen } from '../features/ordering/QuickOrderReviewQueueScreen';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  listRecurringReminderRules.mockResolvedValue([]);
  listEmployeesWithReminderStatus.mockResolvedValue({ employees: [] });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

async function render(Screen: React.ComponentType) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(React.createElement(Screen));
  });
  return tree;
}

function sheetProps(tree: renderer.ReactTestRenderer) {
  return tree.root.find((node) => String(node.type) === 'Sheet').props;
}

it('locks the rejection sheet once a note has been written', async () => {
  const tree = await render(QuickOrderReviewQueueScreen);
  expect(sheetProps(tree).dismissible).toBe(true);

  const noteInput = tree.root.find(
    (node) => String(node.type) === 'TextInput' && node.props.placeholder === 'What needs to be fixed?'
  );
  await act(async () => noteInput.props.onChangeText('Wrong unit on the salmon'));

  expect(sheetProps(tree).dismissible).toBe(false);

  await act(async () => noteInput.props.onChangeText('   '));
  expect(sheetProps(tree).dismissible).toBe(true);

  await act(async () => tree.unmount());
});

it('locks the recurring rule editor once the form has unsaved edits', async () => {
  const tree = await render(RecurringRemindersScreen);

  const newRule = tree.root.find(
    (node) =>
      String(node.type) === 'TouchableOpacity' &&
      node.findAll(
        (child) =>
          String(child.type) === 'Text' &&
          String(child.children.join('')).includes('New Recurring Rule')
      ).length > 0
  );
  await act(async () => newRule.props.onPress());

  expect(sheetProps(tree).visible).toBe(true);
  expect(sheetProps(tree).dismissible).toBe(true);

  const timeInput = tree.root.find(
    (node) => String(node.type) === 'TextInput' && node.props.value === '15:00'
  );
  await act(async () => timeInput.props.onChangeText('16:30'));

  expect(sheetProps(tree).dismissible).toBe(false);

  const cancel = tree.root.find(
    (node) => String(node.type) === 'Button' && node.props.label === 'Cancel'
  );
  await act(async () => cancel.props.onPress());
  expect(sheetProps(tree).visible).toBe(false);

  await act(async () => tree.unmount());
});
