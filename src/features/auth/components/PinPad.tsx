import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerImpactHaptic, ImpactFeedbackStyle } from '@/lib/haptics';
import { auth, color, radius, size, space, typeScale, weight } from '@/theme/tokens';
import { PIN_LENGTH } from '@/services/loginCredentials';

interface PinDotsProps {
  filled: number;
  error?: boolean;
}

/** Four entry dots; filled ones turn accent. */
export function PinDots({ filled, error = false }: PinDotsProps) {
  const ds = useScaledStyles();
  const dot = ds.spacing(space[3] + 2);

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: ds.spacing(space[4] - 2),
        marginVertical: ds.spacing(space[5] - 2),
      }}
    >
      {Array.from({ length: PIN_LENGTH }, (_, index) => {
        const on = index < filled;
        return (
          <View
            key={index}
            style={{
              width: dot,
              height: dot,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: on ? color.accent : auth.wellBorder,
              backgroundColor: on ? color.accent : auth.well,
              opacity: error ? 0.55 : 1,
            }}
          />
        );
      })}
    </View>
  );
}

interface PinPadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const PAD_ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'backspace'],
];

/** Four-digit pad: digit wells, backspace, haptic ticks. */
export function PinPad({ onDigit, onBackspace, disabled = false }: PinPadProps) {
  const ds = useScaledStyles();
  const key = Math.max(size.touchMin, ds.spacing(size.button));

  const handlePress = (pressed: string) => {
    triggerImpactHaptic(ImpactFeedbackStyle.Light);
    if (pressed === 'backspace') {
      onBackspace();
    } else {
      onDigit(pressed);
    }
  };

  return (
    <View style={{ gap: ds.spacing(space[3] - 2) }}>
      {PAD_ROWS.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={{ flexDirection: 'row', gap: ds.spacing(space[3] - 2) }}
        >
          {row.map((padKey, keyIndex) =>
            padKey === '' ? (
              <View key={keyIndex} style={{ flex: 1 }} />
            ) : (
              <TouchableOpacity
                key={keyIndex}
                onPress={() => handlePress(padKey)}
                disabled={disabled}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={padKey === 'backspace' ? 'Delete digit' : `Digit ${padKey}`}
                style={{
                  flex: 1,
                  height: key,
                  borderRadius: radius.control,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: padKey === 'backspace' ? 'transparent' : auth.well,
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {padKey === 'backspace' ? (
                  <Ionicons
                    name="backspace-outline"
                    size={ds.icon(size.icon)}
                    color={auth.dim}
                  />
                ) : (
                  <Text
                    style={{
                      fontSize: ds.fontSize(typeScale.title),
                      fontWeight: weight.bold,
                      color: auth.text,
                    }}
                  >
                    {padKey}
                  </Text>
                )}
              </TouchableOpacity>
            ),
          )}
        </View>
      ))}
    </View>
  );
}
