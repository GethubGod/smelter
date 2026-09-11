import React, { memo, useCallback } from 'react';
import {
  type GestureResponderEvent,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants';
// Imported from the file, not the barrel: the row is rendered in a list and
// the barrel would drag ScreenHeader and its safe-area dependency in with it.
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import type { InventoryWithStock } from '@/lib/api/stock';
import { color, radius, size, typeScale } from '@/theme/tokens';

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

// Stock state is a status, so it reads as a dot plus a word through
// StatusPill. Colour alone is unreadable in greyscale and to a colour-blind
// manager, and the fill bar below repeats the same tone.
const STATUS_TONE: Record<ManagerInventoryStatus, StatusTone> = {
  critical: 'cancelled',
  low: 'submitted',
  good: 'fulfilled',
};

const STATUS_LABEL: Record<ManagerInventoryStatus, string> = {
  critical: 'Critical',
  low: 'Low',
  good: 'Good',
};

const STATUS_COLORS: Record<ManagerInventoryStatus, string> = {
  critical: color.alert,
  low: color.warning,
  good: color.good,
};

function touchSlop(controlSize: number) {
  const slop = Math.max(0, Math.ceil((size.touchMin - controlSize) / 2));
  return { top: slop, bottom: slop, left: slop, right: slop };
}

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

  // Both reorder controls keep their compact look and reach the 44pt minimum
  // through hitSlop, the same trade the Button and Chip primitives make.
  const compactControl = Math.max(36, ds.icon(32));
  const reorderSlop = touchSlop(compactControl);
  const listControl = Math.max(32, ds.icon(28));
  const listSlop = touchSlop(listControl);

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
          <View className="flex-row items-center" style={{ gap: ds.spacing(8) }}>
            <StatusPill status={STATUS_TONE[item.status]} label={STATUS_LABEL[item.status]} />
            {item.status === 'critical' && reorderQty > 0 && !isBulkMode ? (
              <TouchableOpacity
                className="items-center justify-center border"
                accessibilityRole="button"
                accessibilityLabel={added ? 'Added to reorder' : 'Add to reorder'}
                hitSlop={reorderSlop}
                style={{ borderRadius: radius.pill, borderColor: added ? color.accent : color.hairlineStrong, width: compactControl,
                  height: compactControl }}
                onPress={handleAddToReorder}
              >
                <Ionicons
                  name={added ? 'checkmark' : 'add'}
                  size={ds.icon(16)}
                  color={added ? color.accent : color.ink2}
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
          <StatusPill status={STATUS_TONE[item.status]} label={STATUS_LABEL[item.status]} />
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
              className="border"
              accessibilityRole="button"
              accessibilityLabel={added ? 'Added to reorder' : `Reorder ${reorderQty}`}
              hitSlop={listSlop}
              style={{ borderRadius: radius.pill, borderColor: added ? color.accent : color.hairlineStrong, paddingHorizontal: ds.spacing(12),
                paddingVertical: ds.spacing(6),
                minHeight: listControl,
                justifyContent: 'center' }}
              onPress={handleAddToReorder}
            >
              <Text
                className="font-semibold"
                style={{ color: added ? color.accent : color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}
              >
                {added ? 'Added' : `Reorder ${reorderQty}`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const ManagerInventoryRow = memo(ManagerInventoryRowInner);
