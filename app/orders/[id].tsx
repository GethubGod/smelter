import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/react/shallow';
import { useOrderStore, useAuthStore } from '@/store';
import { OrderItemWithInventory, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, getCategoryLabel, categoryColors } from '@/constants';
import { supabase } from '@/lib/supabase';
import {
  Button,
  Card,
  EmptyState,
  Loading,
  ScreenHeader,
  SectionLabel,
  StatusPill,
} from '@/components/ui';
import { completePendingRemindersForUser } from '@/services/notificationService';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { color, radius, space, typeScale, weight, type StatusTone } from '@/theme/tokens';

const MANAGER_DASHBOARD_FALLBACK_ROUTE = '/(manager)';

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

export default function OrderDetailScreen() {
  const ds = useScaledStyles();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, viewMode } = useAuthStore(
    useShallow((state) => ({ user: state.user, viewMode: state.viewMode })),
  );
  const {
    currentOrder,
    fetchOrder,
    submitOrder,
    updateOrderStatus,
    cancelOrder,
    isLoading,
  } = useOrderStore(
    useShallow((state) => ({
      currentOrder: state.currentOrder,
      fetchOrder: state.fetchOrder,
      submitOrder: state.submitOrder,
      updateOrderStatus: state.updateOrderStatus,
      cancelOrder: state.cancelOrder,
      isLoading: state.isLoading,
    })),
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [fulfilledByUser, setFulfilledByUser] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (user?.role === 'manager') {
      router.replace(MANAGER_DASHBOARD_FALLBACK_ROUTE);
      return;
    }

    router.replace('/(tabs)');
  }, [user?.role]);

  useEffect(() => {
    if (!orderId) {
      setLoadError('Invalid order ID.');
      return;
    }

    let isMounted = true;
    setLoadError(null);
    fetchOrder(orderId).catch((error: any) => {
      if (!isMounted) return;
      setLoadError(error?.message || 'Unable to load this order.');
    });

    return () => {
      isMounted = false;
    };
  }, [fetchOrder, orderId]);

  // Fetch the user who fulfilled the order
  useEffect(() => {
    const fetchFulfilledBy = async () => {
      if (currentOrder?.fulfilled_by) {
        const { data } = await supabase
          .from('users')
          .select('name')
          .eq('id', currentOrder.fulfilled_by)
          .single();
        if (data) {
          setFulfilledByUser((data as { name: string }).name);
        }
      } else {
        setFulfilledByUser(null);
      }
    };
    fetchFulfilledBy().catch(() => setFulfilledByUser(null));
  }, [currentOrder?.fulfilled_by]);

  const handleSubmit = () => {
    if (!currentOrder) return;

    Alert.alert(
      'Submit Order',
      'Submit this order? It will be sent for fulfillment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setIsUpdating(true);
              await submitOrder(currentOrder.id);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              if (user?.id) {
                completePendingRemindersForUser(user.id).catch(() => {});
              }
              await fetchOrder(currentOrder.id);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to submit order');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkProcessing = () => {
    if (!currentOrder || !user) return;

    Alert.alert(
      'Start Processing',
      'Mark this order as processing? This indicates you have started working on it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Processing',
          onPress: async () => {
            try {
              setIsUpdating(true);
              await updateOrderStatus(currentOrder.id, 'processing');
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              await fetchOrder(currentOrder.id);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to update order');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkFulfilled = () => {
    if (!currentOrder || !user) return;

    Alert.alert(
      'Fulfill Order',
      'Mark this order as fulfilled? This indicates the order is complete.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Fulfilled',
          onPress: async () => {
            try {
              setIsUpdating(true);
              await updateOrderStatus(currentOrder.id, 'fulfilled', user.id);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              await fetchOrder(currentOrder.id);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to fulfill order');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    if (!currentOrder) return;

    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUpdating(true);
              await cancelOrder(currentOrder.id);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
              await fetchOrder(currentOrder.id);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel order');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

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

  if (!orderId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.page }}>
        <EmptyState
          icon="alert-circle-outline"
          tone="alert"
          title="Invalid order link"
          body="This link does not point at an order."
          action={{ label: 'Go back', onPress: handleBackPress }}
        />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.page }}>
        <EmptyState
          icon="alert-circle-outline"
          tone="alert"
          title="Unable to load order"
          body={loadError}
          action={{ label: 'Go back', onPress: handleBackPress }}
        />
      </SafeAreaView>
    );
  }

  const isCurrentOrderLoaded = currentOrder?.id === orderId;

  if (isLoading || !isCurrentOrderLoaded || !currentOrder) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.page }}>
        <Loading label="Loading order" />
      </SafeAreaView>
    );
  }

  const isManagerView = user?.role === 'manager' && viewMode === 'manager';
  const isEmployeeView = !isManagerView;
  const canMarkProcessing = currentOrder.status === 'submitted' && isManagerView;
  const canMarkFulfilled = currentOrder.status === 'processing' && isManagerView;
  const canCancelAsManager =
    (currentOrder.status === 'submitted' || currentOrder.status === 'processing') && isManagerView;
  const isFulfilled = currentOrder.status === 'fulfilled';
  const isCancelled = currentOrder.status === 'cancelled';
  const isCancelRequested = currentOrder.status === 'cancel_requested';

  const minutesSinceCreated = Math.floor(
    (Date.now() - new Date(currentOrder.created_at).getTime()) / (1000 * 60)
  );
  const withinEmployeeCancelWindow = minutesSinceCreated <= 10;
  const isCancellableStatus =
    currentOrder.status === 'submitted' || currentOrder.status === 'processing';
  const showEmployeeCancellationAction =
    isEmployeeView &&
    isCancellableStatus && !isFulfilled && !isCancelled && !isCancelRequested;
  const canEmployeeCancelNow = showEmployeeCancellationAction && withinEmployeeCancelWindow;

  const renderOrderItem = ({ item }: { item: OrderItemWithInventory }) => {
    // Category tints stay a reserved set for inventory glyphs, per the contract.
    const categoryColor = categoryColors[item.inventory_item.category] || color.ink2;
    const unitLabel =
      item.unit_type === 'base'
        ? item.inventory_item.base_unit
        : item.inventory_item.pack_unit;
    const lineNote = typeof item.note === 'string' && item.note.trim().length > 0
      ? item.note.trim()
      : null;

    return (
      <Card style={{ marginBottom: ds.spacing(space[3]) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: ds.spacing(space[3]) }}>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              {item.inventory_item.name}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: ds.spacing(space[2]),
                paddingHorizontal: ds.spacing(space[2] + 2),
                paddingVertical: ds.spacing(space[1]),
                borderRadius: radius.control,
                backgroundColor: categoryColor + '20',
              }}
            >
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.caption),
                  fontWeight: weight.semibold,
                  color: categoryColor,
                }}
              >
                {getCategoryLabel(item.inventory_item.category)}
              </Text>
            </View>
            {lineNote && (
              <View
                style={{
                  marginTop: ds.spacing(space[2]),
                  backgroundColor: color.well,
                  borderRadius: radius.control,
                  paddingHorizontal: ds.spacing(space[2] + 2),
                  paddingVertical: ds.spacing(space[2]),
                }}
              >
                <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>Note</SectionLabel>
                <Text
                  style={{
                    marginTop: ds.spacing(space[1] / 2),
                    fontSize: ds.fontSize(typeScale.secondary),
                    color: color.ink2,
                  }}
                >
                  {lineNote}
                </Text>
              </View>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.title),
                fontWeight: weight.bold,
                color: color.ink,
              }}
            >
              {item.quantity}
            </Text>
            <Text style={{ fontSize: ds.fontSize(typeScale.secondary), color: color.ink2 }}>
              {unitLabel}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const metaRow = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    value: string,
    first = false,
  ) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(space[3]),
        paddingVertical: ds.spacing(space[2]),
        borderTopWidth: first ? 0 : 1,
        borderTopColor: color.hairline,
      }}
    >
      <Ionicons name={icon} size={ds.icon(18)} color={color.ink2} />
      <View style={{ flex: 1 }}>
        <SectionLabel style={{ marginTop: 0, marginBottom: 0 }}>{label}</SectionLabel>
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.body),
            fontWeight: weight.semibold,
            color: color.ink,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: color.page }} edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader
          mode="pushed"
          title={`Order #${currentOrder.order_number}`}
          onBack={handleBackPress}
          includeSafeArea={false}
        />

        {/* Order info card */}
        <View style={{ paddingHorizontal: ds.spacing(space[4]) }}>
          <Card>
            {/* Status row */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: ds.spacing(space[3]),
                marginBottom: ds.spacing(space[3]),
              }}
            >
              <View>
                <SectionLabel style={{ marginTop: 0 }}>Status</SectionLabel>
                <StatusPill
                  status={STATUS_TONE[currentOrder.status] ?? 'draft'}
                  label={ORDER_STATUS_LABELS[currentOrder.status]}
                />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <SectionLabel style={{ marginTop: 0 }}>Created</SectionLabel>
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.secondary),
                    fontWeight: weight.semibold,
                    color: color.ink,
                  }}
                >
                  {formatDate(currentOrder.created_at)}
                </Text>
              </View>
            </View>

            {metaRow('person-outline', 'Submitted by', currentOrder.user?.name || 'Unknown', true)}
            {metaRow('location-outline', 'Location', currentOrder.location?.name || 'Unknown Location')}
            {isFulfilled && currentOrder.fulfilled_at
              ? metaRow(
                  'checkmark-circle-outline',
                  'Fulfilled',
                  `${formatDate(currentOrder.fulfilled_at)}${fulfilledByUser ? ` by ${fulfilledByUser}` : ''}`,
                )
              : null}
          </Card>
        </View>

        {/* Items header */}
        <View style={{ paddingHorizontal: ds.spacing(space[4]) }}>
          <SectionLabel>
            {`Order items (${currentOrder.order_items?.length || 0})`}
          </SectionLabel>
        </View>

        {/* Order items list */}
        <FlatList
          data={currentOrder.order_items || []}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: ds.spacing(space[4]),
            paddingBottom: ds.spacing(space[4]),
          }}
          ListEmptyComponent={() => (
            <EmptyState icon="cube-outline" title="No items in this order" compact />
          )}
        />

        {/* Action buttons */}
        {(canMarkProcessing || canMarkFulfilled || currentOrder.status === 'draft' || showEmployeeCancellationAction) && (
          <View
            style={{
              padding: ds.spacing(space[4]),
              backgroundColor: color.card,
              borderTopWidth: 1,
              borderTopColor: color.hairline,
              gap: ds.spacing(space[3]),
            }}
          >
            {/* Draft status: the employee submits */}
            {currentOrder.status === 'draft' && (
              <View style={{ flexDirection: 'row', gap: ds.spacing(space[3]) }}>
                <Button
                  variant="secondary"
                  label="Cancel"
                  onPress={handleCancel}
                  disabled={isUpdating}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Submit order"
                  icon="send"
                  onPress={handleSubmit}
                  loading={isUpdating}
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {/* Submitted status: the manager starts processing */}
            {canMarkProcessing && (
              <View style={{ flexDirection: 'row', gap: ds.spacing(space[3]) }}>
                {canCancelAsManager && (
                  <Button
                    variant="secondary"
                    label="Cancel"
                    onPress={handleCancel}
                    disabled={isUpdating}
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  label="Mark as processing"
                  icon="play-circle"
                  onPress={handleMarkProcessing}
                  loading={isUpdating}
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {/* Processing status: the manager marks it fulfilled */}
            {canMarkFulfilled && (
              <View style={{ flexDirection: 'row', gap: ds.spacing(space[3]) }}>
                {canCancelAsManager && (
                  <Button
                    variant="secondary"
                    label="Cancel"
                    onPress={handleCancel}
                    disabled={isUpdating}
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  label="Mark as fulfilled"
                  icon="checkmark-circle"
                  onPress={handleMarkFulfilled}
                  loading={isUpdating}
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {/* Employee view action */}
            {showEmployeeCancellationAction && (
              <View style={{ gap: ds.spacing(space[2]) }}>
                <Button
                  variant="destructive"
                  label="Cancel order"
                  icon="close-circle"
                  onPress={handleCancel}
                  loading={isUpdating}
                  disabled={!canEmployeeCancelNow}
                  fullWidth
                />
                {!withinEmployeeCancelWindow && (
                  <Text
                    style={{
                      textAlign: 'center',
                      fontSize: ds.fontSize(typeScale.secondary),
                      color: color.ink2,
                    }}
                  >
                    Cancellation is only available within 10 minutes of ordering.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Terminal status message */}
        {(isFulfilled || isCancelled) && (
          <View
            style={{
              padding: ds.spacing(space[4]),
              alignItems: 'center',
              backgroundColor: color.card,
              borderTopWidth: 1,
              borderTopColor: color.hairline,
            }}
          >
            <StatusPill
              status={isFulfilled ? 'fulfilled' : 'cancelled'}
              label={isFulfilled ? 'Order complete' : 'Order cancelled'}
            />
          </View>
        )}
      </SafeAreaView>
    </>
  );
}
