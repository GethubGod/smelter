import { useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { AuthLoadingScreen } from '@/components';
import { useAuthScreenGuard } from '@/hooks';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, motion, radius, space, tracking, typeScale, weight } from '@/theme/tokens';
import { AuthScreenShell } from './components/AuthScreenShell';
import { SignInSheet } from './components/SignInSheet';
import { openAuthBrowser, SIGNUP_URL } from './legal';

interface WelcomeOptionProps {
  title: string;
  subtitle: string;
  icon: 'chevron-forward' | 'arrow-up-right';
  onPress: () => void;
}

function WelcomeOption({ title, subtitle, icon, onPress }: WelcomeOptionProps) {
  const ds = useScaledStyles();
  const press = useRef(new Animated.Value(0)).current;

  const animate = (toValue: number) => {
    Animated.timing(press, {
      toValue,
      duration: ds.reduceMotion ? 1 : 90,
      easing: Easing.bezier(...motion.ease),
      useNativeDriver: false,
    }).start();
  };

  return (
    <Animated.View
      style={{
        borderRadius: radius.card,
        backgroundColor: press.interpolate({
          inputRange: [0, 1],
          outputRange: [auth.well, color.cardPressed],
        }),
        transform: [
          {
            scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }),
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={subtitle}
        onPress={onPress}
        onPressIn={() => animate(1)}
        onPressOut={() => animate(0)}
        style={{
          minHeight: ds.spacing(78),
          paddingVertical: ds.spacing(space[4]),
          paddingLeft: ds.spacing(18),
          paddingRight: ds.spacing(space[4]),
          borderRadius: radius.card,
          backgroundColor: 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(14),
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.option),
              fontWeight: weight.bold,
              color: auth.text,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              marginTop: ds.spacing(2),
              fontSize: ds.fontSize(typeScale.secondary),
              fontWeight: weight.regular,
              color: auth.dim,
            }}
          >
            {subtitle}
          </Text>
        </View>
        <View
          style={{
            width: ds.spacing(28),
            height: ds.spacing(28),
            borderRadius: radius.pill,
            backgroundColor: color.well,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={icon === 'arrow-up-right' ? 'arrow-forward' : icon}
            size={ds.icon(typeScale.body)}
            color={auth.text}
            // The reference's leaves-the-app glyph points up and right.
            style={icon === 'arrow-up-right' ? { transform: [{ rotate: '-45deg' }] } : undefined}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const ds = useScaledStyles();
  const guard = useAuthScreenGuard();
  const [signInVisible, setSignInVisible] = useState(false);

  if (guard.isChecking) return <AuthLoadingScreen onDark />;
  if (guard.authenticatedRedirectTo) return <Redirect href={guard.authenticatedRedirectTo} />;

  return (
    <>
      <AuthScreenShell dismissKeyboardOnPress={false}>
        <View style={{ alignItems: 'center', marginTop: ds.spacing(22) }}>
          <Image
            source={require('../../../assets/images/smelter-lockup.png')}
            resizeMode="contain"
            style={{
              width: ds.spacing(112),
              height: ds.spacing(112 * (257 / 1198)),
            }}
          />
        </View>

        <View style={{ flex: 1 }} />

        <Text
          accessibilityRole="header"
          style={{
            marginBottom: ds.spacing(22),
            fontSize: ds.fontSize(typeScale.display),
            fontWeight: weight.bold,
            letterSpacing: tracking.display,
            color: auth.text,
          }}
        >
          Welcome
        </Text>

        <View style={{ gap: ds.spacing(10) }}>
          <WelcomeOption
            title="I was invited"
            subtitle="Paste the link your manager sent"
            icon="chevron-forward"
            onPress={() => router.push('/(auth)/invite-link')}
          />
          <WelcomeOption
            title="I have an account"
            subtitle="Google, Apple, or email"
            icon="chevron-forward"
            onPress={() => setSignInVisible(true)}
          />
          <WelcomeOption
            title="I'm setting up a restaurant"
            subtitle="Create your account on smelterpos.com"
            icon="arrow-up-right"
            onPress={() => void openAuthBrowser(SIGNUP_URL)}
          />
        </View>
      </AuthScreenShell>

      <SignInSheet
        visible={signInVisible}
        onClose={() => setSignInVisible(false)}
        onComplete={() => {
          router.replace('/(auth)/ready');
        }}
      />
    </>
  );
}
