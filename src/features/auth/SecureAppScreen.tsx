// Screen 04 — Secure your app. Two option rows: restaurant PIN (primary)
// and create-a-password (secondary). Both ship (confirmed decision).
//
// The rows are the contract's Card and ListRow in their dark variant; the
// recommended option is the selected Card. See the PR body for the note on
// the additive `onDark` and `selected` props.

import { Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { PinDigitsIcon } from '@/components/icons/PinDigitsIcon';
import { Card, ListRow } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from './components/AuthScreenShell';
import { StepProgress } from './components/StepProgress';
import { useOnboardingStore } from './onboardingStore';

export default function SecureAppScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const token = useOnboardingStore((state) => state.token);

  // Deep-linking straight here without an invite makes no sense — restart.
  if (!token) {
    return <Redirect href={'/(auth)/welcome' as never} />;
  }

  return (
    <AuthScreenShell>
      <StepProgress step={2} />
      <Text
        accessibilityRole="header"
        style={{
          fontSize: ds.fontSize(typeScale.title),
          fontWeight: weight.bold,
          letterSpacing: tracking.title,
          color: auth.text,
        }}
      >
        Secure your app
      </Text>
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.secondary),
          color: auth.dim,
          marginTop: ds.spacing(space[1] / 2),
          marginBottom: ds.spacing(space[5]),
        }}
      >
        Pick one. You can change it later.
      </Text>

      <Card onDark selected style={{ marginBottom: ds.spacing(space[3] - 2) }}>
        <ListRow
          last
          onDark
          title="Use your restaurant PIN"
          subtitle="The same 4-digit code you use at the register"
          icon={<PinDigitsIcon size={ds.icon(size.icon)} color={color.accent} />}
          chevron
          onPress={() => router.push('/(auth)/secure-pin' as Parameters<typeof router.push>[0])}
        />
      </Card>
      <Card onDark>
        <ListRow
          last
          onDark
          title="Create a password"
          subtitle="Saves to iPhone autofill so you never retype it"
          icon="lock-closed-outline"
          chevron
          onPress={() =>
            router.push('/(auth)/secure-password' as Parameters<typeof router.push>[0])
          }
        />
      </Card>
      <View style={{ flex: 1 }} />
    </AuthScreenShell>
  );
}
