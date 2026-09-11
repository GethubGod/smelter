// Screens 01/02 — Welcome. Two actions only; the paste state is revealed by
// "I have an invite link". The clipboard is read exclusively from that tap
// (iOS surfaces a paste notice; never read silently on launch).

import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AuthLoadingScreen, AuthLogoHeader } from '@/components';
import { Button, Input } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { parseJoinToken } from '@/services/inviteLinks';
import { space } from '@/theme/tokens';
import { AuthScreenShell } from './components/AuthScreenShell';

const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

function extractToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (RAW_TOKEN_PATTERN.test(trimmed)) return trimmed;
  return parseJoinToken(trimmed);
}

export default function WelcomeScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const guard = useAuthScreenGuard();
  const [showPaste, setShowPaste] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (guard.isChecking) return <AuthLoadingScreen onDark />;
  if (guard.authenticatedRedirectTo) return <Redirect href={guard.authenticatedRedirectTo} />;

  const handleShowPaste = async () => {
    setShowPaste(true);
    setError(null);
    try {
      // User-initiated read only — this tap is the trigger.
      const clip = await Clipboard.getStringAsync();
      if (clip && extractToken(clip)) {
        setLinkInput(clip.trim());
      }
    } catch {
      // Clipboard unavailable — the field still accepts manual paste.
    }
  };

  const handleContinue = () => {
    const token = extractToken(linkInput);
    if (!token) {
      setError("That doesn't look like an invite link. Paste the whole link from your manager.");
      return;
    }
    setError(null);
    router.push(
      { pathname: '/(auth)/invite-hello', params: { token } } as Parameters<typeof router.push>[0],
    );
  };

  return (
    <AuthScreenShell>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: ds.spacing(space[8]) }}>
          <AuthLogoHeader size={64} />
        </View>

        {showPaste ? (
          <View style={{ gap: ds.spacing(space[3]) }}>
            <Input
              label="Paste your invite link"
              onDark
              accessibilityLabel="Invite link"
              value={linkInput}
              onChangeText={(value) => {
                setLinkInput(value);
                if (error) setError(null);
              }}
              placeholder="tips.babytunasystems.com/join/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleContinue}
              error={error ?? undefined}
            />
            <Button label="Continue" onPress={handleContinue} />
            <Button
              label="Back"
              variant="secondary"
              onDark
              onPress={() => {
                setShowPaste(false);
                setLinkInput('');
                setError(null);
              }}
            />
          </View>
        ) : (
          <View style={{ gap: ds.spacing(space[3]) }}>
            <Button label="I have an invite link" onPress={handleShowPaste} />
            <Button
              label="Sign in"
              variant="secondary"
              onDark
              onPress={() => router.push('/(auth)/sign-in' as Parameters<typeof router.push>[0])}
            />
          </View>
        )}
      </View>
    </AuthScreenShell>
  );
}
