import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, SectionLabel, Sheet } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerSelectionHaptic } from '@/lib/haptics';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import type { SimpleOrderDensity } from '@/types/settings';

interface ChecklistSettingsSheetProps {
  visible: boolean;
  density: SimpleOrderDensity;
  showCategories: boolean;
  onSelectDensity: (density: SimpleOrderDensity) => void;
  onToggleCategories: (show: boolean) => void;
  onClose: () => void;
}

const OPTIONS: readonly {
  value: SimpleOrderDensity;
  label: string;
  detail: string;
}[] = [
  {
    value: 'comfort',
    label: 'Comfortable',
    detail: 'One card per item, biggest targets',
  },
  {
    value: 'compact',
    label: 'Compact',
    detail: 'Grouped rows with the usual amount',
  },
  {
    value: 'dense',
    label: 'Dense',
    detail: 'Tight rows, see the whole list at once',
  },
];

export function ChecklistSettingsSheet({
  visible,
  density,
  showCategories,
  onSelectDensity,
  onToggleCategories,
  onClose,
}: ChecklistSettingsSheetProps) {
  const ds = useScaledStyles();

  const handleSelect = useCallback(
    (value: SimpleOrderDensity) => {
      void triggerSelectionHaptic();
      onSelectDensity(value);
    },
    [onSelectDensity],
  );

  const handleToggle = useCallback(() => {
    void triggerSelectionHaptic();
    onToggleCategories(!showCategories);
  }, [onToggleCategories, showCategories]);

  return (
    <Sheet
      visible={visible}
      title="Checklist display"
      subtitle="How your list is shown."
      onClose={onClose}
      primary={{ label: 'Done', onPress: onClose }}
    >
      <View accessibilityRole="radiogroup" style={{ gap: ds.spacing(10) }}>
        {OPTIONS.map((option) => {
          const selected = option.value === density;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={option.label}
              accessibilityHint={option.detail}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: ds.spacing(11),
                backgroundColor: selected ? color.tint : color.card,
                borderWidth: 1.5,
                borderColor: selected ? color.accent : color.card,
                borderRadius: radius.card,
                paddingHorizontal: ds.spacing(14),
                paddingVertical: ds.spacing(14),
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: radius.pill,
                  borderWidth: selected ? 0 : 2,
                  borderColor: color.hairlineStrong,
                  backgroundColor: selected ? color.accent : color.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected ? (
                  <Ionicons name="checkmark" size={ds.icon(13)} color={color.onAccent} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.body),
                    fontWeight: weight.semibold,
                    color: color.ink,
                  }}
                >
                  {option.label}
                </Text>
                <Text
                  style={{
                    marginTop: ds.spacing(1),
                    fontSize: ds.fontSize(typeScale.secondary),
                    color: color.ink2,
                  }}
                >
                  {option.detail}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View>
        <SectionLabel>Grouping</SectionLabel>
        <Card flush>
          <TouchableOpacity
            onPress={handleToggle}
            activeOpacity={0.8}
            accessibilityRole="switch"
            accessibilityState={{ checked: showCategories }}
            accessibilityLabel="Show categories"
            accessibilityHint="Group items under Fish, Produce, Dry goods"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ds.spacing(11),
              minHeight: ds.spacing(60),
              paddingHorizontal: ds.spacing(14),
              paddingVertical: ds.spacing(10),
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.tile,
                backgroundColor: color.well,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="list-outline" size={ds.icon(18)} color={color.ink2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.body),
                  fontWeight: weight.semibold,
                  color: color.ink,
                }}
              >
                Show categories
              </Text>
              <Text
                style={{
                  marginTop: ds.spacing(2),
                  fontSize: ds.fontSize(typeScale.secondary),
                  color: color.ink2,
                }}
              >
                Group items under Fish, Produce, Dry goods
              </Text>
            </View>
            <View
              style={{
                width: 44,
                height: 26,
                borderRadius: radius.pill,
                backgroundColor: showCategories ? color.accent : color.disabled,
                justifyContent: 'center',
                paddingHorizontal: 3,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: radius.pill,
                  backgroundColor: color.onAccent,
                  transform: [{ translateX: showCategories ? 18 : 0 }],
                }}
              />
            </View>
          </TouchableOpacity>
        </Card>
      </View>
    </Sheet>
  );
}
