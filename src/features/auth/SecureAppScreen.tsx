// Screen 04 — Secure your app. Two option rows: restaurant PIN (primary)
// and create-a-password (secondary). Both ship (confirmed decision).
//
// The contract's Card and ListRow are light-surface only, so these rows are
// composed from the auth tokens here. See the PR body for the gap note.

import { Text, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PinDigitsIcon } from '@/components/icons/PinDigitsIcon';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from './components/AuthScreenShell';
import { StepProgress } from './components/StepProgress';
import { useOnboardingStore } from './onboardingStore';

interface OptionRowProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  highlighted?: boolean;
  onPress: () => void;
}

function OptionRow({ title, subtitle, icon, highlighted = false, onPress }: OptionRowProps) {
  const ds = useScaledStyles();
  const tile = Math.max(size.headerCircle, ds.icon(size.headerCircle));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(space[3]),
        backgroundColor: auth.well,
        borderWidth: 1,
        borderColor: highlighted ? color.accent : auth.wellBorder,
        borderRadius: radius.card,
        padding: ds.spacing(space[4]),
        marginBottom: ds.spacing(space[3] - 2),
      }}
    >
      <View
        style={{
          width: tile,
          height: tile,
          borderRadius: radius.control,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: highlighted ? color.tint : auth.well,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.body),
            fontWeight: weight.semibold,
            color: auth.text,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.secondary),
            color: auth.dim,
            marginTop: ds.spacing(space[1] / 2),
          }}
        >
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={ds.icon(size.icon)} color={auth.dim} />
    </TouchableOpacity>
  );
}

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

      <OptionRow
        title="Use your restaurant PIN"
        subtitle="The same 4-digit code you use at the register"
        icon={<PinDigitsIcon size={ds.icon(size.icon)} color={color.accent} />}
        highlighted
        onPress={() => router.push('/(auth)/secure-pin' as Parameters<typeof router.push>[0])}
      />
      <OptionRow
        title="Create a password"
        subtitle="Saves to iPhone autofill so you never retype it"
        icon={<Ionicons name="lock-closed-outline" size={ds.icon(size.icon)} color={auth.text} />}
        onPress={() => router.push('/(auth)/secure-password' as Parameters<typeof router.push>[0])}
      />
      <View style={{ flex: 1 }} />
    </AuthScreenShell>
  );
}
