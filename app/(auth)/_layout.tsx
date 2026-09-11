import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store';
import { authTheme, colors } from '@/theme/design';

export default function AuthLayout() {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  // Group-level suspension guard (issue #62). The onboarding screens in this
  // group (/ready, /secure, /secure-pin, /secure-password) carry no guard of
  // their own, so a deep link could show a suspended session the onboarding
  // success screen. Guarding the group covers every screen in it, including
  // ones added later, and needs no edit inside the screens themselves.
  if (isInitialized && session && profile?.is_suspended) {
    return <Redirect href="/suspended" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: authTheme.background } }} />
      <Stack.Screen name="invite-hello" options={{ contentStyle: { backgroundColor: authTheme.background } }} />
      <Stack.Screen name="secure" options={{ contentStyle: { backgroundColor: authTheme.background } }} />
      <Stack.Screen name="secure-pin" options={{ contentStyle: { backgroundColor: authTheme.background } }} />
      <Stack.Screen name="secure-password" options={{ contentStyle: { backgroundColor: authTheme.background } }} />
      <Stack.Screen name="ready" options={{ contentStyle: { backgroundColor: authTheme.background } }} />
      <Stack.Screen name="sign-in" options={{ contentStyle: { backgroundColor: authTheme.background } }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
