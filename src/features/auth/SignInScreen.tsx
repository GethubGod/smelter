import React, { useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { AuthLoadingScreen } from '@/components';
import { Button, Input, Segment } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { supabase } from '@/lib';
import { getLoginFailureCode, signInWithName } from '@/services/loginCredentials';
import { useAuthStore } from '@/store';
import { auth, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from './components/AuthScreenShell';

type SignInMethod = 'name' | 'email';
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function SignInScreen() {
  const params = useLocalSearchParams<{
    method?: string | string[];
    email?: string | string[];
    notice?: string | string[];
  }>();
  const initialEmail = first(params.email) ?? '';
  const initialMethod = first(params.method) === 'email' || initialEmail || first(params.notice) === 'confirm-email'
    ? 'email' : 'name';
  // A new inbound link resets the form, even when Expo reuses the route.
  return <SignInForm key={`${initialMethod}:${initialEmail}:${first(params.notice) ?? ''}`}
    initialMethod={initialMethod} initialEmail={initialEmail}
    confirmEmail={first(params.notice) === 'confirm-email'} />;
}

function SignInForm({ initialMethod, initialEmail, confirmEmail }: {
  initialMethod: SignInMethod;
  initialEmail: string;
  confirmEmail: boolean;
}) {
  const ds = useScaledStyles();
  const guard = useAuthScreenGuard();
  const signIn = useAuthStore((state) => state.signIn);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [method, setMethod] = useState<SignInMethod>(initialMethod);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [secret, setSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);
  const emailMode = method === 'email';
  const identifier = emailMode ? email : name;
  const busy = submitting || resetting || isLoading;
  const canSubmit = identifier.trim().length > 0 && secret.length > 0 && !busy;

  const changeMethod = (next: SignInMethod) => {
    if (requestInFlight.current || busy || next === method) return;
    setMethod(next);
    setSecret('');
    setError(null);
  };

  const handleSignIn = async () => {
    if (!canSubmit || requestInFlight.current) return;
    requestInFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (emailMode) await signIn(email.trim(), secret);
      else await signInWithName(name.trim(), secret);
    } catch (signInError: unknown) {
      setError(signInError instanceof Error ? signInError.message : 'Unable to sign in right now. Check your connection.');
      if (!emailMode && getLoginFailureCode(signInError) === 'invalid') setSecret('');
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailMode || busy || requestInFlight.current) return;
    if (!email.trim()) {
      Alert.alert('Email Required', 'Enter your email first, then tap Forgot password.');
      return;
    }
    requestInFlight.current = true;
    setResetting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetError) throw resetError;
      Alert.alert('Password Reset Email Sent', 'Check your inbox for reset instructions.');
    } catch (resetError: unknown) {
      Alert.alert('Reset Failed', resetError instanceof Error ? resetError.message : 'Unable to send reset email right now.');
    } finally {
      requestInFlight.current = false;
      setResetting(false);
    }
  };

  if (guard.isChecking) return <AuthLoadingScreen onDark />;
  if (guard.authenticatedRedirectTo) return <Redirect href={guard.authenticatedRedirectTo} />;

  const hintStyle = { fontSize: ds.fontSize(typeScale.secondary), color: auth.dim, textAlign: 'center' as const };
  return (
    <AuthScreenShell dismissKeyboardOnPress={false}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: ds.spacing(space[6]) }}>
        <Pressable accessible={false} onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingTop: ds.spacing(space[8]) }}>
            <Text accessibilityRole="header" style={{ fontSize: ds.fontSize(typeScale.display),
              fontWeight: weight.bold, letterSpacing: tracking.display, color: auth.text,
              marginBottom: ds.spacing(space[5]) }}>Sign in</Text>
            <Segment<SignInMethod> onDark accessibilityLabel="Sign-in method" value={method}
              options={[{ value: 'name', label: 'Name', disabled: busy }, { value: 'email', label: 'Email', disabled: busy }]}
              onChange={changeMethod} style={{ marginBottom: ds.spacing(space[5]) }} />
            {confirmEmail && emailMode ? <Text style={[hintStyle, { marginBottom: ds.spacing(space[4]) }]}>
              Check your email and confirm your account before signing in.
            </Text> : null}
            <Input key={method} label={emailMode ? 'Email' : 'Name'} onDark value={identifier}
              onChangeText={(value) => { if (emailMode) setEmail(value); else setName(value); setError(null); }}
              placeholder={emailMode ? 'Your email' : 'Your name'}
              textContentType={emailMode ? 'emailAddress' : 'username'}
              autoComplete={emailMode ? 'email' : 'username'}
              keyboardType={emailMode ? 'email-address' : 'default'}
              autoCapitalize={emailMode ? 'none' : 'words'} autoCorrect={false} editable={!busy} />
            <Input label={emailMode ? 'Password' : 'PIN or password'} onDark value={secret}
              onChangeText={(value) => { setSecret(value); setError(null); }}
              placeholder={emailMode ? 'Enter your password' : 'Enter your PIN or password'}
              secureTextEntry textContentType="password" autoComplete="password"
              autoCapitalize="none" autoCorrect={false} returnKeyType="go"
              onSubmitEditing={handleSignIn} editable={!busy} error={error ?? undefined} />
            <Button label="Sign in" onPress={handleSignIn} loading={submitting}
              disabled={!canSubmit} style={{ marginTop: ds.spacing(space[5]) }} />
            {emailMode ? <Pressable accessibilityRole="button" disabled={busy}
              accessibilityState={{ disabled: busy, busy: resetting }} onPress={handleForgotPassword}
              style={{ minHeight: ds.spacing(size.touchMin), justifyContent: 'center', marginTop: ds.spacing(space[4]) }}>
              <Text style={hintStyle}>{resetting ? 'Sending reset link...' : 'Forgot password?'}</Text>
            </Pressable> : <Text style={[hintStyle, { marginTop: ds.spacing(space[4]) }]}>
              Forgot it? Ask the manager for a reset
            </Text>}
          </View>
          <Link href="/(auth)/signup" asChild>
            <Pressable accessibilityRole="link" disabled={busy} accessibilityState={{ disabled: busy }}
              style={{ minHeight: ds.spacing(size.touchMin), justifyContent: 'center', marginTop: ds.spacing(space[6]) }}>
              <Text style={hintStyle}>Have a sign-up code instead?</Text>
            </Pressable>
          </Link>
        </Pressable>
      </ScrollView>
    </AuthScreenShell>
  );
}
