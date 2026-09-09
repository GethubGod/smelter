import React from 'react';
import renderer from 'react-test-renderer';
import {
  getScrollbarThumbGeometry,
  QuickOrderListCard,
} from '../features/ordering/QuickOrderListCard';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import type { ParsedQuickOrderItem } from '@/features/ordering/quickOrderItems';

jest.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference the top-level React import (babel-plugin-jest-hoist restriction)
  const React = require('react');
  const createComponent = (name: string) => {
    const Component = React.forwardRef(({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<unknown>) =>
      React.createElement(name, { ...props, ref }, children)
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

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference the top-level React import (babel-plugin-jest-hoist restriction)
  const React = require('react');
  return {
    Ionicons: (props: Record<string, unknown>) => React.createElement('Ionicons', props),
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

describe('QuickOrderListCard', () => {
  beforeAll(() => {
    Object.assign(globalThis, {
      requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
      cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    });
  });

  test('renders validated parsed items in the order list', () => {
    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(
        React.createElement(QuickOrderListCard, {
          items: [
            {
              item_id: 'salmon-id',
              item_name: 'Salmon',
              raw_token: 'salmon 2cs',
              quantity: 2,
              unit: 'cs',
              status: 'valid',
              needs_clarification: false,
              unresolved: false,
            },
            {
              item_id: 'masago-id',
              item_name: 'Masago',
              raw_token: 'masago 1cs',
              quantity: 1,
              unit: 'cs',
              status: 'valid',
              needs_clarification: false,
              unresolved: false,
            },
          ],
          issueCount: 0,
          isSubmitting: false,
          onEditItem: jest.fn(),
          onResolveQuantity: jest.fn(),
          onRemoveItems: jest.fn(),
          onConfirm: jest.fn(),
          onHeightChange: jest.fn(),
        }),
      );
    });

    const rendered = JSON.stringify(component.toJSON());
    expect(rendered).toContain('Order list');
    expect(rendered).toContain('2 · all set');
    expect(rendered).toContain('Salmon');
    expect(rendered).toContain('2 cases');
    expect(rendered).toContain('Masago');
    expect(rendered).toContain('1 case');
  });

  test('fills the scrollbar track when content does not overflow', () => {
    expect(getScrollbarThumbGeometry({
      viewportHeight: 160,
      contentHeight: 120,
      offsetY: 40,
      minThumbHeight: 28,
    })).toEqual({ height: 160, top: 0 });
  });

  test('keeps the scrollbar thumb inside the track at both scroll limits', () => {
    const start = getScrollbarThumbGeometry({
      viewportHeight: 160,
      contentHeight: 640,
      offsetY: -20,
      minThumbHeight: 28,
    });
    const end = getScrollbarThumbGeometry({
      viewportHeight: 160,
      contentHeight: 640,
      offsetY: 600,
      minThumbHeight: 28,
    });

    expect(start).toEqual({ height: 40, top: 0 });
    expect(end).toEqual({ height: 40, top: 120 });
  });

  test('groups multiple units for the same item under one row with full unit words', () => {
    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(
        React.createElement(QuickOrderListCard, {
          items: [
            {
              item_id: 'tako-id',
              item_name: 'Tako (Octopus)',
              quantity: 3,
              unit: 'pc',
              status: 'valid',
              needs_clarification: false,
              unresolved: false,
            },
            {
              item_id: 'tako-id',
              item_name: 'Tako (Octopus)',
              quantity: 1,
              unit: 'pack',
              status: 'valid',
              needs_clarification: false,
              unresolved: false,
            },
          ],
          issueCount: 0,
          isSubmitting: false,
          onEditItem: jest.fn(),
          onResolveQuantity: jest.fn(),
          onRemoveItems: jest.fn(),
          onConfirm: jest.fn(),
          onHeightChange: jest.fn(),
        }),
      );
    });

    const rendered = JSON.stringify(component.toJSON());
    expect(rendered).toContain('1 · all set');
    expect(rendered).toContain('Tako (Octopus)');
    expect(rendered).toContain('3 pieces');
    expect(rendered).toContain('1 pack');
  });

  test('renders suggested tag for recommendation-generated rows', () => {
    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(
        React.createElement(QuickOrderListCard, {
          items: [
            {
              item_id: 'tuna-loin-id',
              item_name: 'Tuna Loin',
              quantity: 1,
              unit: 'cs',
              status: 'valid',
              needs_clarification: false,
              unresolved: false,
              source: 'inventory_recommendation',
              isSuggested: true,
              suggestionSource: 'remaining_inventory',
            },
          ],
          issueCount: 0,
          isSubmitting: false,
          onEditItem: jest.fn(),
          onResolveQuantity: jest.fn(),
          onRemoveItems: jest.fn(),
          onConfirm: jest.fn(),
          onHeightChange: jest.fn(),
        }),
      );
    });

    const rendered = JSON.stringify(component.toJSON());
    expect(rendered).toContain('Tuna Loin');
    expect(rendered).toContain('1 case');
    expect(rendered).toContain('Suggested');
  });

  test('keeps rows in the original message order instead of alphabetical order', () => {
    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(
        React.createElement(QuickOrderListCard, {
          items: [
            {
              item_id: 'garlic-id',
              item_name: 'Ground Garlic',
              quantity: 9,
              unit: 'pack',
              status: 'valid',
              needs_clarification: false,
              unresolved: false,
              source: 'remaining_recommendation',
              isSuggested: true,
              suggestionSource: 'remaining_inventory',
            },
            {
              item_id: 'edamame-id',
              item_name: 'Edamame',
              quantity: 7,
              unit: 'cs',
              status: 'valid',
              needs_clarification: false,
              unresolved: false,
              source: 'remaining_recommendation',
              isSuggested: true,
              suggestionSource: 'remaining_inventory',
            },
            {
              item_id: 'shrimp-id',
              item_name: 'Shrimp (Frozen)',
              quantity: null,
              unit: null,
              status: 'missing_quantity',
              needs_clarification: true,
              unresolved: false,
              source: 'remaining_inventory',
            },
            {
              item_id: 'albacore-id',
              item_name: 'Albacore',
              quantity: 8,
              unit: 'cs',
              status: 'valid',
              needs_clarification: false,
              unresolved: false,
              source: 'remaining_recommendation',
              isSuggested: true,
              suggestionSource: 'remaining_inventory',
            },
          ],
          issueCount: 1,
          isSubmitting: false,
          onEditItem: jest.fn(),
          onResolveQuantity: jest.fn(),
          onRemoveItems: jest.fn(),
          onConfirm: jest.fn(),
          onHeightChange: jest.fn(),
        }),
      );
    });

    const rendered = JSON.stringify(component.toJSON());
    expect(rendered.indexOf('Ground Garlic')).toBeLessThan(rendered.indexOf('Edamame'));
    expect(rendered.indexOf('Edamame')).toBeLessThan(rendered.indexOf('Shrimp (Frozen)'));
    expect(rendered.indexOf('Shrimp (Frozen)')).toBeLessThan(rendered.indexOf('Albacore'));
  });

  test('updates the custom scrollbar without a React render on each scroll event', () => {
    const mockedUseScaledStyles = jest.mocked(useScaledStyles);
    const items: ParsedQuickOrderItem[] = Array.from({ length: 6 }, (_, index) => ({
      item_id: `item-${index}`,
      item_name: `Item ${index}`,
      quantity: index + 1,
      unit: 'case',
      status: 'valid',
      needs_clarification: false,
      unresolved: false,
    }));
    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(
        React.createElement(QuickOrderListCard, {
          items,
          issueCount: 0,
          isSubmitting: false,
          onEditItem: jest.fn(),
          onResolveQuantity: jest.fn(),
          onRemoveItems: jest.fn(),
          onConfirm: jest.fn(),
          onHeightChange: jest.fn(),
        }),
      );
    });

    const scrollView = component.root.find((node) => String(node.type) === 'ScrollView');
    const renderCountBeforeScroll = mockedUseScaledStyles.mock.calls.length;

    renderer.act(() => {
      scrollView.props.onScroll({
        nativeEvent: {
          contentOffset: { x: 0, y: 40 },
          contentSize: { width: 320, height: 360 },
          layoutMeasurement: { width: 320, height: 156 },
        },
      });
    });

    expect(mockedUseScaledStyles).toHaveBeenCalledTimes(renderCountBeforeScroll);

    renderer.act(() => component.unmount());
  });
});
