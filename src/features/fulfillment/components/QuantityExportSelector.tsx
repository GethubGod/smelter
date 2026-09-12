import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerImpactHaptic, ImpactFeedbackStyle } from '@/lib/haptics';
import { color, radius, typeScale, weight } from '@/theme/tokens';

type UnitType = 'base' | 'pack';

interface QuantityExportSelectorProps {
  exportUnitType: UnitType;
  baseUnitLabel: string;
  packUnitLabel: string;
  canSwitchUnit: boolean;
  onUnitChange: (unit: UnitType) => void;
}
/** Small unit control that keeps export-unit overrides available in compact rows. */
export function QuantityExportSelector({
  exportUnitType,
  baseUnitLabel,
  packUnitLabel,
  canSwitchUnit,
  onUnitChange,
}: QuantityExportSelectorProps) {
  const ds = useScaledStyles();
  const label = exportUnitType === 'base' ? baseUnitLabel : packUnitLabel;

  const handlePress = () => {
    if (!canSwitchUnit) return;
    void triggerImpactHaptic(ImpactFeedbackStyle.Light);
    onUnitChange(exportUnitType === 'base' ? 'pack' : 'base');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!canSwitchUnit}
      accessibilityRole="button"
      accessibilityLabel={`Export ${label}; ${
        canSwitchUnit ? 'tap to change unit' : 'only available unit'
      }`}
      accessibilityState={{ disabled: !canSwitchUnit }}
      activeOpacity={0.75}
      style={{
        minHeight: ds.spacing(22),
        paddingHorizontal: ds.spacing(7),
        borderRadius: radius.pill,
        backgroundColor: color.well,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: canSwitchUnit ? 1 : 0.7,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: ds.fontSize(typeScale.meta),
          fontWeight: weight.semibold,
          color: canSwitchUnit ? color.ink2 : color.ink3,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
