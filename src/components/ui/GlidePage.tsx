import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { color, motion, shadow } from '@/theme/tokens';
import { useViewModeTransition } from '@/lib/switchViewMode';
import { useScaledStyles } from '@/hooks/useScaledStyles';

/** Tab scenes retain their scroll state; hidden detail routes use a horizontal push. */
export function GlidePage({ children, pushed = false, onBack }: { children: React.ReactNode; pushed?: boolean; onBack?: () => void }) {
  const focused = useIsFocused();
  const fading = useViewModeTransition(state => state.fading);
  const { reduceMotion } = useScaledStyles();
  const { width } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(pushed ? width : 10)).current;
  useEffect(() => {
    // Read arrival only at a focus/fade boundary. Clearing its timer must not replay entry.
    const arriving = useViewModeTransition.getState().arriving;
    if (focused && !fading) {
      opacity.setValue(pushed && !arriving ? 1 : 0);
      offset.setValue(arriving ? 0 : pushed ? width : 10);
    }
    const easing = Easing.bezier(...motion.ease);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: fading ? 0 : pushed ? 1 : focused ? 1 : 0, duration: reduceMotion ? 0 : (fading || arriving) ? 200 : pushed ? 280 : focused ? 300 : 180, easing, useNativeDriver: true }),
      Animated.timing(offset, { toValue: fading || focused ? 0 : pushed ? width : -6, duration: reduceMotion ? 0 : (fading || arriving) ? 200 : pushed ? 280 : focused ? 340 : 180, easing, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fading, focused, offset, opacity, pushed, reduceMotion, width]);
  const gesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event, state) => pushed && focused && !!onBack && event.nativeEvent.pageX - state.dx <= 28 && state.dx > 6 && Math.abs(state.dx) > Math.abs(state.dy),
    onPanResponderGrant: () => offset.stopAnimation(),
    onPanResponderMove: (_event, state) => offset.setValue(Math.max(0, state.dx)),
    onPanResponderRelease: (_event, state) => {
      if (state.dx > 110) onBack?.();
      else Animated.timing(offset, { toValue: 0, duration: reduceMotion ? 0 : 280, easing: Easing.bezier(...motion.ease), useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.timing(offset, { toValue: 0, duration: reduceMotion ? 0 : 280, easing: Easing.bezier(...motion.ease), useNativeDriver: true }).start(),
  }), [focused, offset, onBack, pushed, reduceMotion]);
  return <Animated.View {...gesture.panHandlers} style={[{ flex: 1, backgroundColor: color.page, opacity, transform: pushed ? [{ translateX: offset }] : [{ translateY: offset }] }, pushed ? { ...shadow.sheet, shadowOffset: { width: -10, height: 0 } } : null]}>{children}</Animated.View>;
}
