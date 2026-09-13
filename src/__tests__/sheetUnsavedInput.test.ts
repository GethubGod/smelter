import React from 'react';
import renderer, { act } from 'react-test-renderer';

/**
 * The Sheet migration made every converted modal dismissable by a scrim tap and
 * a downward drag. Two of them hold unsaved manager input, and closing clears
 * it, so a graze on the backdrop silently destroyed a draft. These tests pin
 * the guard: no scrim dismissal and no drag dismissal while the sheet is dirty.
 */

interface MockGesture {
  dy: number;
  dx: number;
  vy: number;
}

interface MockPanConfig {
  onStartShouldSetPanResponder: () => boolean;
  onMoveShouldSetPanResponderCapture: (event: unknown, gesture: { dy: number; dx: number }) => boolean;
  onPanResponderGrant: () => void;
  onMoveShouldSetPanResponder: (event: unknown, gesture: { dy: number; dx: number }) => boolean;
  onPanResponderMove: (event: unknown, gesture: MockGesture) => void;
  onPanResponderRelease: (event: unknown, gesture: MockGesture) => void;
}

interface MockTimingCall {
  value: { value: number; setValue: (next: number) => void };
  config: { toValue: number; duration: number; useNativeDriver: boolean };
}

let mockPanConfigs: MockPanConfig[] = [];
let mockTimingCalls: MockTimingCall[] = [];
let mockCompleteAnimations = true;

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
      value: number;
      constructor(value: number) {
        this.value = value;
      }
      setValue(value: number) {
        this.value = value;
      }
      stopAnimation() {}
    },
    View: 'AnimatedView',
    timing: (
      value: { value: number; setValue: (next: number) => void },
      config: { toValue: number; duration: number; useNativeDriver: boolean },
    ) => {
      mockTimingCalls.push({ value, config });
      return {
        start: (done?: (result: { finished: boolean }) => void) => {
          value.setValue(config.toValue);
          if (mockCompleteAnimations) done?.({ finished: true });
        },
        stop: () => undefined,
      };
    },
    parallel: (animations: { start: () => void }[]) => {
      let completion: ((result: { finished: boolean }) => void) | undefined;
      return {
        start: (done?: (result: { finished: boolean }) => void) => {
          completion = done;
          animations.forEach((animation) => animation.start());
          if (mockCompleteAnimations) done?.({ finished: true });
        },
        stop: () => completion?.({ finished: false }),
      };
    },
  },
  Easing: { bezier: (...points: number[]) => points },
  PanResponder: {
    create: (config: MockPanConfig) => {
      mockPanConfigs.push(config);
      return { panHandlers: {
        onStartShouldSetResponder: config.onStartShouldSetPanResponder,
        onMoveShouldSetResponderCapture: config.onMoveShouldSetPanResponderCapture,
      } };
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
    radius: (n: number) => n,
    icon: (n: number) => n,
    buttonH: 50,
    rowH: 56,
  }),
}));

/* eslint-disable import/first -- the native mocks above must land before the primitives load */
import { Sheet } from '../components/ui/Sheet';
import { BottomSheetShell } from '../components/BottomSheetShell';
/* eslint-enable import/first */

beforeEach(() => {
  mockPanConfigs = [];
  mockTimingCalls = [];
  mockCompleteAnimations = true;
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  };
  globalThis.cancelAnimationFrame = jest.fn();
  jest.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

async function renderSheet(dismissible: boolean, onClose: () => void, expandable = false) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      React.createElement(Sheet, {
        visible: true,
        title: 'Reject with note',
        onClose,
        dismissible,
        expandable,
      })
    );
  });
  return tree;
}

function measuredSheet(tree: renderer.ReactTestRenderer) {
  return tree.root.find(node => String(node.type) === 'AnimatedView' && typeof node.props.onLayout === 'function');
}

it('closes on a scrim tap and a drag while the sheet holds nothing', async () => {
  const onClose = jest.fn();
  const tree = await renderSheet(true, onClose);
  const scrim = tree.root.findAll((node) => String(node.type) === 'Pressable')[0];

  await act(async () => scrim.props.onPress());

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(mockPanConfigs.at(-1)?.onMoveShouldSetPanResponder(null, { dy: 20, dx: 0 })).toBe(true);
  await act(async () => tree.unmount());
});

it('ignores a scrim tap and a drag while the sheet is not dismissable', async () => {
  const onClose = jest.fn();
  const tree = await renderSheet(false, onClose);
  const scrim = tree.root.findAll((node) => String(node.type) === 'Pressable')[0];

  expect(scrim.props.onPress).toBeUndefined();
  expect(mockPanConfigs.every(config => !config.onStartShouldSetPanResponder())).toBe(true);
  expect(mockPanConfigs.at(-1)?.onMoveShouldSetPanResponder(null, { dy: 20, dx: 0 })).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('renders the shared subtitle, close control and fixed action footer', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      React.createElement(
        Sheet,
        {
          visible: true,
          title: 'Review order',
          subtitle: '3 items · goes to manager review',
          onClose: jest.fn(),
          primary: { label: 'Send 3 items', onPress: jest.fn() },
        },
        React.createElement('Text', null, 'Body'),
      ),
    );
  });

  const text = tree.root
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => node.props.children);
  expect(text).toEqual(
    expect.arrayContaining(['Review order', '3 items · goes to manager review', 'Send 3 items']),
  );
  const close = tree.root.find(
    node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Close Review order',
  );
  expect(typeof close.props.style).toBe('object');
  expect(close.props.style).toMatchObject({ width: 32, height: 32, backgroundColor: '#FFFFFF' });
  expect(
    tree.root.find(
      (node) =>
        String(node.type) === 'View' &&
        node.props.style?.paddingTop === 10 &&
        node.props.style?.paddingBottom === 34,
    ),
  ).toBeTruthy();
  await act(async () => tree.unmount());
});

it('uses the measured sheet height for straight open and close timing', async () => {
  const onClose = jest.fn();
  const tree = await renderSheet(true, onClose);
  const sheet = measuredSheet(tree);
  const sheetStyle = sheet.props.style[0] as {
    maxHeight: number;
    backgroundColor: string;
    borderTopLeftRadius: number;
  };

  expect(sheetStyle.maxHeight).toBeCloseTo(844 * 0.88);
  expect(sheetStyle.backgroundColor).toBe('#F3F3F1');
  expect(sheetStyle.borderTopLeftRadius).toBe(30);

  await act(async () => {
    sheet.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
  });

  expect(mockTimingCalls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        config: expect.objectContaining({ toValue: 0, duration: 320, useNativeDriver: true }),
      }),
      expect.objectContaining({
        config: expect.objectContaining({ toValue: 1, duration: 240, useNativeDriver: true }),
      }),
    ]),
  );

  const scrim = tree.root.findAll((node) => String(node.type) === 'Pressable')[0];
  await act(async () => scrim.props.onPress());
  expect(mockTimingCalls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        config: expect.objectContaining({ toValue: 420, duration: 320 }),
      }),
    ]),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('expands, collapses, then dismisses at the contract drag thresholds', async () => {
  const onClose = jest.fn();
  const tree = await renderSheet(true, onClose, true);
  const sheet = measuredSheet(tree);
  const translationLayer = tree.root.find(node => String(node.type) === 'AnimatedView' && Array.isArray(node.props.style?.transform));
  const translateY = translationLayer.props.style.transform[0].translateY;
  const chromeDrag = mockPanConfigs[0];

  await act(async () => {
    sheet.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
  });
  expect(chromeDrag.onStartShouldSetPanResponder()).toBe(true);
  expect(chromeDrag.onMoveShouldSetPanResponder(null, { dy: -7, dx: 0 })).toBe(true);
  chromeDrag.onPanResponderGrant();
  chromeDrag.onPanResponderMove(null, { dy: -6, dx: 0, vy: 0 });
  expect(translateY.value).toBe(0);

  chromeDrag.onPanResponderMove(null, { dy: -100, dx: 0, vy: 0 });
  expect(translateY.value).toBeCloseTo(-55);
  await act(async () => {
    chromeDrag.onPanResponderRelease(null, { dy: -61, dx: 0, vy: 0 });
  });
  expect(mockTimingCalls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        config: expect.objectContaining({
          toValue: 844 * 0.88,
          duration: 320,
          useNativeDriver: false,
        }),
      }),
    ]),
  );

  const heightStyle = sheet.props.style.find((style: unknown) =>
    style !== null && typeof style === 'object' && 'height' in style,
  );
  expect(heightStyle).toBeDefined();
  expect(translationLayer).not.toBe(sheet);
  expect(translationLayer.props.style.height).toBeUndefined();
  expect(sheet.props.style.some((style: unknown) =>
    style !== null && typeof style === 'object' && 'transform' in style,
  )).toBe(false);
  const heightCalls = mockTimingCalls.filter(call => call.value === heightStyle.height);
  expect(heightCalls.length).toBeGreaterThan(0);
  expect(heightCalls.every(call => !call.config.useNativeDriver)).toBe(true);
  expect(mockTimingCalls.some(call => call.value === translateY && call.config.useNativeDriver)).toBe(true);

  await act(async () => {
    chromeDrag.onPanResponderRelease(null, { dy: 91, dx: 0, vy: 0 });
  });
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => {
    chromeDrag.onPanResponderRelease(null, { dy: 91, dx: 0, vy: 0 });
  });
  expect(onClose).toHaveBeenCalledTimes(1);

  await act(async () => tree.unmount());
});

it('cancels a stale close before reopening the sheet', async () => {
  const onClose = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      React.createElement(
        BottomSheetShell,
        { visible: true, onClose, scrollable: true },
        React.createElement('Text', null, 'Body'),
      ),
    );
  });
  const sheet = measuredSheet(tree);
  await act(async () => {
    sheet.props.onLayout({ nativeEvent: { layout: { height: 300 } } });
  });

  mockCompleteAnimations = false;
  await act(async () => {
    tree.update(
      React.createElement(
        BottomSheetShell,
        { visible: false, onClose, scrollable: true },
        React.createElement('Text', null, 'Body'),
      ),
    );
  });
  await act(async () => {
    tree.update(
      React.createElement(
        BottomSheetShell,
        { visible: true, onClose, scrollable: true },
        React.createElement('Text', null, 'Body'),
      ),
    );
  });

  expect(tree.root.findAll((node) => String(node.type) === 'Modal')).toHaveLength(1);
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});


function touch(pageY: number, timestamp: number, pageX = 220) {
  return { nativeEvent: { pageX, pageY, timestamp, touches: [{}] } };
}

it('dismisses from forwarded body touches without installing a ScrollView responder', async () => {
  const onClose = jest.fn();
  const tree = await renderSheet(true, onClose, true);
  const body = tree.root.find(node => String(node.type) === 'ScrollView');
  const translation = tree.root.find(node => String(node.type) === 'AnimatedView' && node.props.style?.transform).props.style.transform[0].translateY;
  await act(async () => measuredSheet(tree).props.onLayout({ nativeEvent: { layout: { height: 400 } } }));
  expect(body.props.onMoveShouldSetResponderCapture).toBeUndefined();
  expect(mockPanConfigs).toHaveLength(1);
  body.props.onTouchStart(touch(500, 0));
  body.props.onTouchMove(touch(506, 100));
  expect(translation.value).toBe(0);
  body.props.onTouchMove(touch(600, 600));
  expect(translation.value).toBe(100);
  await act(async () => body.props.onTouchEnd(touch(600, 650)));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it.each(['upward', 'horizontal', 'scrolled', 'locked', 'cancelled'])('leaves the sheet in place for %s body touches', async kind => {
  const onClose = jest.fn();
  const tree = await renderSheet(kind !== 'locked', onClose, true);
  const body = tree.root.find(node => String(node.type) === 'ScrollView');
  const translation = tree.root.find(node => String(node.type) === 'AnimatedView' && node.props.style?.transform).props.style.transform[0].translateY;
  await act(async () => measuredSheet(tree).props.onLayout({ nativeEvent: { layout: { height: 400 } } }));
  if (kind === 'scrolled') body.props.onScroll({ nativeEvent: { contentOffset: { y: 12 } } });
  body.props.onTouchStart(touch(500, 0));
  body.props.onTouchMove(touch(kind === 'upward' ? 400 : 600, 600, kind === 'horizontal' ? 420 : 220));
  await act(async () => {
    if (kind === 'cancelled') body.props.onTouchCancel();
    body.props.onTouchEnd(touch(600, 650));
  });
  expect(translation.value).toBe(0);
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('uses the reference velocity threshold for a short fast body pull', async () => {
  const onClose = jest.fn();
  const tree = await renderSheet(true, onClose);
  const body = tree.root.find(node => String(node.type) === 'ScrollView');
  body.props.onTouchStart(touch(500, 100));
  body.props.onTouchMove(touch(530, 120));
  await act(async () => body.props.onTouchEnd(touch(530, 125)));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
