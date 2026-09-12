import React, { memo, useCallback, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerImpactHaptic, triggerSelectionHaptic } from '@/lib/haptics';
import { color, motion, radius, typeScale, weight } from '@/theme/tokens';
import type { SimpleOrderDensity } from '@/types/settings';
import { formatQuantity, type SelectionLine } from '../checklistSelection';

interface ChecklistItemRowProps {
  line: SelectionLine;
  isFirst: boolean;
  isLast: boolean;
  isNew?: boolean;
  density: SimpleOrderDensity;
  onToggle: (key: string) => void;
  onAdjustQuantity: (key: string, delta: number) => void;
  onOpenQuantityCard: (key: string) => void;
}

interface DensityMetrics {
  rowMinHeight: number;
  checkboxSize: number;
  checkboxRadius: number;
  stepperButtonSize: number;
  nameFontSize: number;
  metaFontSize: number;
  quantityFontSize: number;
  quantityMinWidth: number;
  verticalPadding: number;
  separatorInset: number;
  showMeta: boolean;
}

const DENSITY_METRICS: Record<SimpleOrderDensity, DensityMetrics> = {
  comfort: {
    rowMinHeight: 60,
    checkboxSize: 36,
    checkboxRadius: radius.checkComfort,
    stepperButtonSize: 34,
    nameFontSize: typeScale.itemComfort,
    metaFontSize: typeScale.secondary,
    quantityFontSize: typeScale.quantityComfort,
    quantityMinWidth: 40,
    verticalPadding: 12,
    separatorInset: 44,
    showMeta: true,
  },
  compact: {
    rowMinHeight: 50,
    checkboxSize: 30,
    checkboxRadius: radius.checkCompact,
    stepperButtonSize: 30,
    nameFontSize: typeScale.body,
    metaFontSize: typeScale.meta,
    quantityFontSize: typeScale.itemComfort,
    quantityMinWidth: 36,
    verticalPadding: 8,
    separatorInset: 44,
    showMeta: true,
  },
  dense: {
    rowMinHeight: 40,
    checkboxSize: 26,
    checkboxRadius: radius.checkDense,
    stepperButtonSize: 26,
    nameFontSize: typeScale.itemDense,
    metaFontSize: typeScale.meta,
    quantityFontSize: typeScale.itemDense,
    quantityMinWidth: 32,
    verticalPadding: 4,
    separatorInset: 38,
    showMeta: false,
  },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const glideEasing = Easing.bezier(...motion.ease);
const popEasing = Easing.bezier(...motion.pop);

function ScalePressable({
  accessibilityLabel,
  children,
  onPress,
  size,
  backgroundColor,
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
  onPress: () => void;
  size: number;
  backgroundColor: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.9, { duration: 120, easing: glideEasing });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120, easing: glideEasing });
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animatedStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

export const ChecklistItemRow = memo(function ChecklistItemRow({
  line,
  isFirst,
  isLast,
  isNew = false,
  density,
  onToggle,
  onAdjustQuantity,
  onOpenQuantityCard,
}: ChecklistItemRowProps) {
  const ds = useScaledStyles();
  const metrics = DENSITY_METRICS[density];
  const checkedProgress = useSharedValue(line.checked ? 1 : 0);
  const checkboxPressScale = useSharedValue(1);
  const entryProgress = useSharedValue(isNew ? 0 : 1);

  useEffect(() => {
    checkedProgress.value = withTiming(line.checked ? 1 : 0, {
      duration: line.checked ? 320 : motion.dur,
      easing: line.checked ? popEasing : glideEasing,
    });
  }, [checkedProgress, line.checked]);

  useEffect(() => {
    if (!isNew) return;
    entryProgress.value = 0;
    entryProgress.value = withTiming(1, {
      duration: 380,
      easing: glideEasing,
    });
  }, [entryProgress, isNew]);

  const checkboxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      checkedProgress.value,
      [0, 1],
      [color.well, color.accent],
    ),
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkedProgress.value,
    transform: [{ scale: checkedProgress.value }],
  }));
  const checkboxPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkboxPressScale.value }],
  }));
  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryProgress.value,
    transform: [{ translateY: -6 * (1 - entryProgress.value) }],
  }));

  const handleToggle = useCallback(() => {
    void triggerSelectionHaptic();
    onToggle(line.key);
  }, [line.key, onToggle]);

  const handleDecrement = useCallback(() => {
    void triggerImpactHaptic();
    onAdjustQuantity(line.key, -1);
  }, [line.key, onAdjustQuantity]);

  const handleIncrement = useCallback(() => {
    void triggerImpactHaptic();
    onAdjustQuantity(line.key, 1);
  }, [line.key, onAdjustQuantity]);

  const handleOpenQuantity = useCallback(() => {
    void triggerSelectionHaptic();
    onOpenQuantityCard(line.key);
  }, [line.key, onOpenQuantityCard]);

  const comfortable = density === 'comfort';
  const checkboxSize = Math.max(
    metrics.checkboxSize,
    ds.icon(metrics.checkboxSize),
  );
  const stepperSize = Math.max(
    metrics.stepperButtonSize,
    ds.icon(metrics.stepperButtonSize),
  );
  const stepperBackground = line.checked ? color.ink : color.well;
  const stepperGlyph = line.checked ? color.onAccent : color.ink;

  return (
    <Animated.View
      style={[
        {
          minHeight: metrics.rowMinHeight,
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(12),
          paddingHorizontal: ds.spacing(12),
          paddingVertical: ds.spacing(metrics.verticalPadding),
          marginBottom: comfortable ? ds.spacing(8) : undefined,
          backgroundColor: color.card,
          borderTopLeftRadius: comfortable || isFirst ? radius.card : undefined,
          borderTopRightRadius: comfortable || isFirst ? radius.card : undefined,
          borderBottomLeftRadius: comfortable || isLast ? radius.card : undefined,
          borderBottomRightRadius: comfortable || isLast ? radius.card : undefined,
          overflow: 'hidden',
        },
        entryStyle,
      ]}
    >
      <AnimatedPressable
        onPress={handleToggle}
        onPressIn={() => {
          checkboxPressScale.value = withTiming(0.9, {
            duration: 120,
            easing: glideEasing,
          });
        }}
        onPressOut={() => {
          checkboxPressScale.value = withTiming(1, {
            duration: 120,
            easing: glideEasing,
          });
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: line.checked }}
        accessibilityLabel={`${line.itemName}, ${line.checked ? 'selected' : 'not selected'}`}
        style={[
          {
            width: checkboxSize,
            height: checkboxSize,
            borderRadius: metrics.checkboxRadius,
            alignItems: 'center',
            justifyContent: 'center',
          },
          checkboxStyle,
          checkboxPressStyle,
        ]}
      >
        <Animated.View style={checkStyle}>
          <Ionicons
            name="checkmark"
            size={Math.round(checkboxSize * 0.6)}
            color={color.onAccent}
          />
        </Animated.View>
      </AnimatedPressable>

      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`Toggle ${line.itemName}`}
        style={({ pressed }) => ({
          flex: 1,
          minWidth: 0,
          minHeight: metrics.rowMinHeight - metrics.verticalPadding * 2,
          justifyContent: 'center',
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: ds.fontSize(metrics.nameFontSize),
              fontWeight: weight.semibold,
              color: color.ink,
            }}
          >
            {line.itemName}
          </Text>
          {metrics.showMeta ? (
            <Text
              numberOfLines={1}
              style={{
                marginTop: ds.spacing(1),
                fontSize: ds.fontSize(metrics.metaFontSize),
                color: color.ink3,
              }}
            >
              {line.unit}
              {line.recommendedQty !== null
                ? ` · usually ${formatQuantity(line.recommendedQty)}`
                : ''}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(4),
        }}
      >
        <ScalePressable
          accessibilityLabel={`Decrease ${line.itemName} quantity`}
          onPress={handleDecrement}
          size={stepperSize}
          backgroundColor={stepperBackground}
        >
          <Ionicons
            name="remove"
            size={ds.icon(density === 'dense' ? 14 : 16)}
            color={stepperGlyph}
          />
        </ScalePressable>

        <Pressable
          onPress={handleOpenQuantity}
          accessibilityRole="button"
          accessibilityLabel={`Set ${line.itemName} quantity, now ${formatQuantity(line.quantity)} ${line.unit}`}
          style={({ pressed }) => ({
            minWidth: ds.spacing(metrics.quantityMinWidth),
            minHeight: stepperSize,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text
            style={{
              fontSize: ds.fontSize(metrics.quantityFontSize),
              fontWeight: weight.bold,
              color: line.checked ? color.ink : color.ink3,
              fontVariant: ['tabular-nums'],
              textAlign: 'center',
            }}
          >
            {formatQuantity(line.quantity)}
          </Text>
        </Pressable>

        <ScalePressable
          accessibilityLabel={`Increase ${line.itemName} quantity`}
          onPress={handleIncrement}
          size={stepperSize}
          backgroundColor={stepperBackground}
        >
          <Ionicons
            name="add"
            size={ds.icon(density === 'dense' ? 14 : 16)}
            color={stepperGlyph}
          />
        </ScalePressable>
      </View>

      {!comfortable && !isLast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ds.spacing(metrics.separatorInset),
            right: ds.spacing(12),
            bottom: 0,
            height: 1,
            backgroundColor: color.hairline,
          }}
        />
      ) : null}
      {comfortable && line.checked ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderWidth: 1.5,
            borderColor: color.accent,
            borderRadius: radius.card,
          }}
        />
      ) : null}
    </Animated.View>
  );
});
