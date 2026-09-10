// Screen 03 — Hello. Name from the invite preview, one Continue button.
// No avatar, no explainer copy (confirmed decisions).

import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AuthLoadingScreen } from '@/components';
import { Button, Loading } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  describeInviteFailure,
  fetchInvitePreview,
  getInviteFailureReason,
} from '@/services/invites';
import { auth, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from './components/AuthScreenShell';
import { StepProgress } from './components/StepProgress';
import { useOnboardingStore } from './onboardingStore';

export default function InviteHelloScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const guard = useAuthScreenGuard();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token)?.trim() ?? '';

  const setInvite = useOnboardingStore((state) => state.setInvite);
  const invitedName = useOnboardingStore((state) => state.invitedName);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStatus('error');
      setErrorMessage(describeInviteFailure('invalid'));
      return;
    }

    setStatus('loading');
    fetchInvitePreview(token)
      .then((preview) => {
        if (cancelled) return;
        setInvite(token, preview);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        const reason = getInviteFailureReason(error);
        setErrorMessage(
          reason ? describeInviteFailure(reason) : 'Unable to check this invite. Try again.',
        );
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [token, setInvite]);

  if (guard.isChecking) return <AuthLoadingScreen />;
  if (guard.authenticatedRedirectTo) return <Redirect href={guard.authenticatedRedirectTo} />;

  const titleStyle = {
    fontWeight: weight.bold,
    color: auth.text,
    textAlign: 'center' as const,
  };

  return (
    <AuthScreenShell>
      <StepProgress step={1} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {status === 'loading' ? (
          <Loading label="Checking your invite" />
        ) : status === 'error' ? (
          <>
            <Text
              accessibilityRole="header"
              style={{
                ...titleStyle,
                fontSize: ds.fontSize(typeScale.title),
                letterSpacing: tracking.title,
                marginBottom: ds.spacing(space[2]),
              }}
            >
              {"This invite won't work"}
            </Text>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                color: auth.dim,
                textAlign: 'center',
                marginBottom: ds.spacing(space[6]),
              }}
            >
              {errorMessage}
            </Text>
            <Button
              label="Back to start"
              onPress={() =>
                router.replace('/(auth)/welcome' as Parameters<typeof router.replace>[0])
              }
            />
          </>
        ) : (
          <>
            <Text
              accessibilityRole="header"
              style={{
                ...titleStyle,
                fontSize: ds.fontSize(typeScale.display),
                letterSpacing: tracking.display,
                marginBottom: ds.spacing(space[6]),
              }}
            >
              Hello, {invitedName ?? 'there'}
            </Text>
            <Button
              label="Continue"
              onPress={() => router.push('/(auth)/secure' as Parameters<typeof router.push>[0])}
            />
          </>
        )}
      </View>
      {status === 'error' ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.replace('/(auth)/welcome' as Parameters<typeof router.replace>[0])}
          style={{ alignItems: 'center', marginBottom: ds.spacing(space[2] - 2) }}
        >
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: auth.dim }}>
            Ask the manager for a new link if this keeps happening
          </Text>
        </TouchableOpacity>
      ) : null}
    </AuthScreenShell>
  );
}
