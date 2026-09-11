// Screen 06 — Ready. "You're set, <Name>" routes into the app (whatever the
// current tab layout resolves to for this account).

import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import type { InviteLocationGroup } from '@/services/invites';
import { AuthScreenShell } from './components/AuthScreenShell';
import { useOnboardingStore } from './onboardingStore';

function readyLine(locationGroup: InviteLocationGroup): string {
  switch (locationGroup) {
    case 'sushi':
      return 'Your Sushi order list is ready.';
    case 'poki':
      return 'Your Poki & Pho order list is ready.';
    default:
      return 'Your order list is ready.';
  }
}

export default function ReadyScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const invitedName = useOnboardingStore((state) => state.invitedName);
  const locationGroup = useOnboardingStore((state) => state.locationGroup);
  const reset = useOnboardingStore((state) => state.reset);
  const circle = ds.icon(size.emptyStateIcon);

  const handleEnter = () => {
    reset();
    // The index route resolves the right home (tabs or manager) from the
    // freshly hydrated session.
    router.replace('/');
  };

  return (
    <AuthScreenShell showLegalFooter={false}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View
          style={{
            width: circle,
            height: circle,
            borderRadius: radius.pill,
            backgroundColor: color.accent,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: ds.spacing(space[4]),
          }}
        >
          <Ionicons name="checkmark" size={ds.icon(size.icon)} color={color.onAccent} />
        </View>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: ds.fontSize(typeScale.display),
            fontWeight: weight.bold,
            letterSpacing: tracking.display,
            color: auth.text,
            textAlign: 'center',
          }}
        >
          {`You're set${invitedName ? `, ${invitedName}` : ''}`}
        </Text>
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.secondary),
            color: auth.dim,
            textAlign: 'center',
            marginTop: ds.spacing(space[2] - 2),
            marginBottom: ds.spacing(space[6]),
          }}
        >
          {readyLine(locationGroup)}
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Button label="See today's list" onPress={handleEnter} />
        </View>
      </View>
    </AuthScreenShell>
  );
}
