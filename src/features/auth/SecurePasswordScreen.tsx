// Screen 05b — Create a password. Standard secure field with
// textContentType="newPassword" so iCloud Keychain offers to save it
// (backed by the webcredentials associated domain; see the handback note —
// the AASA file goes live with the next web deploy).

import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Button, Input } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerNotificationHaptic, NotificationFeedbackType } from '@/lib/haptics';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/services/loginCredentials';
import { auth, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from './components/AuthScreenShell';
import { useOnboardingStore } from './onboardingStore';

export default function SecurePasswordScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const token = useOnboardingStore((state) => state.token);
  const invitedName = useOnboardingStore((state) => state.invitedName);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return <Redirect href={'/(auth)/welcome' as never} />;
  }

  const handleSave = async () => {
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      setError(`Use between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completeOnboarding('password', password);
      triggerNotificationHaptic(NotificationFeedbackType.Success);
      router.replace('/(auth)/ready' as Parameters<typeof router.replace>[0]);
    } catch (submitError) {
      triggerNotificationHaptic(NotificationFeedbackType.Error);
      setError(
        submitError instanceof Error ? submitError.message : 'Something went wrong. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell>
      <View style={{ flex: 1, paddingTop: ds.spacing(space[6]) }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: ds.fontSize(typeScale.title),
            fontWeight: weight.bold,
            letterSpacing: tracking.title,
            color: auth.text,
          }}
        >
          Create a password
        </Text>
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.secondary),
            color: auth.dim,
            marginTop: ds.spacing(space[1] / 2),
            marginBottom: ds.spacing(space[5]),
          }}
        >
          Your iPhone will offer to save it.
        </Text>

        {/* Invisible username field so iOS saves name and password together. */}
        <TextInput
          value={invitedName ?? ''}
          editable={false}
          textContentType="username"
          autoComplete="username"
          style={{ height: 0, width: 0, opacity: 0, position: 'absolute' }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        <Input
          label="Password"
          onDark
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (error) setError(null);
          }}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={MAX_PASSWORD_LENGTH}
          passwordRules={`minlength: ${MIN_PASSWORD_LENGTH}; maxlength: ${MAX_PASSWORD_LENGTH};`}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          editable={!submitting}
          error={error ?? undefined}
        />

        <Text
          style={{
            fontSize: ds.fontSize(typeScale.secondary),
            color: auth.dim,
            marginTop: ds.spacing(space[2] - 2),
            marginBottom: ds.spacing(space[4]),
          }}
        >
          {`Use at least ${MIN_PASSWORD_LENGTH} characters`}
        </Text>

        <Button
          label="Save and continue"
          onPress={handleSave}
          loading={submitting}
          disabled={password.length < MIN_PASSWORD_LENGTH}
        />
        {!submitting ? (
          <Button
            label="Back"
            variant="secondary"
            onDark
            onPress={() => router.back()}
            style={{ marginTop: ds.spacing(space[3]) }}
          />
        ) : null}
      </View>
    </AuthScreenShell>
  );
}
