// Screen 05a — PIN entry. Four dots, confirm-by-re-entry, then the invite is
// accepted and the PIN stored server-side (bcrypt, rate limited). Secure
// storage of the session itself is unchanged (SecureStore).

import { useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Loading } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerNotificationHaptic, NotificationFeedbackType } from '@/lib/haptics';
import { PIN_LENGTH } from '@/services/loginCredentials';
import { auth, color, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from './components/AuthScreenShell';
import { PinDots, PinPad } from './components/PinPad';
import { useOnboardingStore } from './onboardingStore';

type Phase = 'enter' | 'confirm' | 'submitting' | 'failed';

export default function SecurePinScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const token = useOnboardingStore((state) => state.token);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);

  const [phase, setPhase] = useState<Phase>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [digits, setDigits] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  if (!token) {
    return <Redirect href={'/(auth)/welcome' as never} />;
  }

  const submit = async (pin: string) => {
    setPhase('submitting');
    try {
      await completeOnboarding('pin', pin);
      triggerNotificationHaptic(NotificationFeedbackType.Success);
      router.replace('/(auth)/ready' as Parameters<typeof router.replace>[0]);
    } catch (error) {
      triggerNotificationHaptic(NotificationFeedbackType.Error);
      setFailureMessage(error instanceof Error ? error.message : 'Something went wrong. Try again.');
      setFirstPin(pin);
      setPhase('failed');
    }
  };

  const handleDigit = (digit: string) => {
    if (phase === 'submitting') return;
    if (mismatch) setMismatch(false);
    const next = (digits + digit).slice(0, PIN_LENGTH);
    setDigits(next);

    if (next.length < PIN_LENGTH) return;

    if (phase === 'enter') {
      setFirstPin(next);
      setDigits('');
      setPhase('confirm');
      return;
    }

    if (phase === 'confirm') {
      if (next === firstPin) {
        void submit(next);
      } else {
        triggerNotificationHaptic(NotificationFeedbackType.Warning);
        setMismatch(true);
        setFirstPin('');
        setDigits('');
        setPhase('enter');
      }
    }
  };

  const handleBackspace = () => {
    if (phase === 'submitting') return;
    setDigits((current) => current.slice(0, -1));
  };

  const title =
    phase === 'confirm' ? 'Enter it again' : phase === 'failed' ? 'Almost there' : 'Enter your PIN';
  const subtitle =
    phase === 'confirm'
      ? 'Same 4 digits, to confirm'
      : mismatch
        ? "Those didn't match. Start with the first 4 digits again"
        : 'The one the manager gave you';

  const titleStyle = {
    fontSize: ds.fontSize(typeScale.title),
    fontWeight: weight.bold,
    letterSpacing: tracking.title,
    color: auth.text,
    textAlign: 'center' as const,
  };

  return (
    <AuthScreenShell>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {phase === 'failed' ? (
          <>
            <Text
              accessibilityRole="header"
              style={{ ...titleStyle, marginBottom: ds.spacing(space[2]) }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                color: auth.dim,
                textAlign: 'center',
                marginBottom: ds.spacing(space[6]),
              }}
            >
              {failureMessage}
            </Text>
            <Button label="Try again" onPress={() => void submit(firstPin)} />
          </>
        ) : (
          <>
            <Text
              accessibilityRole="header"
              style={{ ...titleStyle, marginBottom: ds.spacing(space[1] / 2) }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                color: mismatch ? color.alert : auth.dim,
                textAlign: 'center',
              }}
            >
              {subtitle}
            </Text>
            <PinDots filled={digits.length} error={mismatch} />
            {phase === 'submitting' ? (
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: ds.spacing(space[8]),
                }}
              >
                <Loading size="inline" label="Setting up your account" />
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    fontSize: ds.fontSize(typeScale.secondary),
                    color: auth.dim,
                    marginTop: ds.spacing(space[3]),
                  }}
                >
                  Setting up your account
                </Text>
              </View>
            ) : (
              <PinPad onDigit={handleDigit} onBackspace={handleBackspace} />
            )}
          </>
        )}
      </View>
      {phase !== 'submitting' ? (
        <Button
          label="Back"
          variant="secondary"
          onDark
          onPress={() => router.back()}
          // Keep the control out of the home indicator band on devices that have one.
          style={{ marginBottom: Math.max(insets.bottom, ds.spacing(space[2] - 2)) }}
        />
      ) : null}
    </AuthScreenShell>
  );
}
