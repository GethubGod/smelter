import React, { memo, useCallback } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { Card, ListRow, Sheet } from '@/components/ui';
import { color, radius, space, typeScale, weight } from '@/theme/tokens';
import type { StorageAreaFilterOption } from './StorageAreaFilterBar';

interface StationPickerBottomSheetProps {
  visible: boolean;
  options: StorageAreaFilterOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

interface StationRowProps {
  option: StorageAreaFilterOption;
  isSelected: boolean;
  isLast: boolean;
  onSelect: (id: string) => void;
}

const StationRow = memo(function StationRow({
  option,
  isSelected,
  isLast,
  onSelect,
}: StationRowProps) {
  const ds = useScaledStyles();
  const handlePress = useCallback(() => onSelect(option.id), [onSelect, option.id]);

  return (
    <ListRow
      title={option.label}
      last={isLast}
      onPress={handlePress}
      accessibilityHint={
        option.badgeCount > 0 ? `${option.badgeCount} unchecked` : undefined
      }
      right={
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: ds.spacing(space[2] + 2),
          }}
        >
          {option.badgeCount > 0 ? (
            <View
              style={{
                minWidth: ds.icon(24),
                paddingHorizontal: ds.spacing(space[2]),
                paddingVertical: ds.spacing(space[1] / 2),
                borderRadius: radius.pill,
                backgroundColor: color.well,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.caption),
                  fontWeight: weight.bold,
                  color: color.ink,
                }}
              >
                {option.badgeCount}
              </Text>
            </View>
          ) : null}
          <Ionicons
            name={isSelected ? 'checkmark' : 'chevron-forward'}
            size={ds.icon(18)}
            color={isSelected ? color.accent : color.ink3}
          />
        </View>
      }
    />
  );
});

export const StationPickerBottomSheet = memo(function StationPickerBottomSheet({
  visible,
  options,
  selectedId,
  onSelect,
  onClose,
}: StationPickerBottomSheetProps) {
  const ds = useScaledStyles();

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onClose, onSelect],
  );

  return (
    <Sheet
      visible={visible}
      title="All stations"
      onClose={onClose}
      primary={{ label: 'Close', onPress: onClose, variant: 'secondary' }}
    >
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.secondary),
          color: color.ink2,
        }}
      >
        Pick a storage area to focus on. Numbers show items still unchecked.
      </Text>

      <ScrollView
        style={{ maxHeight: ds.spacing(480) }}
        showsVerticalScrollIndicator={false}
      >
        <Card flush style={{ paddingHorizontal: ds.spacing(space[3] + 2) }}>
          {options.map((opt, index) => (
            <StationRow
              key={opt.id}
              option={opt}
              isSelected={opt.id === selectedId}
              isLast={index === options.length - 1}
              onSelect={handleSelect}
            />
          ))}
        </Card>
      </ScrollView>
    </Sheet>
  );
});
