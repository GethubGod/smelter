import React from 'react';
import renderer, { act } from 'react-test-renderer';

/**
 * The Sheet migration made every converted modal dismissable by a scrim tap and
 * a downward drag. Two of them hold unsaved manager input, and closing clears
 * it, so a graze on the backdrop silently destroyed a draft. These tests pin
 * the guard: no scrim dismissal and no drag dismissal while the sheet is dirty.
 */

let panConfig: {
  onMoveShouldSetPanResponder: (event: unknown, gesture: { dy: number; dx: number }) => boolean;
} | null = null;

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
  SafeAreaView: 'SafeAreaView',
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios', select: (values: Record<string, unknown>) => values.ios ?? values.default },
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  Animated: {
    Value: class {
      setValue() {}
    },
    View: 'AnimatedView',
    timing: () => ({ start: (done?: () => void) => done?.() }),
    spring: () => ({ start: () => {} }),
  },
  PanResponder: {
    create: (config: typeof panConfig) => {
      panConfig = config;
      return { panHandlers: {} };
    },
  },
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

// eslint-disable-next-line import/first -- the native mocks above must land before the primitive loads
import { Sheet } from '../components/ui/Sheet';

beforeEach(() => {
  panConfig = null;
  jest.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

async function renderSheet(dismissible: boolean, onClose: () => void) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      React.createElement(Sheet, { visible: true, title: 'Reject with note', onClose, dismissible })
    );
  });
  return tree;
}

it('closes on a scrim tap and a drag while the sheet holds nothing', async () => {
  const onClose = jest.fn();
  const tree = await renderSheet(true, onClose);
  const scrim = tree.root.findAll((node) => String(node.type) === 'Pressable')[0];

  await act(async () => scrim.props.onPress());

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(panConfig?.onMoveShouldSetPanResponder(null, { dy: 20, dx: 0 })).toBe(true);
  await act(async () => tree.unmount());
});

it('ignores a scrim tap and a drag while the sheet is not dismissable', async () => {
  const onClose = jest.fn();
  const tree = await renderSheet(false, onClose);
  const scrim = tree.root.findAll((node) => String(node.type) === 'Pressable')[0];

  expect(scrim.props.onPress).toBeUndefined();
  expect(panConfig?.onMoveShouldSetPanResponder(null, { dy: 20, dx: 0 })).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
