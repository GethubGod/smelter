import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  glassColors,
  glassHairlineWidth,
  glassRadii,
} from '@/theme/design';
import type { FulfillmentSupplierPreviewItem } from './FulfillmentSupplierCard';
import { color, radius, typeScale, weight } from '@/theme/tokens';

const BADGE_PALETTE = [
  { background: color.well, text: color.ink2 },
  { background: color.well, text: color.ink2 },
  { background: color.well, text: color.ink2 },
  { background: color.well, text: color.ink2 },
] as const;

interface FulfillmentExpandedSupplierItemsProps {
  items: FulfillmentSupplierPreviewItem[];
  orderLabel: string;
  onOrderPress: () => void;
}

export function FulfillmentExpandedSupplierItems({
  items,
  orderLabel,
  onOrderPress,
}: FulfillmentExpandedSupplierItemsProps) {
  const ds = useScaledStyles();

  return (
    <View style={{ paddingHorizontal: ds.spacing(24), paddingBottom: ds.spacing(24), paddingTop: ds.spacing(8) }}>
      {items.map((item, index) => {
        const palette = BADGE_PALETTE[Math.abs(item.badgeToneIndex) % BADGE_PALETTE.length];

        return (
          <TouchableOpacity
            key={item.id}
            onPress={item.onPress || undefined}
            disabled={!item.onPress}
            activeOpacity={0.96}
            style={{
              backgroundColor: color.card,
              borderRadius: radius.control,
              borderWidth: glassHairlineWidth,
              borderColor: color.hairline,
              paddingHorizontal: ds.spacing(16),
              paddingVertical: ds.spacing(16),
              marginTop: index === 0 ? 0 : ds.spacing(10),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: ds.spacing(10) }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'nowrap' }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: glassColors.textPrimary,
                      fontSize: ds.fontSize(typeScale.body),
                      fontWeight: weight.bold,
                      flexShrink: 1,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={{
                      color: glassColors.textSecondary,
                      fontSize: ds.fontSize(typeScale.secondary),
                      fontWeight: weight.semibold,
                      marginLeft: ds.spacing(6),
                    }}
                  >
                    {item.quantityLabel}
                  </Text>
                </View>

                {item.summaryLabel && item.isRemaining ? (
                  <Text
                    style={{
                      color: glassColors.textSecondary,
                      fontSize: ds.fontSize(typeScale.secondary),
                      marginTop: ds.spacing(6),
                    }}
                  >
                    {item.summaryLabel}
                  </Text>
                ) : null}
              </View>

              {item.badgeLabel ? (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    paddingHorizontal: ds.spacing(6),
                    borderRadius: radius.control,
                    backgroundColor: palette.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: ds.fontSize(typeScale.caption),
                      fontWeight: weight.bold,
                    }}
                  >
                    {item.badgeLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        onPress={onOrderPress}
        activeOpacity={0.88}
        style={{
          marginTop: ds.spacing(24),
          minHeight: Math.max(52, ds.buttonH + 10),
          paddingHorizontal: ds.spacing(24),
          paddingVertical: ds.spacing(14),
          borderRadius: glassRadii.pill,
          backgroundColor: glassColors.accent,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: 'rgba(15, 23, 42, 0.22)',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 2,
        }}
      >
        <Text
          style={{
            color: glassColors.textOnPrimary,
            fontSize: ds.fontSize(typeScale.title),
            fontWeight: weight.bold,
          }}
        >
          {orderLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
