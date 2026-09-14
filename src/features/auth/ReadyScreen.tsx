import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthLoadingScreen } from '@/components';
import { Button } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useAuthStore } from '@/store/authStore';
import { auth, color, motion, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import type { InviteLocationGroup } from '@/services/invites';
import { AuthScreenShell } from './components/AuthScreenShell';
import { useOnboardingStore } from './onboardingStore';

function readyLine(locationGroup: InviteLocationGroup, manager: boolean): string {
  if (manager) return 'Your team is ready.';
  switch (locationGroup) {
    case 'sushi':
      return 'Your Sushi order list is ready.';
    case 'poki':
      return 'Your Poki & Pho order list is ready.';
    default:
      return 'Your order list is ready.';
  }
}

function firstName(name: string | null | undefined): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

function inferLocationGroup(locationName: string | null | undefined): InviteLocationGroup {
  const normalized = locationName?.toLowerCase() ?? '';
  if (normalized.includes('poki') || normalized.includes('pho')) return 'poki';
  if (normalized.includes('sushi')) return 'sushi';
  return 'both';
}

export default function ReadyScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const guard = useAuthScreenGuard();
  const preview = useOnboardingStore((state) => state.preview);
  const reset = useOnboardingStore((state) => state.reset);
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const location = useAuthStore((state) => state.location);
  const setViewMode = useAuthStore((state) => state.setViewMode);
  const setReadyPending = useAuthStore((state) => state.setReadyPending);
  const entrance = useRef(new Animated.Value(ds.reduceMotion ? 1 : 0)).current;
  const ringScale = useRef(new Animated.Value(ds.reduceMotion ? 1 : 0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entrance, {
        toValue: 1,
        duration: ds.reduceMotion ? 1 : 300,
        easing: Easing.bezier(...motion.ease),
        useNativeDriver: true,
      }),
      Animated.timing(ringScale, {
        toValue: 1,
        duration: ds.reduceMotion ? 1 : 460,
        easing: Easing.bezier(...motion.pop),
        useNativeDriver: true,
      }),
    ]).start();
  }, [ds.reduceMotion, entrance, ringScale]);

  if (guard.isChecking) return <AuthLoadingScreen onDark />;
  if (guard.authenticatedRedirectTo) return <Redirect href={guard.authenticatedRedirectTo} />;
  if (!user && !profile) return <Redirect href="/(auth)/welcome" />;

  const name = firstName(preview?.invitedName ?? profile?.full_name ?? user?.name);
  const role = preview?.role ?? profile?.role ?? user?.role ?? null;
  const manager = role === 'manager';
  const locationGroup = preview?.locationGroup ?? inferLocationGroup(location?.name);

  const handleEnter = () => {
    const home: '/(manager)' | '/(tabs)' = manager ? '/(manager)' : '/(tabs)';
    setViewMode(manager ? 'manager' : 'employee');
    reset();
    router.replace(home);
    setReadyPending(false);
  };

  return (
    <AuthScreenShell showLegalFooter={false}>
      <Animated.View
        style={{
          flex: 1,
          alignItems: 'center',
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
            },
          ],
        }}
      >
        <Animated.View
          style={{
            width: ds.spacing(size.authReadyRing),
            height: ds.spacing(size.authReadyRing),
            marginTop: ds.spacing(size.authReadyTop),
            marginBottom: ds.spacing(space[6]),
            borderRadius: radius.pill,
            backgroundColor: color.tint,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: ringScale }],
          }}
        >
          <Ionicons
            name="checkmark"
            size={ds.icon(size.authReadyCheck)}
            color={auth.accent}
          />
        </Animated.View>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: ds.fontSize(typeScale.display),
            fontWeight: weight.bold,
            letterSpacing: tracking.display,
            lineHeight: ds.fontSize(typeScale.display) * 1.1,
            color: auth.text,
            textAlign: 'center',
          }}
        >
          {name ? `You're set, ${name}` : "You're set"}
        </Text>
        <Text
          style={{
            marginTop: ds.spacing(6),
            fontSize: ds.fontSize(typeScale.secondary),
            fontWeight: weight.regular,
            lineHeight: ds.fontSize(typeScale.secondary) * 1.45,
            color: auth.dim,
            textAlign: 'center',
          }}
        >
          {readyLine(locationGroup, manager)}
        </Text>
        <View
          style={{
            alignSelf: 'stretch',
            marginTop: 'auto',
            paddingBottom: ds.spacing(30),
          }}
        >
          <Button
            shape="pill"
            onDark
            label={manager ? 'Open your dashboard' : "See today's list"}
            onPress={handleEnter}
          />
        </View>
      </Animated.View>
    </AuthScreenShell>
  );
}
