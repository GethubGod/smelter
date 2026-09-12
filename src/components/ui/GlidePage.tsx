import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { color, motion } from '@/theme/tokens';
import { useScaledStyles } from '@/hooks/useScaledStyles';

/** Mounted by the tab layout so each tab keeps its scroll state through a transition. */
export function GlidePage({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  const { reduceMotion } = useScaledStyles();
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    if (focused) {
      opacity.setValue(0);
      lift.setValue(10);
    }
    const easing = Easing.bezier(...motion.ease);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: focused ? 1 : 0, duration: reduceMotion ? 0 : focused ? 300 : 180, easing, useNativeDriver: true }),
      Animated.timing(lift, { toValue: focused ? 0 : -6, duration: reduceMotion ? 0 : focused ? 340 : 180, easing, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [focused, lift, opacity, reduceMotion]);
  return <Animated.View style={{ flex: 1, backgroundColor: color.page, opacity, transform: [{ translateY: lift }] }}>{children}</Animated.View>;
}
