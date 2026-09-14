import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useAuthStore } from '@/store';
import { auth, motion } from '@/theme/tokens';

/**
 * Every auth screen uses the Studio auth surface, so the stack sets the
 * background once instead of relying on each route transition.
 */
export default function AuthLayout() {
  const ds = useScaledStyles();
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  // Group-level suspension guard (issue #62). The Ready route carries no
  // independent suspension guard, so this check keeps a suspended session
  // from seeing an onboarding success screen.
  if (isInitialized && session && profile?.is_suspended) {
    return <Redirect href="/suspended" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: auth.bg },
        animation: 'slide_from_right',
        animationDuration: ds.reduceMotion ? 1 : motion.dur,
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'none' }} />
      <Stack.Screen
        name="ready"
        options={{ animation: 'fade', animationDuration: ds.reduceMotion ? 1 : 240 }}
      />
    </Stack>
  );
}
