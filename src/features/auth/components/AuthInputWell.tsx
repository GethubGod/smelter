import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, motion, radius, size, space, typeScale, weight } from '@/theme/tokens';

interface AuthInputWellProps
  extends Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'editable'> {
  label?: string;
  error?: string | null;
  trailingLabel?: string;
  onTrailingPress?: () => void;
  locked?: boolean;
  flashKey?: number;
  testID?: string;
}

export const AuthInputWell = forwardRef<TextInput, AuthInputWellProps>(
  function AuthInputWell(
    {
      label,
      error,
      trailingLabel,
      onTrailingPress,
      locked = false,
      flashKey = 0,
      testID,
      onFocus,
      onBlur,
      ...inputProps
    },
    forwardedRef,
  ) {
    const ds = useScaledStyles();
    const inputRef = useRef<TextInput>(null);
    const [focused, setFocused] = useState(false);
    const flash = useRef(new Animated.Value(0)).current;
    const focusRing = useRef(new Animated.Value(0)).current;
    const errorReveal = useRef(new Animated.Value(error ? 1 : 0)).current;

    useEffect(() => {
      Animated.timing(focusRing, {
        toValue: focused ? 1 : 0,
        duration: ds.reduceMotion ? 1 : 160,
        easing: Easing.bezier(...motion.ease),
        useNativeDriver: false,
      }).start();
    }, [ds.reduceMotion, focusRing, focused]);

    useImperativeHandle(forwardedRef, () => inputRef.current!);

    useEffect(() => {
      Animated.timing(errorReveal, {
        toValue: error ? 1 : 0,
        duration: ds.reduceMotion ? 1 : motion.dur,
        easing: Easing.bezier(...motion.ease),
        useNativeDriver: false,
      }).start();
    }, [ds.reduceMotion, error, errorReveal]);

    useEffect(() => {
      if (flashKey === 0) return;
      flash.setValue(1);
      Animated.timing(flash, {
        toValue: 0,
        duration: ds.reduceMotion ? 1 : 500,
        easing: Easing.bezier(...motion.ease),
        useNativeDriver: false,
      }).start();
    }, [ds.reduceMotion, flash, flashKey]);

    const backgroundColor = flash.interpolate({
      inputRange: [0, 1],
      outputRange: [auth.well, color.tint],
    });
    const focusBorderColor = focusRing.interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', auth.wellFocus],
    });

    return (
      <View>
        {label ? (
          <Text
            style={{
              marginTop: ds.spacing(space[4]),
              marginBottom: ds.spacing(6),
              fontSize: ds.fontSize(typeScale.secondary),
              fontWeight: weight.regular,
              color: auth.dim,
            }}
          >
            {label}
          </Text>
        ) : null}
        <Animated.View
          style={{
            minHeight: ds.spacing(size.authInput),
            flexDirection: 'row',
            alignItems: 'center',
            gap: ds.spacing(10),
            paddingHorizontal: ds.spacing(14),
            borderRadius: radius.control,
            borderWidth: 1.5,
            borderColor: error ? auth.wellError : focusBorderColor,
            backgroundColor,
          }}
        >
          <TextInput
            {...inputProps}
            ref={inputRef}
            testID={testID}
            editable={!locked}
            placeholderTextColor={auth.faint}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: 0,
              fontSize: ds.fontSize(typeScale.body),
              fontWeight: weight.regular,
              color: auth.text,
              opacity: locked ? 0.72 : 1,
            }}
          />
          {trailingLabel && onTrailingPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={trailingLabel}
              onPress={onTrailingPress}
              hitSlop={5}
              style={({ pressed }) => ({
                paddingVertical: ds.spacing(6),
                paddingHorizontal: ds.spacing(10),
                borderRadius: radius.pill,
                backgroundColor: pressed ? auth.disabled : color.well,
              })}
            >
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.meta),
                  fontWeight: weight.semibold,
                  color: auth.text,
                }}
              >
                {trailingLabel}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
        <Animated.View
          style={{
            maxHeight: errorReveal.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }),
            opacity: errorReveal,
            overflow: 'hidden',
          }}
        >
          <Text
            accessibilityRole="alert"
            style={{
              marginTop: ds.spacing(space[2]),
              marginHorizontal: ds.spacing(2),
              fontSize: ds.fontSize(typeScale.secondary),
              fontWeight: weight.regular,
              lineHeight: ds.fontSize(typeScale.secondary) * 1.4,
              color: auth.wellError,
            }}
          >
            {error ?? ''}
          </Text>
        </Animated.View>
      </View>
    );
  },
);
