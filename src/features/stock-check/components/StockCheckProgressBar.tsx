import React, { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space, typeScale, weight } from '@/theme/tokens';

interface StockCheckProgressBarProps {
  totalItems: number;
  checkedItems: number;
  itemsToOrder: number;
  labelMode?: 'totalChecked' | 'uncheckedRemaining';
}

export const StockCheckProgressBar = memo(function StockCheckProgressBar({
  totalItems,
  checkedItems,
  itemsToOrder,
  labelMode = 'totalChecked',
}: StockCheckProgressBarProps) {
  const ds = useScaledStyles();
  const ratio = useMemo(() => {
    if (totalItems <= 0) return 0;
    return Math.max(0, Math.min(1, checkedItems / totalItems));
  }, [checkedItems, totalItems]);
  const uncheckedItems = Math.max(0, totalItems - checkedItems);
  const leftLabel =
    labelMode === 'uncheckedRemaining'
      ? `${checkedItems} checked`
      : `${checkedItems} of ${totalItems} checked`;
  const rightLabel =
    labelMode === 'uncheckedRemaining'
      ? `${uncheckedItems} unchecked`
      : `${itemsToOrder} to order`;

  return (
    <View
      style={{
        backgroundColor: color.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: color.hairline,
        paddingHorizontal: ds.spacing(space[4]),
        paddingVertical: ds.spacing(space[3]),
        marginBottom: ds.spacing(space[3]),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: ds.spacing(space[2] + 2),
        }}
      >
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.body),
            fontWeight: weight.bold,
            color: color.ink,
          }}
        >
          {leftLabel}
        </Text>
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.secondary),
            fontWeight: weight.bold,
            color: color.accent,
          }}
        >
          {rightLabel}
        </Text>
      </View>

      <View
        style={{
          height: 6,
          borderRadius: radius.pill,
          backgroundColor: color.well,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            backgroundColor: color.accent,
            borderRadius: radius.pill,
          }}
        />
      </View>
    </View>
  );
});
