import React, { memo, useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerImpactHaptic, triggerSelectionHaptic } from '@/lib/haptics';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import type { SimpleOrderDensity } from '@/types/settings';
import { formatQuantity, type SelectionLine } from '../checklistSelection';

/**
 * Checklist row, tips colorway. Row tap toggles checked; the stepper's −/+
 * adjust; tapping the middle (quantity) opens the quantity card. Compact rows
 * are single-line with a WIDE stepper middle showing quantity + unit side by
 * side (`− 2 fillet +`) — the middle tap target stays ≥ 56pt wide.
 */

interface ChecklistItemRowProps {
  line: SelectionLine;
  isLast: boolean;
  density: SimpleOrderDensity;
  onToggle: (key: string) => void;
  onAdjustQuantity: (key: string, delta: number) => void;
  onOpenQuantityCard: (key: string) => void;
}

interface DensityMetrics {
  rowMinHeight: number;
  checkboxSize: number;
  stepperButtonSize: number;
  nameFontSize: number;
  quantityFontSize: number;
  verticalPadding: number;
  showSubtitle: boolean;
  midMinWidth: number;
}

const DENSITY_METRICS: Record<SimpleOrderDensity, DensityMetrics> = {
  comfort: {
    rowMinHeight: 58,
    checkboxSize: 26,
    stepperButtonSize: 38,
    nameFontSize: typeScale.body,
    quantityFontSize: typeScale.body,
    verticalPadding: 8,
    showSubtitle: true,
    midMinWidth: 34,
  },
  dense: {
    rowMinHeight: 40,
    checkboxSize: 21,
    stepperButtonSize: 28,
    nameFontSize: typeScale.secondary,
    quantityFontSize: typeScale.secondary,
    verticalPadding: 3,
    showSubtitle: false,
    midMinWidth: 56,
  },
};

export const ChecklistItemRow = memo(function ChecklistItemRow({
  line,
  isLast,
  density,
  onToggle,
  onAdjustQuantity,
  onOpenQuantityCard,
}: ChecklistItemRowProps) {
  const ds = useScaledStyles();
  const metrics = DENSITY_METRICS[density];

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

  const checkboxSize = Math.max(metrics.checkboxSize, ds.icon(metrics.checkboxSize));
  const stepperSize = Math.max(metrics.stepperButtonSize, ds.icon(metrics.stepperButtonSize));

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(density === 'dense' ? 8 : 12),
        minHeight: Math.max(metrics.rowMinHeight, density === 'dense' ? 0 : ds.rowH),
        paddingVertical: ds.spacing(metrics.verticalPadding),
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: color.hairline,
      }}
    >
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: line.checked }}
        accessibilityLabel={`${line.itemName}, ${line.checked ? 'selected' : 'not selected'}`}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(density === 'dense' ? 8 : 12),
          minHeight: metrics.rowMinHeight,
        }}
      >
        <View
          style={{
            width: checkboxSize,
            height: checkboxSize,
            borderRadius: radius.pill,
            borderWidth: line.checked ? 0 : 1.5,
            borderColor: color.disabled,
            backgroundColor: line.checked ? color.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {line.checked ? (
            <Ionicons
              name="checkmark"
              size={Math.round(checkboxSize * 0.55)}
              color={color.onAccent}
            />
          ) : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: ds.fontSize(metrics.nameFontSize),
              fontWeight: weight.semibold,
              color: line.checked ? color.ink : color.ink2,
            }}
          >
            {line.itemName}
          </Text>
          {metrics.showSubtitle ? (
            <Text style={{ marginTop: 1, fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}>
              {line.unit}
              {line.recommendedQty !== null
                ? ` · usually ${formatQuantity(line.recommendedQty)}`
                : ''}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: color.card,
          borderWidth: 1,
          borderColor: color.hairlineStrong,
          borderRadius: radius.pill,
          opacity: line.checked ? 1 : 0.45,
        }}
      >
        <TouchableOpacity
          onPress={handleDecrement}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${line.itemName} quantity`}
          style={{
            width: stepperSize,
            height: stepperSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="remove"
            size={ds.icon(density === 'dense' ? 15 : 17)}
            color={color.ink}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleOpenQuantity}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`Set ${line.itemName} quantity, now ${formatQuantity(line.quantity)} ${line.unit}`}
          style={{
            minWidth: ds.spacing(metrics.midMinWidth),
            minHeight: stepperSize,
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: density === 'dense' ? 4 : 0,
            paddingHorizontal: ds.spacing(4),
            paddingVertical: ds.spacing(density === 'dense' ? 5 : 6),
          }}
        >
          <Text
            style={{
              fontSize: ds.fontSize(metrics.quantityFontSize),
              fontWeight: '700',
              color: color.ink,
              textAlign: 'center',
            }}
          >
            {formatQuantity(line.quantity)}
          </Text>
          {density === 'dense' ? (
            <Text
              numberOfLines={1}
              style={{
                maxWidth: ds.spacing(52),
                fontSize: ds.fontSize(typeScale.caption),
                color: color.ink3,
              }}
            >
              {line.unit}
            </Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleIncrement}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${line.itemName} quantity`}
          style={{
            width: stepperSize,
            height: stepperSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="add"
            size={ds.icon(density === 'dense' ? 15 : 17)}
            color={color.accent}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});
