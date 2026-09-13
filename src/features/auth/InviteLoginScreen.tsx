import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { AuthLoadingScreen } from '@/components';
import { Button } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  acceptInvite,
  getInviteErrorInvitedBy,
  getInviteFailureReason,
  getInviteServiceCode,
  isInviteNetworkError,
} from '@/services/invites';
import { useAuthStore } from '@/store/authStore';
import { auth, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthCloseButton } from './components/AuthCloseButton';
import { AuthInputWell } from './components/AuthInputWell';
import { AuthScreenShell } from './components/AuthScreenShell';
import {
  getPasswordRequirements,
  PasswordRequirements,
} from './components/PasswordRequirements';
import { WizardProgress } from './components/WizardProgress';
import { inviteLinkErrorMessage } from './InviteLinkScreen';
import { useOnboardingStore } from './onboardingStore';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isInviteEmailValid(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export default function InviteLoginScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const guard = useAuthScreenGuard();
  const passwordRef = useRef<TextInput>(null);
  const finishInFlight = useRef(false);
  const token = useOnboardingStore((state) => state.token);
  const preview = useOnboardingStore((state) => state.preview);
  const reset = useOnboardingStore((state) => state.reset);
  const signIn = useAuthStore((state) => state.signIn);
  const setReadyPending = useAuthStore((state) => state.setReadyPending);
  const invitedEmail = preview?.invitedEmail?.trim() ?? '';
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (invitedEmail) setEmail(invitedEmail);
  }, [invitedEmail]);

  const requirements = getPasswordRequirements(password);
  const passwordValid = Object.values(requirements).every(Boolean);
  const canFinish = isInviteEmailValid(email) && passwordValid;

  const closeWizard = useCallback(() => {
    if (finishInFlight.current) return;
    reset();
    router.dismissTo('/(auth)/welcome');
  }, [reset, router]);

  const handleFinish = useCallback(async () => {
    if (!token || !canFinish || finishInFlight.current) return;
    finishInFlight.current = true;
    setSubmitting(true);
    setEmailError(null);
    setPasswordError(null);
    setReadyPending(true);

    try {
      await acceptInvite({ token, email: email.trim().toLowerCase(), password });
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(auth)/ready');
    } catch (error) {
      setReadyPending(false);
      const serviceCode = getInviteServiceCode(error);
      if (serviceCode === 'email_exists') {
        setEmailError('That email already has a smelter account. Sign in instead.');
      } else if (isInviteNetworkError(error)) {
        setPasswordError("Can't reach smelter. Check your connection and try again.");
      } else if (serviceCode === 'email_invalid' || serviceCode === 'account_rejected') {
        setEmailError(error instanceof Error ? error.message : null);
      } else if (serviceCode === 'password_rejected' && error instanceof Error) {
        setPasswordError(error.message);
      } else {
        const failure = getInviteFailureReason(error);
        setPasswordError(
          failure
            ? inviteLinkErrorMessage(
                failure,
                getInviteErrorInvitedBy(error) ?? preview?.invitedBy ?? null,
              )
            : error instanceof Error
              ? error.message
              : "This invite isn't valid any more. Ask your manager for a new link.",
        );
      }
    } finally {
      finishInFlight.current = false;
      setSubmitting(false);
    }
  }, [canFinish, email, password, preview?.invitedBy, router, setReadyPending, signIn, token]);

  if (!token || !preview) return <Redirect href="/(auth)/invite-link" />;
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
      <WizardProgress step={3} startsAt={2} />
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
        Create your login
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
        {"You'll use this in the Sign in sheet next time."}
      </Text>

      <AuthInputWell
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (emailError) setEmailError(null);
        }}
        error={emailError}
        locked={Boolean(invitedEmail) || submitting}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        autoComplete="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        testID="invite-email-input"
      />
      <AuthInputWell
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (passwordError) setPasswordError(null);
        }}
        error={passwordError}
        locked={submitting}
        trailingLabel={showPassword ? 'Hide' : 'Show'}
        onTrailingPress={() => setShowPassword((visible) => !visible)}
        placeholder="Choose a password"
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="new-password"
        passwordRules="minlength: 8; required: lower; required: digit;"
        returnKeyType="done"
        onSubmitEditing={() => void handleFinish()}
        testID="invite-password-input"
      />
      <PasswordRequirements password={password} />
      <Button
        shape="pill"
        label="Finish"
        onPress={() => void handleFinish()}
        loading={submitting}
        disabled={!canFinish}
        style={{ marginTop: ds.spacing(18) }}
      />
      <Text
        style={{
          marginTop: ds.spacing(space[2]),
          fontSize: ds.fontSize(typeScale.meta),
          fontWeight: weight.regular,
          lineHeight: ds.fontSize(typeScale.meta) * 1.4,
          color: auth.faint,
          textAlign: 'center',
        }}
      >
        {"Saved to iPhone autofill, so you won't retype it."}
      </Text>
    </AuthScreenShell>
  );
}
