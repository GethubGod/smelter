import React, { memo, useCallback } from 'react';
import {
  type GestureResponderEvent,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import type { InventoryWithStock } from '@/lib/api/stock';
import { color, radius, typeScale } from '@/theme/tokens';

export type ManagerInventoryStatus = 'critical' | 'low' | 'good';

export type ManagerInventoryStockItem = InventoryWithStock & {
  status: ManagerInventoryStatus;
  overdue: boolean;
  fillPercent: number;
  areaLabel: string;
};

type ManagerInventoryRowProps = {
  item: ManagerInventoryStockItem;
  variant: 'list' | 'compact';
  added: boolean;
  isBulkMode: boolean;
  isSelected: boolean;
  onOpen: (item: ManagerInventoryStockItem) => void;
  onEnterBulk: (item: ManagerInventoryStockItem) => void;
  onToggleBulk: (itemId: string) => void;
  onAddToReorder: (item: ManagerInventoryStockItem) => void;
};

const CATEGORY_EMOJI: Record<string, string> = {
  fish: '🐟',
  protein: '🥩',
  produce: '🥬',
  dry: '🍚',
  dairy_cold: '🧊',
  frozen: '❄️',
  sauces: '🍶',
  alcohol: '🍺',
  packaging: '📦',
};

const STATUS_COLORS: Record<ManagerInventoryStatus, string> = {
  critical: colors.error,
  low: colors.warning,
  good: colors.success,
};

function getRelativeTime(timestamp: string | null): string {
  if (!timestamp) return 'Never updated';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Never updated';
  const diffMs = Date.now() - date.getTime();
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function ManagerInventoryRowInner({
  item,
  variant,
  added,
  isBulkMode,
  isSelected,
  onOpen,
  onEnterBulk,
  onToggleBulk,
  onAddToReorder,
}: ManagerInventoryRowProps) {
  const ds = useScaledStyles();
  const statusColor = STATUS_COLORS[item.status];
  const reorderQty = Math.max(item.max_quantity - item.current_quantity, 0);

  const handlePress = useCallback(() => {
    if (isBulkMode) {
      onToggleBulk(item.id);
      return;
    }
    onOpen(item);
  }, [isBulkMode, item, onOpen, onToggleBulk]);

  const handleLongPress = useCallback(() => {
    if (!isBulkMode) onEnterBulk(item);
  }, [isBulkMode, item, onEnterBulk]);

  const handleAddToReorder = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      onAddToReorder(item);
    },
    [item, onAddToReorder],
  );

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        className="border overflow-hidden"
        style={{ backgroundColor: color.card, borderColor: color.hairline, borderRadius: radius.card, marginBottom: ds.spacing(8) }}
        onPress={handlePress}
        onLongPress={handleLongPress}
      >
        <View
          className="flex-row items-center"
          style={{
            paddingHorizontal: ds.spacing(16),
            paddingVertical: ds.spacing(12),
          }}
        >
          {isBulkMode ? (
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={ds.icon(18)}
              color={isSelected ? colors.primary[500] : colors.gray[400]}
              style={{ marginRight: ds.spacing(8) }}
            />
          ) : null}
          <Text style={{ fontSize: ds.fontSize(typeScale.title), marginRight: ds.spacing(8) }}>
            {CATEGORY_EMOJI[item.inventory_item.category] ?? '📦'}
          </Text>
          <View className="flex-1">
            <Text
              className="font-semibold"
              style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}
              numberOfLines={1}
            >
              {item.inventory_item.name}
            </Text>
            <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
              {item.current_quantity} / {item.max_quantity} {item.unit_type}
            </Text>
          </View>
          <View className="flex-row items-center">
            <View

              style={{ borderRadius: radius.pill, width: ds.spacing(10),
                height: ds.spacing(10),
                backgroundColor: statusColor,
                marginRight: ds.spacing(8) }}
            />
            {item.status === 'critical' && reorderQty > 0 && !isBulkMode ? (
              <TouchableOpacity
                className={`rounded-full items-center justify-center border ${added ? 'border-green-500' : 'border-orange-500'}`}
                style={{
                  width: Math.max(36, ds.icon(32)),
                  height: Math.max(36, ds.icon(32)),
                }}
                onPress={handleAddToReorder}
              >
                <Ionicons
                  name={added ? 'checkmark' : 'add'}
                  size={ds.icon(16)}
                  color={added ? colors.success : colors.primary[500]}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const relativeTime = getRelativeTime(item.last_updated_at);
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={{ marginBottom: ds.spacing(12) }}
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      <View
        className="border"
        style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline, paddingHorizontal: ds.spacing(16),
          paddingVertical: ds.spacing(14),
          shadowColor: colors.background,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1 }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-center flex-1" style={{ paddingRight: ds.spacing(8) }}>
            {isBulkMode ? (
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={ds.icon(20)}
                color={isSelected ? colors.primary[500] : colors.gray[400]}
                style={{ marginRight: ds.spacing(8) }}
              />
            ) : null}
            <Text style={{ fontSize: ds.fontSize(typeScale.title), marginRight: ds.spacing(8) }}>
              {CATEGORY_EMOJI[item.inventory_item.category] ?? '📦'}
            </Text>
            <Text
              className="font-semibold"
              style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body) }}
              numberOfLines={1}
            >
              {item.inventory_item.name}
            </Text>
          </View>
          <View

            style={{ borderRadius: radius.pill, width: ds.spacing(10),
              height: ds.spacing(10),
              backgroundColor: statusColor,
              marginTop: ds.spacing(4) }}
          />
        </View>

        <Text

          style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary), marginTop: ds.spacing(4) }}
        >
          {item.areaLabel} • {item.location.name}
        </Text>

        <View style={{ marginTop: ds.spacing(12) }}>
          <View
            className="overflow-hidden"
            style={{ borderRadius: radius.pill, backgroundColor: color.well, height: ds.spacing(6) }}
          >
            <View
              className="h-full"
              style={{ borderRadius: radius.pill, width: `${Math.round(item.fillPercent)}%`, backgroundColor: statusColor }}
            />
          </View>
          <View className="flex-row justify-between" style={{ marginTop: ds.spacing(6) }}>
            <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
              {item.current_quantity} {item.unit_type}
            </Text>
            <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>
              Min {item.min_quantity} • Max {item.max_quantity}
            </Text>
          </View>
        </View>

        <View
          className="flex-row items-center justify-between"
          style={{ marginTop: ds.spacing(10) }}
        >
          <Text style={{ color: color.ink3, fontSize: ds.fontSize(typeScale.caption) }}>
            {relativeTime === 'Never updated' ? relativeTime : `Updated ${relativeTime}`}
          </Text>
          {item.status === 'critical' && reorderQty > 0 && !isBulkMode ? (
            <TouchableOpacity
              className={`rounded-full border ${added ? 'border-green-500' : 'border-orange-500'}`}
              style={{
                paddingHorizontal: ds.spacing(12),
                paddingVertical: ds.spacing(6),
                minHeight: Math.max(32, ds.icon(28)),
                justifyContent: 'center',
              }}
              onPress={handleAddToReorder}
            >
              <Text
                className={`font-semibold ${added ? 'text-green-600' : 'text-orange-600'}`}
                style={{ fontSize: ds.fontSize(typeScale.secondary) }}
              >
                {added ? '✓ Added' : `Reorder ${reorderQty}`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const ManagerInventoryRow = memo(ManagerInventoryRowInner);
