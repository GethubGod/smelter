/**
 * Guards for what the #36 sweep dropped on the way onto the primitives.
 *
 * Three regressions, all invisible to a screenshot: a sheet that stops
 * clearing the home indicator, a form that sits under the keyboard, and an
 * unavailable option that still looks and announces as pressable.
 */
import React from 'react';
import renderer, { act, type ReactTestInstance } from 'react-test-renderer';

/* A jest.mock factory may only `require`; an import would hoist above the mock. */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native', () => {
  const reactModule = require('react');
  const base = require('./ui/nativeMocks').reactNative();
  const host = (name: string) => {
    const Component = ({ children, ...props }: { children?: unknown }) =>
      reactModule.createElement(name, props, children);
    Component.displayName = name;
    return Component;
  };
  return {
    ...base,
    KeyboardAvoidingView: host('KeyboardAvoidingView'),
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});
jest.mock('@expo/vector-icons', () => require('./ui/nativeMocks').vectorIcons());
jest.mock('react-native-safe-area-context', () => require('./ui/nativeMocks').safeAreaContext());
jest.mock('@/hooks/useScaledStyles', () => require('./ui/nativeMocks').scaledStyles());
jest.mock('@/components/LoadingIndicator', () => require('./ui/nativeMocks').loadingIndicator());
/* The barrel still exports the deprecated header, which drags the router and
   the auth store in behind it. Neither is part of what these tests check. */
jest.mock('@/components/ui/StackScreenHeader', () => ({ StackScreenHeader: 'StackScreenHeader' }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: 'DateTimePicker' }));
/* The shell is the sheet's native host; this double keeps its props visible. */
jest.mock('@/components/BottomSheetShell', () => {
  const reactModule = require('react');
  return {
    BottomSheetShell: ({
      visible,
      children,
      ...props
    }: {
      visible: boolean;
      children?: unknown;
    }) => (visible ? reactModule.createElement('BottomSheetShell', props, children) : null),
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

// The mocks above must land before the components load.
/* eslint-disable import/first */
import { ReminderModal } from '@/components/settings/ReminderModal';
import { MultiOptionToggle } from '@/components/settings/MultiOptionToggle';
/* eslint-enable import/first */

/** The inset the safe-area double reports for the home indicator. */
const BOTTOM_INSET = 34;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function render(element: React.ReactElement): ReactTestInstance {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree.root;
}

function reminderModal(): ReactTestInstance {
  return render(
    React.createElement(ReminderModal, {
      visible: true,
      onClose: jest.fn(),
      onSave: jest.fn(),
    }),
  );
}

it('clears the home indicator under every sheet that moved onto the primitive', () => {
  const root = reminderModal();
  const shell = root.find((node) => String(node.type) === 'BottomSheetShell');
  expect(typeof shell.props.bottomPadding).toBe('number');
  expect(shell.props.bottomPadding).toBeGreaterThanOrEqual(BOTTOM_INSET);
});

it('keeps the reminder fields above the keyboard', () => {
  const root = reminderModal();
  const avoiders = root.findAll((node) => String(node.type) === 'KeyboardAvoidingView');
  expect(avoiders).toHaveLength(1);
  const scrollViews = avoiders[0].findAll((node) => String(node.type) === 'ScrollView');
  expect(scrollViews).toHaveLength(1);
  expect(scrollViews[0].findAll((node) => String(node.type) === 'TextInput').length).toBeGreaterThan(
    0,
  );
});

it('announces an unavailable display option as disabled instead of pressable', () => {
  const onValueChange = jest.fn();
  const root = render(
    React.createElement(MultiOptionToggle<string>, {
      options: [
        { value: 'compact', label: 'Compact' },
        { value: 'default', label: 'Default' },
        { value: 'large', label: 'Large', disabled: true },
      ],
      value: 'default',
      onValueChange,
    }),
  );

  // Host elements only: the double renders each option as a composite and a
  // host node, and findAll returns both.
  const radios = root.findAll(
    (node) => typeof node.type === 'string' && node.props.accessibilityRole === 'radio',
  );
  expect(radios).toHaveLength(3);

  const large = radios[2];
  expect(large.props.accessibilityLabel).toBe('Large');
  expect(large.props.accessibilityState.disabled).toBe(true);
  expect(large.props.disabled).toBe(true);
  expect(large.props.style.opacity).toBeLessThan(1);

  act(() => {
    large.props.onPress();
  });
  expect(onValueChange).not.toHaveBeenCalled();

  const enabled = radios[0];
  expect(enabled.props.accessibilityState.disabled).toBeUndefined();
  expect(enabled.props.style.opacity).toBe(1);
});
