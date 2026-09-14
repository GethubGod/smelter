/**
 * Shared jest doubles for the primitive tests.
 *
 * ts-jest does not transform `node_modules`, so react-native and the native
 * modules the primitives touch are replaced with host-element stubs. Each test
 * file pulls these in from inside a `jest.mock` factory, which is the only
 * place a factory may `require` a module.
 */
import React from 'react';

interface AnyProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

function hostComponent(name: string) {
  const Component = React.forwardRef<unknown, AnyProps>(({ children, ...props }, ref) =>
    React.createElement(name, { ...props, ref }, children as React.ReactNode),
  );
  Component.displayName = name;
  return Component;
}

/** Replacement for `react-native`. */
export function reactNative() {
  class AnimatedValue {
    value: number;

    constructor(value: number) {
      this.value = value;
    }

    setValue(value: number) {
      this.value = value;
    }

    interpolate({ outputRange }: { outputRange: unknown[] }) {
      return outputRange[this.value] ?? outputRange[0];
    }
  }

  const start = (callback?: (result: { finished: boolean }) => void) => {
    callback?.({ finished: true });
  };

  return {
    View: hostComponent('View'),
    Text: hostComponent('Text'),
    TextInput: hostComponent('TextInput'),
    ScrollView: hostComponent('ScrollView'),
    Pressable: hostComponent('Pressable'),
    TouchableOpacity: hostComponent('TouchableOpacity'),
    ActivityIndicator: hostComponent('ActivityIndicator'),
    Modal: hostComponent('Modal'),
    Animated: {
      Value: AnimatedValue,
      View: hostComponent('Animated.View'),
      timing: (value: AnimatedValue, config: { toValue: number }) => ({
        start: (callback?: (result: { finished: boolean }) => void) => {
          value.setValue(config.toValue);
          start(callback);
        },
        stop: () => undefined,
      }),
      parallel: (animations: { start: typeof start }[]) => ({
        start: (callback?: (result: { finished: boolean }) => void) => {
          animations.forEach((animation) => animation.start());
          start(callback);
        },
      }),
    },
    Easing: { bezier: () => (value: number) => value },
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Platform: {
      OS: 'ios',
      select: (values: Record<string, unknown>) => values.ios ?? values.default,
    },
  };
}

/** Replacement for `@expo/vector-icons`. */
export function vectorIcons() {
  return { Ionicons: hostComponent('Ionicons') };
}

/** Replacement for `react-native-safe-area-context`. */
export function safeAreaContext() {
  return { useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) };
}

/** Replacement for `@/hooks/useScaledStyles`: identity scaling. */
export function scaledStyles() {
  const identity = (value: number) => value;
  return {
    useScaledStyles: () => ({
      fontSize: identity,
      spacing: identity,
      radius: identity,
      icon: identity,
      buttonH: 50,
      buttonFont: 15,
      buttonPadH: 20,
      cardPad: 14,
      rowH: 44,
      textScale: 1,
      isLarge: false,
      isCompact: false,
      reduceMotion: false,
      theme: 'light',
    }),
  };
}

/** Replacement for the two designated native hosts. */
export function loadingIndicator() {
  return { LoadingIndicator: hostComponent('LoadingIndicator') };
}

export function bottomSheetShell() {
  const Shell = ({
    visible,
    header,
    children,
    footer,
    overlay,
    ...props
  }: {
    visible: boolean;
    header?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    overlay?: React.ReactNode;
  }) =>
    visible
      ? React.createElement('BottomSheetShell', props, header, children, footer, overlay)
      : null;
  return { BottomSheetShell: Shell };
}
