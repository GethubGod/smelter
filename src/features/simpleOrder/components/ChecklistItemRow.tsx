import React, { memo, useCallback, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
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
  rowMinHeight?: number;
  glyphSize: number;
  stepperGap: number;
  metaGap: number;
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
    glyphSize: 18,
    stepperGap: 4,
    metaGap: 2,
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
    glyphSize: 16,
    stepperGap: 4,
    metaGap: 1,
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
    glyphSize: 14,
    stepperGap: 2,
    metaGap: 0,
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
const controlEasing = Easing.bezier(...motion.controlEase);
const popEasing = Easing.bezier(...motion.pop);

function ScalePressable({
  accessibilityLabel,
  children,
  onPress,
  size,
  checkedProgress,
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
  onPress: () => void;
  size: number;
  checkedProgress: SharedValue<number>;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(checkedProgress.value, [0, 1], [color.well, color.ink]),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.9, { duration: 90, easing: controlEasing });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 90, easing: controlEasing });
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
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
  const controlProgress = useSharedValue(line.checked ? 1 : 0);
  const checkProgress = useSharedValue(line.checked ? 1 : 0);
  const checkboxPressScale = useSharedValue(1);
  const entryProgress = useSharedValue(isNew ? 0 : 1);

  useEffect(() => {
    checkedProgress.value = withTiming(line.checked ? 1 : 0, {
      duration: motion.dur,
      easing: glideEasing,
    });
    controlProgress.value = withTiming(line.checked ? 1 : 0, {
      duration: motion.dur,
      easing: controlEasing,
    });
    checkProgress.value = withTiming(line.checked ? 1 : 0, {
      duration: 320,
      easing: popEasing,
    });
  }, [checkProgress, checkedProgress, controlProgress, line.checked]);

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
    transform: [{ scale: checkProgress.value }],
  }));
  const quantityStyle = useAnimatedStyle(() => ({
    color: interpolateColor(controlProgress.value, [0, 1], [color.ink3, color.ink]),
  }));
  const glyphStyle = useAnimatedStyle(() => ({ opacity: controlProgress.value }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: checkedProgress.value }));
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
  const groupTopPadding = !comfortable && isFirst ? 2 : 0;
  const groupBottomPadding = !comfortable && isLast ? 2 : 0;
  const checkboxSize = Math.max(
    metrics.checkboxSize,
    ds.icon(metrics.checkboxSize),
  );
  const stepperSize = Math.max(
    metrics.stepperButtonSize,
    ds.icon(metrics.stepperButtonSize),
  );

  return (
    <Animated.View
      style={[
        {
          minHeight: metrics.rowMinHeight === undefined
            ? undefined
            : metrics.rowMinHeight + groupTopPadding + groupBottomPadding,
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(12),
          paddingHorizontal: ds.spacing(12),
          paddingTop: ds.spacing(metrics.verticalPadding + groupTopPadding),
          paddingBottom: ds.spacing(metrics.verticalPadding + groupBottomPadding),
          marginTop: comfortable ? ds.spacing(8) : isFirst ? ds.spacing(4) : undefined,
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
            easing: controlEasing,
          });
        }}
        onPressOut={() => {
          checkboxPressScale.value = withTiming(1, {
            duration: 120,
            easing: controlEasing,
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
          <Svg width={ds.icon(metrics.glyphSize)} height={ds.icon(metrics.glyphSize)} viewBox="0 0 24 24" fill="none" stroke={color.onAccent} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 12l5 5L20 7" />
          </Svg>
        </Animated.View>
      </AnimatedPressable>

      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`Toggle ${line.itemName}`}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: metrics.rowMinHeight === undefined
            ? undefined
            : metrics.rowMinHeight - metrics.verticalPadding * 2,
          justifyContent: 'center',
        }}
      >
        <View style={{ minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: ds.fontSize(metrics.nameFontSize),
              lineHeight: ds.fontSize(metrics.nameFontSize) * 1.25,
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
                marginTop: ds.spacing(metrics.metaGap),
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
          gap: ds.spacing(metrics.stepperGap),
        }}
      >
        <ScalePressable
          accessibilityLabel={`Decrease ${line.itemName} quantity`}
          onPress={handleDecrement}
          size={stepperSize}
          checkedProgress={controlProgress}
        >
          <View>
            <Svg width={ds.icon(metrics.glyphSize)} height={ds.icon(metrics.glyphSize)} viewBox="0 0 24 24" fill="none" stroke={color.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M5 12h14" />
            </Svg>
            <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, glyphStyle]}>
              <Svg width={ds.icon(metrics.glyphSize)} height={ds.icon(metrics.glyphSize)} viewBox="0 0 24 24" fill="none" stroke={color.onAccent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 12h14" />
              </Svg>
            </Animated.View>
          </View>
        </ScalePressable>

        <Pressable
          onPress={handleOpenQuantity}
          accessibilityRole="button"
          accessibilityLabel={`Set ${line.itemName} quantity, now ${formatQuantity(line.quantity)} ${line.unit}`}
          style={{
            minWidth: ds.spacing(metrics.quantityMinWidth),
            minHeight: stepperSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.Text
            style={[{
              fontSize: ds.fontSize(metrics.quantityFontSize),
              fontWeight: weight.bold,
              fontVariant: ['tabular-nums'],
              textAlign: 'center',
            }, quantityStyle]}
          >
            {formatQuantity(line.quantity)}
          </Animated.Text>
        </Pressable>

        <ScalePressable
          accessibilityLabel={`Increase ${line.itemName} quantity`}
          onPress={handleIncrement}
          size={stepperSize}
          checkedProgress={controlProgress}
        >
          <View>
            <Svg width={ds.icon(metrics.glyphSize)} height={ds.icon(metrics.glyphSize)} viewBox="0 0 24 24" fill="none" stroke={color.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
            <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, glyphStyle]}>
              <Svg width={ds.icon(metrics.glyphSize)} height={ds.icon(metrics.glyphSize)} viewBox="0 0 24 24" fill="none" stroke={color.onAccent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 5v14M5 12h14" />
              </Svg>
            </Animated.View>
          </View>
        </ScalePressable>
      </View>

      {!comfortable && !isLast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ds.spacing(12 + metrics.separatorInset),
            right: ds.spacing(12),
            bottom: 0,
            height: 1,
            backgroundColor: color.hairline,
          }}
        />
      ) : null}
      {comfortable ? (
        <Animated.View
          pointerEvents="none"
          style={[{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderWidth: 1.5,
            borderColor: color.accent,
            borderRadius: radius.card,
          }, ringStyle]}
        />
      ) : null}
    </Animated.View>
  );
});
