import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { color, motion } from '@/theme/tokens';
import { useViewModeTransition } from '@/lib/switchViewMode';
import { useScaledStyles } from '@/hooks/useScaledStyles';

/** Mounted by the tab layout so each tab keeps its scroll state through a transition. */
export function GlidePage({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  const fading = useViewModeTransition((state) => state.fading);
  const arriving = useViewModeTransition.getState().arriving;
  const { reduceMotion } = useScaledStyles();
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    if (focused && !fading) {
      opacity.setValue(0);
      lift.setValue(arriving ? 0 : 10);
    }
    const easing = Easing.bezier(...motion.ease);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: focused && !fading ? 1 : 0, duration: reduceMotion ? 0 : (fading || arriving) ? 200 : focused ? 300 : 180, easing, useNativeDriver: true }),
      Animated.timing(lift, { toValue: fading ? 0 : focused ? 0 : -6, duration: reduceMotion ? 0 : (fading || arriving) ? 200 : focused ? 340 : 180, easing, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [arriving, fading, focused, lift, opacity, reduceMotion]);
  return <Animated.View style={{ flex: 1, backgroundColor: color.page, opacity, transform: [{ translateY: lift }] }}>{children}</Animated.View>;
}
