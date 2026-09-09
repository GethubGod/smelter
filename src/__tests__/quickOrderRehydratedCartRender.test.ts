/**
 * Issue #70 regression guard (render side).
 *
 * The screen is wrapped in an ErrorBoundary, which only catches render and
 * commit-phase errors. This suite renders the Order list card with a cart
 * rehydrated straight out of `quick_order_sessions.parsed_items` whose row has
 * no resolved unit, then re-renders it with the item the send path would have
 * merged in, so a row in that state can never take the screen down.
 */
import React from 'react';
import renderer from 'react-test-renderer';
import { QuickOrderListCard } from '../features/ordering/QuickOrderListCard';
import { QuickOrderItemRow } from '../features/ordering/QuickOrderItemRow';
import {
  mergeQuickOrderParsedItemsDetailed,
  countUnresolvedItems,
  type ParsedQuickOrderItem,
} from '../features/ordering/quickOrderItems';

jest.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference the top-level React import (babel-plugin-jest-hoist restriction)
  const React = require('react');
  const createComponent = (name: string) => {
    const Component = React.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<unknown>) =>
        React.createElement(name, { ...props, ref }, children),
    );
    Component.displayName = name;
    return Component;
  };

  return {
    View: createComponent('View'),
    Text: createComponent('Text'),
    ScrollView: createComponent('ScrollView'),
    Pressable: createComponent('Pressable'),
    TouchableOpacity: createComponent('TouchableOpacity'),
    ActivityIndicator: createComponent('ActivityIndicator'),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Platform: { OS: 'ios', select: (values: Record<string, unknown>) => values.ios ?? values.default },
  };
});

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference the top-level React import (babel-plugin-jest-hoist restriction)
  const React = require('react');
  const createComponent = (name: string) => {
    const Component = React.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<unknown>) =>
        React.createElement(name, { ...props, ref }, children),
    );
    Component.displayName = name;
    return Component;
  };

  const View = createComponent('Animated.View');
  const ScrollView = createComponent('ScrollView');
  type MockScrollEvent = {
    contentOffset: { y: number };
    contentSize: { height: number };
    layoutMeasurement: { height: number };
  };
  return {
    __esModule: true,
    default: {
      View,
      ScrollView,
      createAnimatedComponent: (Component: React.ComponentType) => Component,
    },
    View,
    Easing: { bezier: jest.fn(() => jest.fn()) },
    useAnimatedScrollHandler: jest.fn(
      (handler: (event: MockScrollEvent) => void) =>
        (event: { nativeEvent: MockScrollEvent }) => handler(event.nativeEvent),
    ),
    useAnimatedStyle: jest.fn((factory: () => unknown) => factory()),
    useSharedValue: jest.fn((value: unknown) => ({ value })),
    withTiming: jest.fn((value: unknown) => value),
  };
});

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference the top-level React import (babel-plugin-jest-hoist restriction)
  const React = require('react');
  return {
    Ionicons: (props: Record<string, unknown>) => React.createElement('Ionicons', props),
  };
});

jest.mock('@/hooks/useScaledStyles', () => ({
  useScaledStyles: jest.fn(() => ({
    spacing: (value: number) => value,
    radius: (value: number) => value,
    fontSize: (value: number) => value,
    icon: (value: number) => value,
  })),
}));

jest.mock('@/lib/haptics', () => ({
  triggerConfirmationHaptic: jest.fn(),
  triggerSelectionHaptic: jest.fn(),
}));

/** Cart as it comes back off the persisted session row. */
function rehydratedCart(unit: unknown): ParsedQuickOrderItem[] {
  return JSON.parse(
    JSON.stringify([
      {
        item_id: 'rice-id',
        item_name: 'Fixture Rice',
        raw_token: '2 bags of fixture rice',
        quantity: 2,
        unit: 'bag',
        status: 'valid',
        needs_clarification: false,
        unresolved: false,
      },
      {
        item_id: 'salmon-id',
        item_name: 'Fixture Salmon',
        raw_token: '3 fixture salmon',
        quantity: 3,
        unit,
        valid_units: ['lb', 'cs'],
        status: 'missing_unit',
        action: 'Choose unit',
        needs_clarification: true,
        unresolved: false,
      },
    ]),
  ) as ParsedQuickOrderItem[];
}

const NORI: ParsedQuickOrderItem = {
  item_id: 'nori-id',
  item_name: 'Fixture Nori',
  raw_token: '4 packs of fixture nori',
  quantity: 4,
  unit: 'pack',
  status: 'valid',
  needs_clarification: false,
  unresolved: false,
};

function renderCard(items: ParsedQuickOrderItem[]) {
  let component!: renderer.ReactTestRenderer;
  renderer.act(() => {
    component = renderer.create(
      React.createElement(QuickOrderListCard, {
        items,
        issueCount: countUnresolvedItems(items),
        isSubmitting: false,
        onEditItem: jest.fn(),
        onResolveQuantity: jest.fn(),
        onRemoveItems: jest.fn(),
        onConfirm: jest.fn(),
        onHeightChange: jest.fn(),
      }),
    );
  });
  return component;
}

describe('issue #70: Order list card renders a rehydrated cart with an unresolved unit', () => {
  beforeAll(() => {
    Object.assign(globalThis, {
      IS_REACT_ACT_ENVIRONMENT: true,
      requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
      cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    });
  });

  test.each([
    ['a null unit', null],
    ['an undefined unit', undefined],
    ['an empty unit', ''],
    ['a unit id no longer in the catalog', 'legacy-unit-id-4471'],
  ])('renders the rehydrated cart with %s', (_label, unit) => {
    const items = rehydratedCart(unit);
    let component!: renderer.ReactTestRenderer;
    expect(() => {
      component = renderCard(items);
    }).not.toThrow();
    const rendered = JSON.stringify(component.toJSON());
    expect(rendered).toContain('Fixture Salmon');
    renderer.act(() => component.unmount());
  });

  test('re-renders after the send path merges a new item into the rehydrated cart', () => {
    const items = rehydratedCart(null);
    const component = renderCard(items);
    const merged = mergeQuickOrderParsedItemsDetailed(items, [NORI]).items;

    expect(() => {
      renderer.act(() => {
        component.update(
          React.createElement(QuickOrderListCard, {
            items: merged,
            issueCount: countUnresolvedItems(merged),
            isSubmitting: false,
            onEditItem: jest.fn(),
            onResolveQuantity: jest.fn(),
            onRemoveItems: jest.fn(),
            onConfirm: jest.fn(),
            onHeightChange: jest.fn(),
          }),
        );
      });
    }).not.toThrow();

    const rendered = JSON.stringify(component.toJSON());
    expect(rendered).toContain('Fixture Nori');
    expect(rendered).toContain('1 to fix');
    renderer.act(() => component.unmount());
  });

  test('renders an item row for an unresolved unit with no quantity lines', () => {
    const [, salmon] = rehydratedCart(null);
    let component!: renderer.ReactTestRenderer;
    expect(() => {
      renderer.act(() => {
        component = renderer.create(
          React.createElement(QuickOrderItemRow, {
            item: salmon,
            quantityLines: [],
            showDivider: false,
            onEdit: jest.fn(),
            onResolveQuantity: jest.fn(),
          }),
        );
      });
    }).not.toThrow();
    expect(JSON.stringify(component.toJSON())).toContain('Choose unit');
    renderer.act(() => component.unmount());
  });
});
