/**
 * Guards for what the #34 sweep dropped on the way onto the primitives.
 *
 * Every case here is invisible to a screenshot: an action that hides behind
 * the keyboard, a sheet that stops clearing the home indicator, a unit picker
 * that no longer announces its options, a station row that no longer announces
 * that it is the chosen one, and a sheet that never made it onto the contract
 * primitive at all.
 */
import fs from 'fs';
import path from 'path';
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
/* Haptics reach expo-haptics and the display store; the feedback is not under test. */
jest.mock('@/lib/haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  triggerImpactHaptic: jest.fn(),
  triggerSelectionHaptic: jest.fn(),
  triggerConfirmationHaptic: jest.fn(),
  triggerNotificationHaptic: jest.fn(),
}));
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
import { NoteSheet } from '@/features/simpleOrder/components/NoteSheet';
import { QuantityCardSheet } from '@/features/simpleOrder/components/QuantityCardSheet';
import { QuickActionsSheet } from '@/features/simpleOrder/components/QuickActionsSheet';
import { StationPickerBottomSheet } from '@/features/stock-check/components/StationPickerBottomSheet';
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

function hosts(root: ReactTestInstance, match: (node: ReactTestInstance) => boolean) {
  return root.findAll((node) => typeof node.type === 'string' && match(node));
}

function withRole(root: ReactTestInstance, role: string): ReactTestInstance[] {
  return hosts(root, (node) => node.props.accessibilityRole === role);
}

function noteSheet(note = ''): ReactTestInstance {
  return render(
    React.createElement(NoteSheet, {
      visible: true,
      note,
      onSave: jest.fn(),
      onClose: jest.fn(),
    }),
  );
}

describe('order note sheet', () => {
  it('keeps Save inside the keyboard-avoiding region', () => {
    const root = noteSheet();
    const [avoider] = hosts(root, (node) => String(node.type) === 'KeyboardAvoidingView');
    const save = withRole(avoider, 'button').filter(
      (node) => node.props.accessibilityLabel === 'Save note',
    );
    expect(save).toHaveLength(1);
  });

  it('clears the home indicator', () => {
    const root = noteSheet();
    const shell = root.find((node) => String(node.type) === 'BottomSheetShell');
    expect(typeof shell.props.bottomPadding).toBe('number');
    expect(shell.props.bottomPadding).toBeGreaterThanOrEqual(BOTTOM_INSET);
  });
});

describe('cart item note sheet', () => {
  /**
   * `CartScreenView` pulls the stores, the router and FlashList, so this one is
   * read from source: the guard is that the action sits inside the
   * keyboard-avoiding region and that Android keeps its own behaviour.
   */
  const source = fs.readFileSync(
    path.join(__dirname, '../features/cart/CartScreenView.tsx'),
    'utf8',
  );
  const region = source.slice(
    source.indexOf('<KeyboardAvoidingView'),
    source.indexOf('</KeyboardAvoidingView>'),
  );

  it('keeps Save inside the keyboard-avoiding region', () => {
    expect(region).toContain("label=\"Save note\"");
  });

  it('keeps the Android height behaviour', () => {
    expect(region).toContain("Platform.OS === 'ios' ? 'padding' : 'height'");
  });
});

describe('quantity card sheet', () => {
  const line = {
    key: 'item-1',
    itemId: 'item-1',
    inventoryItemId: 'inv-1',
    itemName: 'Salmon',
    unit: 'kg',
    quantity: 2,
    recommendedQty: 3,
    checked: true,
    bucket: 'frequent' as const,
    category: null,
    supplierName: null,
  };

  it('announces every unit option with a role and a selected state', () => {
    const root = render(
      React.createElement(QuantityCardSheet, {
        visible: true,
        line: line as never,
        unitOptions: ['kg', 'case'],
        onSetUnit: jest.fn(),
        onCommit: jest.fn(),
        onClose: jest.fn(),
      }),
    );
    const options = withRole(root, 'radio');
    expect(options.map((node) => node.props.accessibilityLabel)).toEqual(['kg', 'case']);
    expect(options[0].props.accessibilityState).toEqual({ selected: true, checked: true });
    expect(options[1].props.accessibilityState).toEqual({ selected: false, checked: false });
    expect(withRole(root, 'radiogroup')).toHaveLength(1);
  });
});

describe('station picker', () => {
  it('announces which station is the chosen one', () => {
    const options = [
      { id: 'all', label: 'All stations', badgeCount: 0 },
      { id: 'walkin', label: 'Walk-in', badgeCount: 2 },
    ];
    const root = render(
      React.createElement(StationPickerBottomSheet, {
        visible: true,
        options: options as never,
        selectedId: 'walkin',
        onSelect: jest.fn(),
        onClose: jest.fn(),
      }),
    );
    const rows = withRole(root, 'button').filter((node) =>
      String(node.props.accessibilityLabel ?? '').startsWith('Walk-in'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].props.accessibilityState).toEqual({ disabled: false, selected: true });

    const unselected = withRole(root, 'button').filter((node) =>
      String(node.props.accessibilityLabel ?? '').startsWith('All stations'),
    );
    expect(unselected[0].props.accessibilityState).toEqual({ disabled: false, selected: false });
  });
});

describe('quick actions sheet', () => {
  it('is hosted by the contract sheet, so its title is a header', () => {
    const root = render(
      React.createElement(QuickActionsSheet, {
        visible: true,
        hasNote: false,
        density: 'comfort' as never,
        showCategories: true,
        onAction: jest.fn(),
        onClose: jest.fn(),
      }),
    );
    const [header] = withRole(root, 'header');
    expect(header.props.children).toBe('Quick actions');
    const shell = root.find((node) => String(node.type) === 'BottomSheetShell');
    expect(shell.props.bottomPadding).toBeGreaterThanOrEqual(BOTTOM_INSET);
  });
});
