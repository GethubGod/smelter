import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, motion, radius, space, typeScale, weight } from '@/theme/tokens';

interface WizardProgressProps {
  step: 1 | 2 | 3;
  startsAt?: 0 | 1 | 2;
}

export function WizardProgress({ step, startsAt = Math.max(0, step - 1) as 0 | 1 | 2 }: WizardProgressProps) {
  const ds = useScaledStyles();
  const fill = useRef(new Animated.Value(startsAt / 3)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: step / 3,
      duration: ds.reduceMotion ? 1 : 420,
      easing: Easing.bezier(...motion.ease),
      useNativeDriver: false,
    }).start();
  }, [ds.reduceMotion, fill, step]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(10),
        marginBottom: ds.spacing(22),
      }}
    >
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.meta),
          fontWeight: weight.semibold,
          color: auth.dim,
        }}
      >
        Step {step} of 3
      </Text>
      <View
        style={{
          flex: 1,
          height: ds.spacing(space[1]),
          borderRadius: radius.pill,
          overflow: 'hidden',
          backgroundColor: color.well,
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            width: fill.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
            borderRadius: radius.pill,
            backgroundColor: auth.accent,
          }}
        />
      </View>
    </View>
  );
}
