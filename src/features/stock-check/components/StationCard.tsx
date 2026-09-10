import React, { memo, useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { StatusPill, type StatusTone } from '@/components/ui';
import { color, radius, size, space, tracking, typeScale, weight } from '@/theme/tokens';
import type { AreaProgress, StockCheckArea } from '../types';

export type StationCardTone = 'danger' | 'warning' | 'neutral' | 'success';

export interface StationCardModel {
  area: StockCheckArea;
  progress: AreaProgress;
  tone: StationCardTone;
  statusLabel: string;
  statusMeta: string | null;
  itemSubtitle: string | null;
}

export function buildStationCardModel(
  area: StockCheckArea,
  progress: AreaProgress,
): StationCardModel {
  const remaining = Math.max(0, progress.totalItems - progress.checkedItems);
  const isComplete = progress.totalItems > 0 && remaining === 0;
  const isStarted = progress.checkedItems > 0 && !isComplete;
  const hasOrderRisk = progress.itemsToOrder > 0;

  if (isComplete) {
    return {
      area,
      progress,
      tone: 'success',
      statusLabel: 'DONE',
      statusMeta: null,
      itemSubtitle: null,
    };
  }

  if (isStarted) {
    return {
      area,
      progress,
      tone: 'warning',
      statusLabel: 'IN PROGRESS',
      statusMeta: `${progress.checkedItems} of ${progress.totalItems} done`,
      itemSubtitle: `${remaining} left${
        hasOrderRisk ? ` · ${progress.itemsToOrder} to order` : ''
      }`,
    };
  }

  return {
    area,
    progress,
    tone: 'danger',
    statusLabel: 'NOT CHECKED',
    statusMeta: null,
    itemSubtitle: `${progress.totalItems} items${
      hasOrderRisk ? ` · ${progress.itemsToOrder} likely below par` : ''
    }`,
  };
}

/**
 * Station state is a status, so it renders as a StatusPill: the contract keeps
 * the good/warning colours there and nowhere else. The old per-tone rail,
 * headline colour and coloured chevron button are gone; the chevron uses the
 * one action colour.
 */
const TONE_STATUS: Record<StationCardTone, StatusTone> = {
  success: 'fulfilled',
  warning: 'submitted',
  danger: 'draft',
  neutral: 'draft',
};

export const StationSeparator = memo(function StationSeparator() {
  return <View style={{ height: space[3] }} />;
});

export const StationCard = memo(function StationCard({
  model,
  onPress,
}: {
  model: StationCardModel;
  onPress: (stationId: string) => void;
}) {
  const ds = useScaledStyles();
  const handlePress = useCallback(
    () => onPress(model.area.id),
    [model.area.id, onPress],
  );
  const chevronCircle = Math.max(size.touchMin, ds.icon(size.button));

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open ${model.area.name} stock check`}
      onPress={handlePress}
      activeOpacity={0.88}
      style={{
        borderRadius: radius.card,
        backgroundColor: color.card,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: color.hairline,
      }}
    >
      <View
        style={{
          paddingHorizontal: ds.spacing(space[4]),
          paddingVertical: ds.spacing(space[3]),
          flexDirection: 'row',
          alignItems: 'center',
          gap: ds.spacing(space[3]),
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: ds.spacing(space[2]),
              marginBottom: ds.spacing(space[1] + 2),
            }}
          >
            <StatusPill
              status={TONE_STATUS[model.tone]}
              label={model.statusLabel}
            />
            {model.statusMeta ? (
              <Text
                style={{
                  flexShrink: 1,
                  fontSize: ds.fontSize(typeScale.caption),
                  fontWeight: weight.semibold,
                  letterSpacing: tracking.caption,
                  color: color.ink2,
                }}
                numberOfLines={1}
              >
                {model.statusMeta}
              </Text>
            ) : null}
          </View>

          <Text
            style={{
              fontSize: ds.fontSize(typeScale.title),
              fontWeight: weight.bold,
              letterSpacing: tracking.title,
              color: color.ink,
            }}
            numberOfLines={2}
          >
            {model.area.name}
          </Text>
          {model.itemSubtitle ? (
            <Text
              style={{
                marginTop: ds.spacing(space[1] - 1),
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink2,
              }}
              numberOfLines={1}
            >
              {model.itemSubtitle}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            width: chevronCircle,
            height: chevronCircle,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.tint,
          }}
        >
          <Ionicons
            name="chevron-forward"
            size={ds.icon(size.icon)}
            color={color.accent}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
});
