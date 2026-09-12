import React from 'react';
import renderer, { act, type ReactTestInstance } from 'react-test-renderer';

/* A jest.mock factory may only `require`; an import would hoist above the mock. */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('react-native', () => ({
  ...require('./nativeMocks').reactNative(),
  PanResponder: {
    create: (handlers: object) => ({ panHandlers: handlers }),
  },
}));
jest.mock('@expo/vector-icons', () => require('./nativeMocks').vectorIcons());
jest.mock('@/hooks/useScaledStyles', () => require('./nativeMocks').scaledStyles());
jest.mock('react-native-reanimated', () => {
  const native = require('./nativeMocks').reactNative();
  const react = require('react');
  return {
    __esModule: true,
    default: { View: native.View },
    cancelAnimation: jest.fn(),
    Easing: {
      bezier: jest.fn(() => (value: number) => value),
      cubic: (value: number) => value,
      out: (easing: (value: number) => number) => easing,
    },
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: number) => react.useRef({ value }).current,
    withTiming: jest.fn((value: number) => value),
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

/* eslint-disable import/first */
import { withTiming } from 'react-native-reanimated';
import {
  TabBar,
  getTabBarClearance,
  type TabBarItem,
} from '@/components/ui/TabBar';
/* eslint-enable import/first */

const tabs: readonly TabBarItem[] = [
  { name: 'home', label: 'Home', icon: 'home-outline' },
  { name: 'fulfillment', label: 'Fulfillment', icon: 'clipboard-outline', badge: 125 },
  { name: 'history', label: 'History', icon: 'time-outline' },
  { name: 'settings', label: 'Settings', icon: 'person-circle-outline' },
];

function hosts(root: ReactTestInstance, predicate: (node: ReactTestInstance) => boolean) {
  return root.findAll((node) => typeof node.type === 'string' && predicate(node));
}

function byTestID(root: ReactTestInstance, testID: string): ReactTestInstance {
  return hosts(root, (node) => node.props.testID === testID)[0];
}

function renderDock(props: Partial<React.ComponentProps<typeof TabBar>> = {}) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(TabBar, {
        tabs,
        active: 'home',
        onPress: jest.fn(),
        testID: 'dock',
        ...props,
      }),
    );
  });
  return tree;
}

function layoutTabs(root: ReactTestInstance) {
  const tabNodes = hosts(root, (node) => node.props.accessibilityRole === 'tab');
  act(() => {
    byTestID(root, 'dock-tabs').props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 68 } },
    });
    tabNodes.forEach((node, index) => {
      node.props.onLayout({
        nativeEvent: { layout: { x: index * 100, y: 0, width: 100, height: 68 } },
      });
    });
  });
  return tabNodes;
}

beforeAll(() => {
  jest.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
});

it('uses the three fixed clearance modes while accepting the old numeric call', () => {
  expect(getTabBarClearance(34)).toBe(120);
  expect(getTabBarClearance(34, 'default')).toBe(120);
  expect(getTabBarClearance(34, 'pinned')).toBe(104);
  expect(getTabBarClearance(34, 'order')).toBe(190);
});

it('renders the 18 by 12 by 80 dock geometry and the real badge count', () => {
  const tree = renderDock({ active: 'fulfillment' });
  const rootStyle = byTestID(tree.root, 'dock').props.style as {
    left: number;
    right: number;
    bottom: number;
    height: number;
  };
  expect(rootStyle).toMatchObject({ left: 18, right: 18, bottom: 12, height: 80 });

  const tabNodes = hosts(tree.root, (node) => node.props.accessibilityRole === 'tab');
  expect(tabNodes).toHaveLength(4);
  expect(tabNodes[1].props.accessibilityState).toEqual({ selected: true });
  expect(tabNodes[1].props.accessibilityLabel).toBe('Fulfillment, 125 waiting');
  expect(hosts(tree.root, (node) => node.props.children === 125)).toHaveLength(1);

  act(() => tree.unmount());
});

it('animates More over 340ms and does not restart it for a new callback object', () => {
  const tree = renderDock({
    quickActions: { onPress: jest.fn(), accessibilityLabel: 'Order actions' },
  });
  const timing = withTiming as unknown as jest.Mock;
  const moreCalls = () =>
    timing.mock.calls.filter(([, config]) => config?.duration === 340);
  expect(moreCalls()).toHaveLength(1);

  act(() => {
    tree.update(
      React.createElement(TabBar, {
        tabs,
        active: 'home',
        onPress: jest.fn(),
        testID: 'dock',
        quickActions: { onPress: jest.fn(), accessibilityLabel: 'Order actions' },
      }),
    );
  });
  expect(moreCalls()).toHaveLength(1);

  const [moreButton] = hosts(
    tree.root,
    (node) => node.props.accessibilityRole === 'button',
  );
  expect(moreButton.props.accessibilityLabel).toBe('Order actions');
  act(() => tree.unmount());
});

it('uses one 320ms indicator timing while measured targets keep changing', () => {
  const tree = renderDock();
  const tabNodes = layoutTabs(tree.root);
  const timing = withTiming as unknown as jest.Mock;
  timing.mockClear();

  act(() => {
    tree.update(
      React.createElement(TabBar, {
        tabs,
        active: 'history',
        onPress: jest.fn(),
        testID: 'dock',
      }),
    );
  });

  const updatedTabs = hosts(tree.root, (node) => node.props.accessibilityRole === 'tab');
  act(() => {
    updatedTabs[2].props.onLayout({
      nativeEvent: { layout: { x: 180, y: 0, width: 90, height: 68 } },
    });
    updatedTabs[2].props.onLayout({
      nativeEvent: { layout: { x: 176, y: 0, width: 88, height: 68 } },
    });
  });

  const indicatorCalls = timing.mock.calls.filter(([, config]) => config?.duration === 320);
  expect(indicatorCalls).toHaveLength(1);
  expect(indicatorCalls[0][0]).toBe(1);
  expect(tabNodes).toHaveLength(4);
  act(() => tree.unmount());
});

it('starts drag selection only after 6pt and selects the tab under the indicator centre', () => {
  const onPress = jest.fn();
  const tree = renderDock({ onPress });
  layoutTabs(tree.root);
  const responder = byTestID(tree.root, 'dock-tabs').props;

  expect(responder.onMoveShouldSetPanResponderCapture(null, { dx: 6 })).toBe(false);
  expect(responder.onMoveShouldSetPanResponderCapture(null, { dx: 6.1 })).toBe(true);

  act(() => {
    responder.onPanResponderGrant();
    responder.onPanResponderMove(null, { dx: 120 });
    responder.onPanResponderRelease();
  });

  expect(onPress).toHaveBeenCalledWith('fulfillment');
  act(() => tree.unmount());
});
