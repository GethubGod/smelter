import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { auth, space, typeScale, weight } from '@/theme/tokens';
import { AuthInputWell } from './AuthInputWell';
import { AuthToast } from './AuthToast';
import { ProviderButtons } from './ProviderButtons';

interface SignInSheetProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Provider = 'google' | 'apple';

const WRONG_PASSWORD = "That password doesn't match. Try again or reset it.";
const NETWORK_ERROR = "Can't reach smelter. Check your connection and try again.";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('offline')
  );
}

export function SignInSheet({ visible, onClose, onComplete }: SignInSheetProps) {
  const ds = useScaledStyles();
  const emailRef = useRef<TextInput>(null);
  const inFlight = useRef(false);
  const visibleRef = useRef(visible);
  const presentationGeneration = useRef(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    visibleRef.current = visible;
    if (!visible && !inFlight.current) {
      setFinishing(false);
      setPassword('');
      setPasswordVisible(false);
      setError(null);
      setToast(null);
    }
  }, [visible]);

  const handleClose = () => {
    presentationGeneration.current += 1;
    visibleRef.current = false;
    if (!inFlight.current) {
      useAuthStore.getState().setReadyPending(false);
    }
    onClose();
  };

  const requestIsCurrent = (generation: number) =>
    generation === presentationGeneration.current && visibleRef.current;

  const discardStaleSignIn = async () => {
    if (useAuthStore.getState().session) {
      await useAuthStore.getState().signOut();
    }
    useAuthStore.getState().setReadyPending(false);
  };

  const leaveUnaffiliatedAccount = async () => {
    const role = useAuthStore.getState().profile?.role;
    if (role) return false;
    await useAuthStore.getState().signOut();
    useAuthStore.getState().setReadyPending(false);
    onClose();
    return true;
  };

  const completeSignIn = async (request: () => Promise<unknown>, generation: number) => {
    useAuthStore.getState().setReadyPending(true);
    await request();
    if (!requestIsCurrent(generation)) {
      await discardStaleSignIn();
      return;
    }
    if (await leaveUnaffiliatedAccount()) return;
    setFinishing(true);
    onComplete();
  };

  const handlePasswordSignIn = async () => {
    if (inFlight.current || !email.trim() || !password) return;
    inFlight.current = true;
    const generation = presentationGeneration.current;
    setSubmitting(true);
    setError(null);
    try {
      await completeSignIn(
        () => useAuthStore.getState().signIn(email.trim(), password),
        generation,
      );
    } catch (signInError) {
      useAuthStore.getState().setReadyPending(false);
      setError(isNetworkFailure(signInError) ? NETWORK_ERROR : WRONG_PASSWORD);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleProvider = async (provider: Provider) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const generation = presentationGeneration.current;
    setBusyProvider(provider);
    setError(null);
    useAuthStore.getState().setReadyPending(true);
    try {
      const session =
        provider === 'apple'
          ? await useAuthStore.getState().signInWithApple()
          : await useAuthStore.getState().signInWithOAuth('google');
      if (!session) {
        useAuthStore.getState().setReadyPending(false);
        return;
      }
      if (!requestIsCurrent(generation)) {
        await discardStaleSignIn();
        return;
      }
      if (await leaveUnaffiliatedAccount()) return;
      setFinishing(true);
      onComplete();
    } catch (providerError) {
      useAuthStore.getState().setReadyPending(false);
      if (isNetworkFailure(providerError)) setError(NETWORK_ERROR);
    } finally {
      inFlight.current = false;
      setBusyProvider(null);
    }
  };

  const handleResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setToast('Enter your email first');
      emailRef.current?.focus();
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
    if (resetError) {
      setToast(isNetworkFailure(resetError) ? NETWORK_ERROR : 'Enter your email first');
      return;
    }
    setToast(`Reset link sent to ${normalizedEmail}`);
  };

  const clearError = () => {
    if (error) setError(null);
  };

  return (
    <Sheet
      visible={visible}
      title="Sign in"
      onClose={handleClose}
      expandable={false}
      fadeOut={finishing}
      overlay={<AuthToast message={toast} onHidden={() => setToast(null)} />}
    >
      <ProviderButtons
        googleLabel="Continue with Google"
        appleLabel="Continue with Apple"
        busyProvider={busyProvider}
        disabled={submitting}
        onGoogle={() => void handleProvider('google')}
        onApple={() => void handleProvider('apple')}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(space[3]) }}>
        <View style={{ flex: 1, height: 1, backgroundColor: auth.hair }} />
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.meta),
            fontWeight: weight.regular,
            color: auth.faint,
          }}
        >
          or use email
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: auth.hair }} />
      </View>

      <View style={{ gap: ds.spacing(10) }}>
        <AuthInputWell
          ref={emailRef}
          accessibilityLabel="Email"
          placeholder="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clearError();
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
        />
        <AuthInputWell
          accessibilityLabel="Password"
          placeholder="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearError();
          }}
          secureTextEntry={!passwordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void handlePasswordSignIn()}
          trailingLabel={passwordVisible ? 'Hide' : 'Show'}
          onTrailingPress={() => setPasswordVisible((current) => !current)}
          error={error}
        />
      </View>

      <Button
        shape="pill"
        onDark
        label="Sign in"
        disabled={!email.trim() || !password}
        loading={submitting}
        onPress={() => void handlePasswordSignIn()}
        style={{ marginTop: ds.spacing(2) }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Forgot password?"
        onPress={() => void handleResetPassword()}
        style={{ alignItems: 'center', paddingTop: ds.spacing(space[3]) }}
      >
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.link),
            fontWeight: weight.regular,
            color: auth.dim,
          }}
        >
          Forgot password?
        </Text>
      </Pressable>

    </Sheet>
  );
}
