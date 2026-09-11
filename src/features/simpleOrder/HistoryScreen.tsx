import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EmptyState,
  Loading,
  ScreenHeader,
  Sheet,
  getTabBarClearance,
} from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { ImpactFeedbackStyle, triggerImpactHaptic } from '@/lib/haptics';
import { color, radius, space, typeScale } from '@/theme/tokens';
import { useSimpleOrderUiStore } from '@/store/simpleOrderUiStore';
import {
  formatHistoryDate,
  formatSentTime,
  listMyRecentOrders,
  type RecentOrder,
} from './recentOrders';

/**
 * History tab: the employee's past sent orders (past_orders), one card per
 * send, with Reorder loading that order's items + quantities into today's
 * checklist and returning to the Order tab. Tapping a card shows the archived
 * message text, read-only.
 */

export function HistoryScreen() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const setPendingReorder = useSimpleOrderUiStore((state) => state.setPendingReorder);

  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detailOrder, setDetailOrder] = useState<RecentOrder | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setOrders(await listMyRecentOrders(50));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Could not load your past orders.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const handleReorder = useCallback(
    (order: RecentOrder) => {
      if (order.reorderItems.length === 0) return;
      void triggerImpactHaptic(ImpactFeedbackStyle.Light);
      setPendingReorder({
        items: order.reorderItems,
        sourceLabel: formatHistoryDate(order.createdAt) || 'that order',
      });
      router.push('/(tabs)/simple-order' as never);
    },
    [setPendingReorder],
  );

  const bottomPadding = getTabBarClearance(insets.bottom) + ds.spacing(space[3]);

  const renderOrder = useCallback(
    ({ item }: { item: RecentOrder }) => {
      const countBit =
        item.itemCount !== null
          ? `${item.itemCount} ${item.itemCount === 1 ? 'item' : 'items'}`
          : item.supplierName;
      const timeBit = formatSentTime(item.createdAt);
      return (
        <TouchableOpacity
          onPress={() => setDetailOrder(item)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Order from ${formatHistoryDate(item.createdAt)}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: ds.spacing(12),
            backgroundColor: color.card,
            borderWidth: 1,
            borderColor: color.hairline,
            borderRadius: radius.card,
            paddingHorizontal: ds.spacing(16),
            paddingVertical: ds.spacing(14),
            marginBottom: ds.spacing(10),
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.pill,
              backgroundColor: color.well,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="receipt-outline" size={ds.icon(18)} color={color.ink} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: ds.fontSize(typeScale.body), fontWeight: '700', color: color.ink }}
            >
              {formatHistoryDate(item.createdAt)}
            </Text>
            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2, marginTop: 1 }}>
              {countBit}
              {timeBit ? ` · sent ${timeBit}` : ''}
            </Text>
          </View>
          {item.reorderItems.length > 0 ? (
            <TouchableOpacity
              onPress={() => handleReorder(item)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Reorder ${countBit}`}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={{
                backgroundColor: color.tint,
                borderRadius: radius.pill,
                paddingHorizontal: ds.spacing(13),
                paddingVertical: ds.spacing(7),
              }}
            >
              <Text
                style={{ fontSize: ds.fontSize(typeScale.secondary), fontWeight: '700', color: color.accent }}
              >
                Reorder
              </Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      );
    },
    [ds, handleReorder],
  );

  let content: React.ReactNode;
  if (orders === null && !loadError) {
    content = <Loading label="Loading past orders" />;
  } else if (loadError) {
    content = (
      <EmptyState
        icon="alert-circle-outline"
        tone="alert"
        title="History unavailable"
        body={loadError}
        action={{ label: 'Try again', onPress: () => void load() }}
      />
    );
  } else if ((orders ?? []).length === 0) {
    content = (
      <EmptyState
        icon="receipt-outline"
        title="No sent orders yet"
        body="Orders appear here after they are sent to suppliers. Orders waiting for manager review show up once they are processed."
      />
    );
  } else {
    content = (
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={color.accent}
          />
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.page }}>
      <View style={{ flex: 1, paddingHorizontal: ds.spacing(18) }}>
        <ScreenHeader
          title="Past orders"
          includeSafeArea={false}
          style={{ paddingHorizontal: 0 }}
        />
        {content}
      </View>

      <Sheet
        visible={detailOrder !== null}
        title={detailOrder ? formatHistoryDate(detailOrder.createdAt) : 'Order'}
        onClose={() => setDetailOrder(null)}
        primary={
          detailOrder && detailOrder.reorderItems.length > 0
            ? {
                label: 'Reorder these items',
                onPress: () => {
                  const order = detailOrder;
                  setDetailOrder(null);
                  handleReorder(order);
                },
              }
            : undefined
        }
      >
        {detailOrder ? (
          <>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink2,
              }}
            >
              {detailOrder.supplierName}
              {formatSentTime(detailOrder.createdAt)
                ? ` \u00b7 sent ${formatSentTime(detailOrder.createdAt)}`
                : ''}
            </Text>
            <ScrollView style={{ maxHeight: ds.spacing(320) }} showsVerticalScrollIndicator={false}>
              <View
                style={{
                  backgroundColor: color.card,
                  borderWidth: 1,
                  borderColor: color.hairline,
                  borderRadius: radius.card,
                  padding: ds.spacing(space[3] + 2),
                }}
              >
                <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink, lineHeight: 19 }}>
                  {detailOrder.messageText || 'No message text was archived for this order.'}
                </Text>
              </View>
            </ScrollView>
          </>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}
