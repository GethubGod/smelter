import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, motion, radius, size, typeScale, weight } from '@/theme/tokens';

interface AuthToastProps {
  message: string | null;
  onHidden?: () => void;
}

export function AuthToast({ message, onHidden }: AuthToastProps) {
  const ds = useScaledStyles();
  const [renderedMessage, setRenderedMessage] = useState<string | null>(message);
  const progress = useRef(new Animated.Value(0)).current;
  const onHiddenRef = useRef(onHidden);

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  useEffect(() => {
    if (!message) return;
    setRenderedMessage(message);
    progress.setValue(0);

    const sequence = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: ds.reduceMotion ? 1 : 220,
        easing: Easing.bezier(...motion.ease),
        useNativeDriver: true,
      }),
      Animated.delay(ds.reduceMotion ? 1 : 1_800),
      Animated.timing(progress, {
        toValue: 0,
        duration: ds.reduceMotion ? 1 : 220,
        easing: Easing.bezier(...motion.ease),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => {
      if (!finished) return;
      setRenderedMessage(null);
      onHiddenRef.current?.();
    });

    return () => sequence.stop();
  }, [ds.reduceMotion, message, progress]);

  if (!renderedMessage) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: 0,
        bottom: ds.spacing(size.authToastBottom),
        left: 0,
        alignItems: 'center',
      }}
    >
      <Animated.View
        style={{
          maxWidth: '88%',
          paddingVertical: ds.spacing(11),
          paddingHorizontal: ds.spacing(16),
          borderRadius: radius.control,
          backgroundColor: auth.text,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
            },
          ],
        }}
      >
        <Text
          accessibilityLiveRegion="polite"
          style={{
            fontSize: ds.fontSize(typeScale.secondary),
            fontWeight: weight.semibold,
            color: auth.well,
            textAlign: 'center',
          }}
        >
          {renderedMessage}
        </Text>
      </Animated.View>
    </View>
  );
}
