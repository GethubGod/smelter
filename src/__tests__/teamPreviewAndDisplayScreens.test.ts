/**
 * Two screens that told VoiceOver the wrong thing after the #36 sweep.
 *
 * Preview-as drew its own tab row instead of the contract pill, and the
 * display screen shipped two sample buttons wired to a handler that does
 * nothing. Both are illustrations, so both stay out of the touch path and out
 * of the accessibility tree.
 */
import React from 'react';
import renderer, { act, type ReactTestInstance } from 'react-test-renderer';

const getModulesForUser = jest.fn();

/* A jest.mock factory may only `require`; an import would hoist above the mock. */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native', () => require('./ui/nativeMocks').reactNative());
jest.mock('@expo/vector-icons', () => require('./ui/nativeMocks').vectorIcons());
jest.mock('react-native-safe-area-context', () => ({
  ...require('./ui/nativeMocks').safeAreaContext(),
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('@/hooks/useScaledStyles', () => require('./ui/nativeMocks').scaledStyles());
jest.mock('@/components/LoadingIndicator', () => require('./ui/nativeMocks').loadingIndicator());
jest.mock('@/components/BottomSheetShell', () => require('./ui/nativeMocks').bottomSheetShell());
/* The barrel still exports the deprecated header, which drags the auth store in. */
jest.mock('@/components/ui/StackScreenHeader', () => ({ StackScreenHeader: 'StackScreenHeader' }));
jest.mock('@/components/ManagerScaleContainer', () => ({ ManagerScaleContainer: 'ManagerScaleContainer' }));
jest.mock('expo-router', () => {
  const reactModule = require('react');
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: () => ({ userId: 'user-1', name: 'Nate Diaz', group: 'both' }),
    useFocusEffect: (callback: () => void) => {
      reactModule.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});
jest.mock('@/services/userModules', () => ({
  getModulesForUser: (userId: string) => getModulesForUser(userId),
}));
/* The display screen only needs its own two buttons to be inspectable. */
jest.mock('@/components/settings', () => ({
  MultiOptionToggle: 'MultiOptionToggle',
  SettingToggle: 'SettingToggle',
  SettingsGroup: 'SettingsGroup',
  SettingsScreenLayout: 'SettingsScreenLayout',
  SettingsSectionLabel: 'SettingsSectionLabel',
}));
jest.mock('@/store', () => ({
  useDisplayStore: () => ({
    textScale: 1.0,
    setTextScale: jest.fn(),
    uiScale: 'default',
    setUIScale: jest.fn(),
    buttonSize: 'medium',
    setButtonSize: jest.fn(),
    hapticFeedback: true,
    setHapticFeedback: jest.fn(),
    reduceMotion: false,
    setReduceMotion: jest.fn(),
    resetToDefaults: jest.fn(),
  }),
}));
/* eslint-enable @typescript-eslint/no-require-imports */

// The mocks above must land before the screens load.
/* eslint-disable import/first */
import PreviewAsScreen from '@/features/team/PreviewAsScreen';
import DisplayAccessibilitySettingsScreen from '../../app/settings/display-accessibility';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

async function renderScreen(element: React.ReactElement): Promise<ReactTestInstance> {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(element);
  });
  return tree.root;
}

/** True when `node` sits inside a wrapper that takes no touch and no VoiceOver. */
function isInsideInertPreview(root: ReactTestInstance, label: string): boolean {
  return root
    .findAll(
      (node) =>
        node.props.pointerEvents === 'none' && node.props.accessibilityElementsHidden === true,
    )
    .some((wrapper) => wrapper.findAll((node) => node.props.accessibilityLabel === label).length > 0);
}

it('shows the contract tab pill in Preview as, as an illustration', async () => {
  getModulesForUser.mockResolvedValue([
    { key: 'ordering_simple', enabled: true },
    { key: 'ordering_advanced', enabled: false },
  ]);
  const root = await renderScreen(React.createElement(PreviewAsScreen));

  const tabLists = root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'tablist',
  );
  expect(tabLists).toHaveLength(1);

  const tabs = root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'tab',
  );
  expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Order', 'History', 'Settings']);

  // Read-only screen: the pill is a picture of their app, not navigation.
  expect(isInsideInertPreview(root, 'Order')).toBe(true);
});

it('does not offer the display previews as buttons', async () => {
  const root = await renderScreen(React.createElement(DisplayAccessibilitySettingsScreen));

  for (const label of ['Add', 'Sample button']) {
    const control = root.find(
      (node) => typeof node.type === 'string' && node.props.accessibilityLabel === label,
    );
    expect(control.props.accessibilityRole).toBe('button');
    expect(isInsideInertPreview(root, label)).toBe(true);
  }

  // The one real button on the screen still works.
  const reset = root.find(
    (node) => typeof node.type === 'string' && node.props.accessibilityLabel === 'Reset to defaults',
  );
  expect(isInsideInertPreview(root, 'Reset to defaults')).toBe(false);
  expect(typeof reset.props.onPress).toBe('function');
});
