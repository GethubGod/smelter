import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, motion, radius, space, typeScale, weight } from '@/theme/tokens';

export const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  '12345678',
  '123456789',
  'qwerty123',
  'iloveyou',
  'sushi1234',
  'letmein1',
]);

export function getPasswordRequirements(password: string) {
  return {
    length: password.length >= 8,
    mixed: /[A-Za-z]/.test(password) && /\d/.test(password),
    uncommon: password.length > 0 && !COMMON_PASSWORDS.has(password.toLowerCase()),
  };
}

function RequirementRow({ met, children }: { met: boolean; children: string }) {
  const ds = useScaledStyles();
  const fill = useRef(new Animated.Value(met ? 1 : 0)).current;
  const checkScale = useRef(new Animated.Value(met ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fill, {
        toValue: met ? 1 : 0,
        duration: ds.reduceMotion ? 1 : motion.dur,
        easing: Easing.bezier(...motion.ease),
        useNativeDriver: true,
      }),
      Animated.timing(checkScale, {
        toValue: met ? 1 : 0,
        duration: ds.reduceMotion ? 1 : met ? 320 : motion.dur,
        easing: met ? Easing.bezier(...motion.pop) : Easing.bezier(...motion.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [checkScale, ds.reduceMotion, fill, met]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(9),
        paddingVertical: ds.spacing(space[1]),
      }}
    >
      <View
        style={{
          width: ds.spacing(18),
          height: ds.spacing(18),
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderColor: met ? color.good : auth.faint,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: color.good,
            opacity: fill,
          }}
        />
        <Animated.View style={{ transform: [{ scale: checkScale }] }}>
          <Ionicons name="checkmark" size={ds.icon(11)} color={color.onAccent} />
        </Animated.View>
      </View>
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.secondary),
          fontWeight: weight.regular,
          color: met ? auth.text : auth.dim,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function PasswordRequirements({ password }: { password: string }) {
  const ds = useScaledStyles();
  const requirements = getPasswordRequirements(password);

  return (
    <View style={{ marginTop: ds.spacing(space[3]) }}>
      <RequirementRow met={requirements.length}>At least 8 characters</RequirementRow>
      <RequirementRow met={requirements.mixed}>A letter and a number</RequirementRow>
      <RequirementRow met={requirements.uncommon}>Not a common password</RequirementRow>
    </View>
  );
}
