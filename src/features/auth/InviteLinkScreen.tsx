import React, { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AuthLoadingScreen } from '@/components';
import { Button } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { parseJoinToken } from '@/services/inviteLinks';
import {
  fetchInvitePreview,
  getInviteErrorInvitedBy,
  getInviteFailureReason,
  isInviteNetworkError,
  type InviteFailureReason,
} from '@/services/invites';
import { auth, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthCloseButton } from './components/AuthCloseButton';
import { AuthInputWell } from './components/AuthInputWell';
import { AuthScreenShell } from './components/AuthScreenShell';
import { WizardProgress } from './components/WizardProgress';
import { useOnboardingStore } from './onboardingStore';

type LinkFailure = InviteFailureReason | 'network';

function managerFirstName(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

function readFailure(value: string | string[] | undefined): LinkFailure | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'used' ||
    raw === 'expired' ||
    raw === 'revoked' ||
    raw === 'invalid' ||
    raw === 'network'
    ? raw
    : null;
}

export function inviteLinkErrorMessage(
  failure: LinkFailure,
  invitedBy: string | null,
): string {
  const manager = managerFirstName(invitedBy);
  switch (failure) {
    case 'expired':
      return manager
        ? `This invite has expired. Ask ${manager} to send a new one.`
        : 'This invite has expired. Ask your manager to send a new one.';
    case 'used':
      return manager
        ? `This invite was already used. Ask ${manager} for a new one if that wasn't you.`
        : "This invite was already used. Ask your manager for a new one if that wasn't you.";
    case 'network':
      return "Can't reach smelter. Check your connection and try again.";
    default:
      return "This invite isn't valid any more. Ask your manager for a new link.";
  }
}

export default function InviteLinkScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const guard = useAuthScreenGuard();
  const params = useLocalSearchParams<{
    link?: string | string[];
    failure?: string | string[];
    invitedBy?: string | string[];
  }>();
  const initialLink = Array.isArray(params.link) ? params.link[0] : params.link;
  const initialInvitedBy = Array.isArray(params.invitedBy)
    ? params.invitedBy[0]
    : params.invitedBy;
  const initialFailure = readFailure(params.failure);
  const setInvite = useOnboardingStore((state) => state.setInvite);
  const reset = useOnboardingStore((state) => state.reset);
  const [link, setLink] = useState(initialLink?.trim() ?? '');
  const [error, setError] = useState<string | null>(
    initialFailure ? inviteLinkErrorMessage(initialFailure, initialInvitedBy?.trim() || null) : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const continueInFlight = useRef(false);

  const closeWizard = useCallback(() => {
    if (continueInFlight.current) return;
    reset();
    router.dismissTo('/(auth)/welcome');
  }, [reset, router]);

  const handlePaste = useCallback(async () => {
    try {
      const clipboardValue = await Clipboard.getStringAsync();
      setLink(clipboardValue.trim());
      setError(null);
      setFlashKey((value) => value + 1);
    } catch {
      // Manual paste remains available when iOS does not return clipboard text.
    }
  }, []);

  const handleContinue = useCallback(async () => {
    if (!link.trim() || continueInFlight.current) return;
    const token = parseJoinToken(link);
    if (!token) {
      setError("That doesn't look like an invite link. Paste the whole link from your manager.");
      return;
    }

    continueInFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const preview = await fetchInvitePreview(token);
      setInvite(token, preview);
      router.push({
        pathname: '/(auth)/invite-hello',
        params: { token },
      });
    } catch (requestError) {
      const failure = isInviteNetworkError(requestError)
        ? 'network'
        : (getInviteFailureReason(requestError) ?? 'invalid');
      setError(
        inviteLinkErrorMessage(failure, getInviteErrorInvitedBy(requestError)),
      );
    } finally {
      continueInFlight.current = false;
      setSubmitting(false);
    }
  }, [link, router, setInvite]);

  if (guard.isChecking) return <AuthLoadingScreen onDark />;
  if (guard.authenticatedRedirectTo) return <Redirect href={guard.authenticatedRedirectTo} />;

  return (
    <AuthScreenShell showLegalFooter={false}>
      <View
        style={{
          height: ds.spacing(30),
          marginTop: ds.spacing(space[1]),
          marginBottom: ds.spacing(14),
          alignItems: 'flex-end',
        }}
      >
        <AuthCloseButton onPress={closeWizard} label="Close invite setup" />
      </View>
      <WizardProgress step={1} startsAt={0} />
      <Text
        accessibilityRole="header"
        style={{
          fontSize: ds.fontSize(typeScale.display),
          fontWeight: weight.bold,
          letterSpacing: tracking.display,
          lineHeight: ds.fontSize(typeScale.display) * 1.1,
          color: auth.text,
        }}
      >
        Paste your invite link
      </Text>
      <Text
        style={{
          marginTop: ds.spacing(6),
          fontSize: ds.fontSize(typeScale.secondary),
          fontWeight: weight.regular,
          lineHeight: ds.fontSize(typeScale.secondary) * 1.45,
          color: auth.dim,
        }}
      >
        Your manager sent it by text or email.
      </Text>

      <AuthInputWell
        label="Invite link"
        value={link}
        onChangeText={(value) => {
          setLink(value);
          if (error) setError(null);
        }}
        error={error}
        trailingLabel="Paste"
        onTrailingPress={() => void handlePaste()}
        flashKey={flashKey}
        placeholder="smelterpos.com/join/…"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={() => void handleContinue()}
        locked={submitting}
        testID="invite-link-input"
      />
      <Text
        style={{
          marginTop: ds.spacing(space[2]),
          fontSize: ds.fontSize(typeScale.meta),
          fontWeight: weight.regular,
          lineHeight: ds.fontSize(typeScale.meta) * 1.4,
          color: auth.faint,
        }}
      >
        The clipboard is only read when you tap Paste.
      </Text>
      <Button
        shape="pill"
        onDark
        label="Continue"
        onPress={() => void handleContinue()}
        loading={submitting}
        disabled={!link.trim()}
        style={{ marginTop: ds.spacing(18) }}
      />
    </AuthScreenShell>
  );
}
