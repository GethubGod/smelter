import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router, type Href, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { useOrderStore, useAuthStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { OrderWithDetails, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS } from '@/constants';
import { Card, Chip, EmptyState, ScreenHeader, StatusPill } from '@/components/ui';
import { useManagedRefresh } from '@/hooks/useManagedRefresh';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, space, typeScale, weight, type StatusTone } from '@/theme/tokens';

const statuses: (OrderStatus | null)[] = [null, 'submitted', 'fulfilled', 'cancelled'];

/**
 * `cancel_requested` is a real order status but not one of the contract's five
 * pills, so it borrows the submitted tone and keeps its own word.
 */
const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  draft: 'draft',
  submitted: 'submitted',
  processing: 'processing',
  fulfilled: 'fulfilled',
  cancelled: 'cancelled',
  cancel_requested: 'submitted',
};

function OrderListCard({ order }: { order: OrderWithDetails }) {
  const ds = useScaledStyles();
  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const itemCount = order.order_items?.length || 0;
  const noteCount = order.order_items?.filter(
    (line) => typeof line.note === 'string' && line.note.trim().length > 0
  ).length || 0;
  const locationName = order.location?.name || 'Unknown Location';

  return (
    <TouchableOpacity
      onPress={() => router.push(`/orders/${order.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.order_number}, ${statusLabel}`}
      activeOpacity={0.7}
    >
      <Card>
        {/* Header Row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: ds.spacing(space[2]),
            marginBottom: ds.spacing(space[2]),
          }}
        >
          <Text
            style={{
              flexShrink: 1,
              fontSize: ds.fontSize(typeScale.title),
              fontWeight: weight.bold,
              color: color.ink,
            }}
          >
            Order #{order.order_number}
          </Text>
          <StatusPill status={STATUS_TONE[order.status] ?? 'draft'} label={statusLabel} />
        </View>

        {/* Date Row */}
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.secondary),
            color: color.ink2,
            marginBottom: ds.spacing(space[2]),
          }}
        >
          {formatDate(order.created_at)}
        </Text>

        {/* Location & Items Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ds.spacing(space[1]) }}>
          <Ionicons name="location" size={ds.icon(14)} color={color.ink3} />
          <Text
            style={{
              flexShrink: 1,
              fontSize: ds.fontSize(typeScale.secondary),
              color: color.ink2,
            }}
          >
            {locationName}
          </Text>
          <Text style={{ color: color.ink3 }}>•</Text>
          <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </Text>
          {noteCount > 0 && (
            <>
              <Text style={{ color: color.ink3 }}>•</Text>
              <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
                {noteCount} note{noteCount !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const ds = useScaledStyles();
  const params = useLocalSearchParams<{ backTo?: string | string[] }>();
  const user = useAuthStore((state) => state.user);
  const { orders, fetchUserOrders } = useOrderStore(
    useShallow((state) => ({
      orders: state.orders,
      fetchUserOrders: state.fetchUserOrders,
    })),
  );
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchUserOrders(user.id);
      }
    }, [fetchUserOrders, user])
  );

  useEffect(() => {
    if (!user?.id) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        void fetchUserOrders(user.id);
      }, 250);
    };

    const channel = supabase
      .channel(`employee-orders-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        },
        scheduleRefresh
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [fetchUserOrders, user?.id]);

  const { refreshing, onRefresh } = useManagedRefresh(
    useCallback(async () => {
      if (!user) {
        return;
      }

      await fetchUserOrders(user.id);
    }, [fetchUserOrders, user]),
  );

  const filteredOrders = selectedStatus
    ? orders.filter((order) => order.status === selectedStatus)
    : orders;

  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const backTarget =
    typeof backTo === 'string' && backTo.length > 0 ? (backTo as Href) : null;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (backTarget) {
      router.replace(backTarget);
      return;
    }

    router.replace('/(tabs)/settings');
  };

  const renderItem = ({ item }: { item: OrderWithDetails }) => (
    <OrderListCard order={item} />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        mode="pushed"
        title="My orders"
        onBack={handleBack}
        includeSafeArea={false}
      />

      {/* Status filter */}
      <FlatList
        horizontal
        data={statuses}
        keyExtractor={(item) => item || 'all'}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          gap: ds.spacing(space[2]),
          paddingHorizontal: ds.spacing(space[4]),
          paddingVertical: ds.spacing(space[2]),
        }}
        renderItem={({ item: status }) => (
          <Chip
            label={status ? ORDER_STATUS_LABELS[status] : 'All'}
            selected={selectedStatus === status}
            onPress={() => setSelectedStatus(status)}
          />
        )}
      />

      {/* Orders list */}
      <FlatList
        data={filteredOrders as OrderWithDetails[]}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: ds.spacing(space[4]), flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: ds.spacing(space[3]) }} />}
        ListEmptyComponent={() => (
          <EmptyState
            icon="receipt-outline"
            title="No orders yet"
            body="Your submitted orders will appear here."
            action={{ label: 'Start ordering', onPress: () => router.push('/quick-order') }}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.accent}
          />
        }
      />
    </SafeAreaView>
  );
}
