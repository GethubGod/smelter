import { useRef } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, motion, radius, size } from '@/theme/tokens';

interface AuthCloseButtonProps {
  onPress: () => void;
  label?: string;
}

export function AuthCloseButton({ onPress, label = 'Close' }: AuthCloseButtonProps) {
  const ds = useScaledStyles();
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: ds.reduceMotion ? 1 : 90,
      easing: Easing.bezier(...motion.ease),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={7}
        onPress={onPress}
        onPressIn={() => animate(0.92)}
        onPressOut={() => animate(1)}
        style={{
          width: ds.spacing(size.authClose),
          height: ds.spacing(size.authClose),
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: auth.well,
        }}
      >
        <Ionicons name="close" size={ds.icon(14)} color={auth.text} />
      </Pressable>
    </Animated.View>
  );
}
