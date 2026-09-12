import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, motion, radius, typeScale, weight } from '@/theme/tokens';

/**
 * Lightweight toast for the checklist surface, with an optional action button
 * ("Undo" after Clear checklist — the spec's replacement for a confirm
 * dialog). Host owns the state; the toast just renders and auto-expires.
 */

export interface ChecklistToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Bumped per show so identical messages re-trigger the timer. */
  id: number;
}

interface ChecklistToastProps {
  toast: ChecklistToastState | null;
  /** Bottom offset above the pinned bar + pill. */
  bottom: number;
  onExpire: () => void;
  durationMs?: number;
}

export function ChecklistToast({
  toast,
  bottom,
  onExpire,
  durationMs = 2200,
}: ChecklistToastProps) {
  const ds = useScaledStyles();
  const opacity = useRef(new Animated.Value(0)).current;
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!toast) {
      opacity.setValue(0);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.bezier(...motion.ease), useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        expireRef.current();
      });
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, opacity, toast]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        alignItems: 'center',
        opacity,
        transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <TouchableOpacity
        activeOpacity={toast.onAction ? 0.85 : 1}
        onPress={toast.onAction}
        disabled={!toast.onAction}
        accessibilityRole={toast.onAction ? 'button' : 'text'}
        accessibilityLabel={
          toast.actionLabel ? `${toast.message}. ${toast.actionLabel}` : toast.message
        }
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(10),
          backgroundColor: color.ink,
          borderRadius: radius.control,
          paddingHorizontal: ds.spacing(16),
          paddingVertical: ds.spacing(11),
          maxWidth: '86%',
        }}
      >
        <Text
          numberOfLines={2}
          style={{ fontSize: ds.fontSize(typeScale.secondary), fontWeight: weight.semibold, color: color.onAccent, flexShrink: 1 }}
        >
          {toast.message}
        </Text>
        {toast.actionLabel ? (
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), fontWeight: '700', color: color.tint }}>
            {toast.actionLabel}
          </Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}
