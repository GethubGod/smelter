import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetShell } from '@/components/BottomSheetShell';
import { Loading } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { triggerSelectionHaptic } from '@/lib/haptics';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import {
  formatRecentOrderDate,
  listMyRecentOrders,
  type RecentOrder,
} from '../recentOrders';

/**
 * Read-only "Recent orders" sheet for the checklist screen: the employee's
 * own past_orders (supplier, date, item count) with a detail view showing the
 * archived message text. Deliberately light — no editing or resending.
 */

interface RecentOrdersSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function RecentOrdersSheet({ visible, onClose }: RecentOrdersSheetProps) {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<RecentOrder | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoadError(null);
    setDetailOrder(null);
    listMyRecentOrders()
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : 'Could not load recent orders.',
        );
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    setDetailOrder(null);
    onClose();
  }, [onClose]);

  const handleOpenDetail = useCallback((order: RecentOrder) => {
    void triggerSelectionHaptic();
    setDetailOrder(order);
  }, []);

  const handleBackToList = useCallback(() => {
    void triggerSelectionHaptic();
    setDetailOrder(null);
  }, []);

  let body: React.ReactNode;
  if (loadError) {
    body = (
      <Text
        style={{
          paddingVertical: ds.spacing(20),
          fontSize: ds.fontSize(typeScale.body),
          color: color.alert,
          textAlign: 'center',
        }}
      >
        {loadError}
      </Text>
    );
  } else if (orders === null) {
    body = (
      <View style={{ paddingVertical: ds.spacing(24), alignItems: 'center' }}>
        <Loading size="inline" color={color.accent} label="Loading" />
      </View>
    );
  } else if (detailOrder) {
    body = (
      <ScrollView
        style={{ maxHeight: ds.spacing(360) }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: color.hairline,
            backgroundColor: color.well,
            paddingHorizontal: ds.spacing(14),
            paddingVertical: ds.spacing(12),
          }}
        >
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.secondary),
              lineHeight: ds.fontSize(typeScale.title),
              color: color.ink,
            }}
          >
            {detailOrder.messageText || 'No message text was saved for this order.'}
          </Text>
        </View>
      </ScrollView>
    );
  } else if (orders.length === 0) {
    body = (
      <Text
        style={{
          paddingVertical: ds.spacing(20),
          fontSize: ds.fontSize(typeScale.body),
          color: color.ink2,
          textAlign: 'center',
        }}
      >
        No sent orders yet. Orders you send directly to suppliers show up here.
      </Text>
    );
  } else {
    body = (
      <ScrollView
        style={{ maxHeight: ds.spacing(360) }}
        showsVerticalScrollIndicator={false}
      >
        {orders.map((order, index) => (
          <TouchableOpacity
            key={order.id}
            onPress={() => handleOpenDetail(order)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`View ${order.supplierName} order`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 52,
              paddingVertical: ds.spacing(8),
              borderBottomWidth:
                index === orders.length - 1 ? 0 : 1,
              borderBottomColor: color.hairline,
            }}
          >
            <View style={{ flex: 1, paddingRight: ds.spacing(8) }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: ds.fontSize(typeScale.body),
                  fontWeight: weight.semibold,
                  color: color.ink,
                }}
              >
                {order.supplierName}
              </Text>
              <Text
                style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}
              >
                {formatRecentOrderDate(order.createdAt)}
                {order.itemCount !== null
                  ? ` • ${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`
                  : ''}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={ds.icon(16)}
              color={color.ink3}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  return (
    <BottomSheetShell
      visible={visible}
      onClose={handleClose}
      bottomPadding={Math.max(insets.bottom, ds.spacing(12))}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: ds.spacing(10) }}>
        {detailOrder ? (
          <TouchableOpacity
            onPress={handleBackToList}
            accessibilityRole="button"
            accessibilityLabel="Back to recent orders"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: ds.spacing(8) }}
          >
            <Ionicons name="chevron-back" size={ds.icon(20)} color={color.ink} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.title),
              fontWeight: '700',
              color: color.ink,
            }}
            numberOfLines={1}
          >
            {detailOrder ? detailOrder.supplierName : 'Recent orders'}
          </Text>
          {detailOrder ? (
            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink3 }}>
              {formatRecentOrderDate(detailOrder.createdAt)}
              {detailOrder.itemCount !== null
                ? ` • ${detailOrder.itemCount} item${detailOrder.itemCount === 1 ? '' : 's'}`
                : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {body}
    </BottomSheetShell>
  );
}
