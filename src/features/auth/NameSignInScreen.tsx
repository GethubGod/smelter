// Screen 07 — Sign in. Name + PIN-or-password as real text fields so iOS
// autofill works (username/password content types). Server-verified, rate
// limited, manager-resettable. The legacy access-code signup stays reachable
// through the small link at the bottom (standing roadmap rule).

import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { AuthLoadingScreen } from '@/components';
import { Button, Input } from '@/components/ui';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { getLoginFailureCode, signInWithName } from '@/services/loginCredentials';
import { auth, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from './components/AuthScreenShell';

export default function NameSignInScreen() {
  const ds = useScaledStyles();
  const guard = useAuthScreenGuard();
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (guard.isChecking) return <AuthLoadingScreen onDark />;
  if (guard.authenticatedRedirectTo) return <Redirect href={guard.authenticatedRedirectTo} />;

  const canSubmit = name.trim().length > 0 && secret.length > 0 && !submitting;

  const handleSignIn = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await signInWithName(name, secret);
      // The auth guard redirects on the next render once the session lands.
    } catch (signInError) {
      const code = getLoginFailureCode(signInError);
      setError(
        signInError instanceof Error && (code || signInError.message)
          ? signInError.message
          : 'Unable to sign in right now. Check your connection.',
      );
      if (code === 'invalid') setSecret('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell>
      <View style={{ flex: 1, paddingTop: ds.spacing(space[8]) }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: ds.fontSize(typeScale.display),
            fontWeight: weight.bold,
            letterSpacing: tracking.display,
            color: auth.text,
            marginBottom: ds.spacing(space[5]),
          }}
        >
          Sign in
        </Text>

        <Input
          label="Name"
          onDark
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError(null);
          }}
          placeholder="Your name"
          textContentType="username"
          autoComplete="username"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="next"
          editable={!submitting}
        />

        <Input
          label="PIN or password"
          onDark
          value={secret}
          onChangeText={(value) => {
            setSecret(value);
            if (error) setError(null);
          }}
          placeholder="••••"
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
          editable={!submitting}
          error={error ?? undefined}
        />

        <Button
          label="Sign in"
          onPress={handleSignIn}
          loading={submitting}
          disabled={!canSubmit}
          style={{ marginTop: ds.spacing(space[5]) }}
        />

        <Text
          style={{
            fontSize: ds.fontSize(typeScale.secondary),
            color: auth.dim,
            textAlign: 'center',
            marginTop: ds.spacing(space[4]),
          }}
        >
          Forgot it? Ask the manager for a reset
        </Text>
      </View>

      <View style={{ alignItems: 'center', marginBottom: ds.spacing(space[2] - 2) }}>
        <Link href="/(auth)/signup" asChild>
          <TouchableOpacity
            accessibilityRole="link"
            hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
            style={{ justifyContent: 'center', minHeight: ds.spacing(size.touchMin) }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                fontWeight: weight.semibold,
                color: auth.dim,
              }}
            >
              Have a sign-up code instead?
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </AuthScreenShell>
  );
}
