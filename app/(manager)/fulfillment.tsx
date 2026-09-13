import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import { ItemActionSheet, type ItemActionSheetSection } from '@/components';
import {
  Button,
  Card,
  EmptyState,
  Loading,
  ScreenHeader,
  getTabBarClearance,
} from '@/components/ui';
import { LocationPill } from '@/components/ui/LocationPill';
import { showNotice } from '@/components/ui/NoticeSheet';
import { showStudioToast } from '@/components/ui/StudioToast';
import {
  OrderLaterAddToSheet,
  OrderLaterScheduleModal,
  type OrderLaterSupplierOption,
} from '@/features/fulfillment/components';
import {
  isSendableManagerSupplier,
  type ManagerFulfillmentSupplierGroup,
} from '@/features/fulfillment/managerFulfillmentModel';
import { useManagerFulfillmentOverview } from '@/features/fulfillment/useManagerFulfillmentOverview';
import { buildSendAllSuppliersParam } from '@/features/fulfillment/sendAll/sendAllParams';
import { useModuleAccessGuard } from '@/hooks/useMyModules';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { useManagedRefresh } from '@/hooks/useManagedRefresh';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  triggerImpactHaptic,
  triggerNotificationHaptic,
} from '@/lib/haptics';
import { loadSupplierLookup } from '@/services/supplierResolver';
import { useOrderStore } from '@/store';
import type { FulfillmentLocationGroup, OrderLaterItem } from '@/store/orderStore.types';
import { color, motion, radius, tracking, typeScale, weight } from '@/theme/tokens';

const SHEET_TRANSITION_MS = 240;

function stripLocationPrefix(name: string): string {
  return name.replace(/^Babytuna\s+/i, '');
}

function formatOrderDay(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return 'unscheduled';
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function locationGroupFor(item: OrderLaterItem): FulfillmentLocationGroup {
  if (item.preferredLocationGroup) return item.preferredLocationGroup;
  const normalized = (item.locationName ?? '').toLowerCase();
  return normalized.includes('poki') || normalized.includes('poke') ? 'poki' : 'sushi';
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  const ds = useScaledStyles();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: ds.spacing(14),
        paddingBottom: ds.spacing(4),
        paddingHorizontal: ds.spacing(2),
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          fontSize: ds.fontSize(typeScale.caption),
          fontWeight: weight.bold,
          letterSpacing: tracking.caption,
          textTransform: 'uppercase',
          color: color.ink3,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.caption),
          fontWeight: weight.semibold,
          color: color.ink2,
        }}
      >
        {count}
      </Text>
    </View>
  );
}

function SupplierRow({
  group,
  last,
  onPress,
}: {
  group: ManagerFulfillmentSupplierGroup;
  last: boolean;
  onPress: () => void;
}) {
  const ds = useScaledStyles();
  const pressed = useRef(new Animated.Value(0)).current;
  const animatePress = (toValue: number) => Animated.timing(pressed, {
    toValue,
    duration: 120,
    easing: Easing.bezier(...motion.controlEase),
    useNativeDriver: false,
  }).start();
  const peopleLabel = `${group.peopleCount} ${group.peopleCount === 1 ? 'person' : 'people'}`;
  const sendable = isSendableManagerSupplier(group);
  return (
    <Pressable
      onPress={onPress}
      disabled={!sendable}
      accessibilityRole="button"
      accessibilityLabel={`${group.supplierName}, ${group.itemCount} items, ${peopleLabel}`}
      accessibilityHint={sendable ? 'Opens supplier review' : 'Supplier setup is required'}
      accessibilityState={{ disabled: !sendable }}
      onPressIn={() => animatePress(1)}
      onPressOut={() => animatePress(0)}
      style={{ backgroundColor: color.card }}
    >
      <Animated.View style={{
        minHeight: ds.spacing(60),
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(12),
        paddingHorizontal: ds.spacing(14),
        paddingVertical: ds.spacing(10),
        backgroundColor: pressed.interpolate({ inputRange: [0, 1], outputRange: [color.card, color.well] }),
      }}>
        <View
          style={{
            width: ds.icon(38),
            height: ds.icon(38),
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.well,
          }}
        >
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.body),
              fontWeight: weight.semibold,
              color: color.ink2,
            }}
          >
            {(group.supplierName.trim()[0] || '?').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: ds.fontSize(typeScale.body),
              fontWeight: weight.semibold,
              color: color.ink,
            }}
          >
            {group.supplierName}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              marginTop: ds.spacing(2),
              fontSize: ds.fontSize(typeScale.secondary),
              color: color.ink2,
            }}
          >
            {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'} · {peopleLabel}
            {group.remainingCount > 0 ? (
              <Text style={{ color: color.warning }}>
                {' '}· {group.remainingCount} remaining
              </Text>
            ) : null}
            {!sendable ? (
              <Text style={{ color: color.warning }}> · Supplier setup needed</Text>
            ) : null}
          </Text>
        </View>
        <Ionicons
          name={sendable ? 'chevron-forward' : 'alert-circle-outline'}
          size={ds.icon(18)}
          color={sendable ? color.ink3 : color.warning}
        />
        {!last ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: ds.spacing(14),
              right: 0,
              bottom: 0,
              height: 1,
              backgroundColor: color.hairline,
            }}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function OrderLaterRow({
  item,
  last,
  onEdit,
}: {
  item: OrderLaterItem;
  last: boolean;
  onEdit: () => void;
}) {
  const ds = useScaledStyles();
  const pressed = useRef(new Animated.Value(0)).current;
  const animatePress = (toValue: number) => Animated.timing(pressed, {
    toValue,
    duration: 120,
    easing: Easing.bezier(...motion.controlEase),
    useNativeDriver: false,
  }).start();
  const locationName = item.locationName
    ? stripLocationPrefix(item.locationName)
    : 'Unassigned location';
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${item.itemName}, order on ${formatOrderDay(item.scheduledAt)}`}
      onPressIn={() => animatePress(1)}
      onPressOut={() => animatePress(0)}
      style={{ backgroundColor: color.card }}
    >
      <Animated.View style={{
        minHeight: ds.spacing(60),
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(12),
        paddingHorizontal: ds.spacing(14),
        paddingVertical: ds.spacing(10),
        backgroundColor: pressed.interpolate({ inputRange: [0, 1], outputRange: [color.card, color.well] }),
      }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: ds.fontSize(typeScale.body),
              fontWeight: weight.semibold,
              color: color.ink,
            }}
          >
            {item.itemName}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              marginTop: ds.spacing(2),
              fontSize: ds.fontSize(typeScale.secondary),
              color: color.ink2,
            }}
          >
            {locationName} · {item.unit} ·{' '}
            <Text style={{ color: color.warning }}>
              Order on {formatOrderDay(item.scheduledAt)}
            </Text>
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: ds.spacing(9),
            paddingVertical: ds.spacing(5),
            borderRadius: radius.pill,
            backgroundColor: color.well,
          }}
        >
          <Text
            style={{
              fontSize: ds.fontSize(typeScale.caption),
              fontWeight: weight.bold,
              letterSpacing: tracking.caption,
              textTransform: 'uppercase',
              color: color.ink2,
            }}
          >
            Edit
          </Text>
        </View>
        {!last ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: ds.spacing(14),
              right: 0,
              bottom: 0,
              height: 1,
              backgroundColor: color.hairline,
            }}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export default function FulfillmentRoute() {
  const guard = useModuleAccessGuard('fulfillment', '/(manager)');
  if (guard.isChecking) return null;
  if (guard.redirectTo) return <Redirect href={guard.redirectTo} />;
  return <FulfillmentScreen />;
}

function FulfillmentScreen() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const { location, locations, setLocation } = useResolvedActiveLocation();
  const overview = useManagerFulfillmentOverview();
  const { refreshing, onRefresh } = useManagedRefresh(overview.refresh);
  const {
    moveOrderLaterItemToSupplierDraft,
    removeOrderLaterItem,
    updateOrderLaterItemSchedule,
  } = useOrderStore(
    useShallow((state) => ({
      moveOrderLaterItemToSupplierDraft: state.moveOrderLaterItemToSupplierDraft,
      removeOrderLaterItem: state.removeOrderLaterItem,
      updateOrderLaterItemSchedule: state.updateOrderLaterItemSchedule,
    })),
  );
  const [actionsItemId, setActionsItemId] = useState<string | null>(null);
  const [addToItemId, setAddToItemId] = useState<string | null>(null);
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<OrderLaterSupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [isAddingToSupplier, setIsAddingToSupplier] = useState(false);
  const sendTapLockUntilRef = useRef(0);

  const actionsItem = useMemo(
    () => overview.orderLater.find((item) => item.id === actionsItemId) ?? null,
    [actionsItemId, overview.orderLater],
  );
  const addToItem = useMemo(
    () => overview.orderLater.find((item) => item.id === addToItemId) ?? null,
    [addToItemId, overview.orderLater],
  );
  const scheduleItem = useMemo(
    () => overview.orderLater.find((item) => item.id === scheduleItemId) ?? null,
    [overview.orderLater, scheduleItemId],
  );

  const handleOpenSupplier = useCallback((group: ManagerFulfillmentSupplierGroup) => {
    if (!isSendableManagerSupplier(group)) return;
    if (Date.now() < sendTapLockUntilRef.current) return;
    sendTapLockUntilRef.current = Date.now() + 700;
    void triggerImpactHaptic(ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(manager)/fulfillment-confirmation',
      params: {
        supplier: group.supplierId,
        supplierLabel: group.supplierName,
        from: 'fulfillment',
        items: encodeURIComponent(JSON.stringify(group.regularItems)),
        remaining: encodeURIComponent(JSON.stringify(group.remainingItems)),
      },
    });
  }, []);

  const handleSendAll = useCallback(() => {
    if (Date.now() < sendTapLockUntilRef.current) return;
    sendTapLockUntilRef.current = Date.now() + 700;
    const sendable = overview.groups.filter(isSendableManagerSupplier);
    if (sendable.length === 0) {
      showNotice('Nothing to Send', 'There are no supplier orders ready to send.');
      return;
    }
    void triggerImpactHaptic(ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(manager)/fulfillment-send-all',
      params: {
        suppliers: buildSendAllSuppliersParam(
          sendable.map((group) => ({ id: group.supplierId })),
        ),
      },
    });
  }, [overview.groups]);

  const loadSupplierOptions = useCallback(async (item: OrderLaterItem) => {
    setSupplierError(null);
    try {
      const lookup = await loadSupplierLookup();
      const options = lookup.suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.active ? supplier.name : `${supplier.name} (Inactive)`,
      }));
      setSupplierOptions(options);
      const preferred = item.preferredSupplierId ?? item.suggestedSupplierId;
      setSelectedSupplierId(
        options.some((option) => option.id === preferred)
          ? preferred
          : options[0]?.id ?? null,
      );
    } catch (error) {
      setSupplierOptions([]);
      setSelectedSupplierId(null);
      setSupplierError(
        error instanceof Error ? error.message : 'Unable to load suppliers.',
      );
    }
  }, []);

  const openAddToSupplier = useCallback((item: OrderLaterItem) => {
    setActionsItemId(null);
    setTimeout(() => {
      setAddToItemId(item.id);
      void loadSupplierOptions(item);
    }, SHEET_TRANSITION_MS);
  }, [loadSupplierOptions]);

  const openSchedule = useCallback((item: OrderLaterItem) => {
    setActionsItemId(null);
    setTimeout(() => setScheduleItemId(item.id), SHEET_TRANSITION_MS);
  }, []);

  const handleRemove = useCallback((item: OrderLaterItem) => {
    setActionsItemId(null);
    showNotice('Remove Item', `Remove ${item.itemName} from Order Later?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeOrderLaterItem(item.id)
            .then(() => overview.refresh())
            .then(() => {
              void triggerNotificationHaptic(NotificationFeedbackType.Warning);
              showStudioToast(`${item.itemName} removed`);
            })
            .catch((error: unknown) => {
              showNotice(
                'Unable to Remove Item',
                error instanceof Error ? error.message : 'Please try again.',
              );
            });
        },
      },
    ]);
  }, [overview, removeOrderLaterItem]);

  const actionSections = useMemo<ItemActionSheetSection[]>(() => {
    if (!actionsItem) return [];
    return [
      {
        id: 'order-later',
        items: [
          {
            id: 'schedule',
            label: 'Edit schedule',
            icon: 'calendar-outline',
            onPress: () => openSchedule(actionsItem),
          },
          {
            id: 'supplier',
            label: 'Add to supplier',
            icon: 'add-circle-outline',
            onPress: () => openAddToSupplier(actionsItem),
          },
          {
            id: 'remove',
            label: 'Remove from Order Later',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => handleRemove(actionsItem),
          },
        ],
      },
    ];
  }, [actionsItem, handleRemove, openAddToSupplier, openSchedule]);

  const handleAddToSupplier = useCallback(async () => {
    if (!addToItem || !selectedSupplierId || isAddingToSupplier) return;
    setIsAddingToSupplier(true);
    setSupplierError(null);
    try {
      await moveOrderLaterItemToSupplierDraft(
        addToItem.id,
        selectedSupplierId,
        locationGroupFor(addToItem),
        {
          locationId: addToItem.locationId,
          locationName: addToItem.locationName,
        },
      );
      setAddToItemId(null);
      await overview.refresh();
      void triggerNotificationHaptic(NotificationFeedbackType.Success);
      showStudioToast(`${addToItem.itemName} added to supplier`);
    } catch (error) {
      setSupplierError(
        error instanceof Error ? error.message : 'Unable to add this item.',
      );
    } finally {
      setIsAddingToSupplier(false);
    }
  }, [
    addToItem,
    isAddingToSupplier,
    moveOrderLaterItemToSupplierDraft,
    overview,
    selectedSupplierId,
  ]);

  const sendableSupplierCount = useMemo(
    () => overview.groups.filter(isSendableManagerSupplier).length,
    [overview.groups],
  );

  const headerSubtitle = `${overview.supplierCount} ${overview.supplierCount === 1 ? 'supplier' : 'suppliers'} · ${overview.totalItems} items to send`;
  const bottomClearance = getTabBarClearance(insets.bottom);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.page }}>
      <ScreenHeader
        title="Fulfillment"
        subtitle={headerSubtitle}
        includeSafeArea={false}
        right={
          <LocationPill
            location={location}
            locations={locations}
            onSelect={(nextLocation) => {
              void triggerImpactHaptic(ImpactFeedbackStyle.Light);
              setLocation(nextLocation);
            }}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: ds.spacing(16),
          paddingTop: ds.spacing(2),
          paddingBottom: bottomClearance,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.accent}
          />
        }
      >
        <SectionHeading label="Order notes" count={overview.totalNotes} />
        <Card flush>
          {overview.notes.length > 0 ? (
            overview.notes.map((note, index) => (
              <View
                key={note.id}
                style={{
                  minHeight: ds.spacing(60),
                  justifyContent: 'center',
                  paddingHorizontal: ds.spacing(14),
                  paddingVertical: ds.spacing(10),
                }}
              >
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.body),
                    fontWeight: weight.semibold,
                    color: color.ink,
                  }}
                >
                  {note.author} · {note.shortCode}
                </Text>
                <Text
                  style={{
                    marginTop: ds.spacing(2),
                    fontSize: ds.fontSize(typeScale.secondary),
                    color: color.ink2,
                  }}
                >
                  {note.text}
                </Text>
                {index < overview.notes.length - 1 ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: ds.spacing(14),
                      right: 0,
                      bottom: 0,
                      height: 1,
                      backgroundColor: color.hairline,
                    }}
                  />
                ) : null}
              </View>
            ))
          ) : (
            <View style={{ padding: ds.spacing(14) }}>
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.secondary),
                  color: color.ink2,
                }}
              >
                No order notes.
              </Text>
            </View>
          )}
        </Card>

        <SectionHeading label="Suppliers" count={overview.supplierCount} />
        {overview.isLoading && overview.groups.length === 0 ? (
          <Card>
            <Loading label="Loading suppliers" />
          </Card>
        ) : overview.error && overview.groups.length === 0 ? (
          <EmptyState
            icon="cloud-offline-outline"
            tone="alert"
            title="Unable to load suppliers"
            body={overview.error}
            action={{ label: 'Retry', onPress: () => void overview.refresh() }}
          />
        ) : overview.groups.length > 0 ? (
          <Card flush>
            {overview.groups.map((group, index) => (
              <SupplierRow
                key={group.supplierId}
                group={group}
                last={index === overview.groups.length - 1}
                onPress={() => handleOpenSupplier(group)}
              />
            ))}
          </Card>
        ) : (
          <Card>
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink2,
                textAlign: 'center',
              }}
            >
              No supplier orders are waiting.
            </Text>
          </Card>
        )}

        {overview.groups.length > 0 ? (
          <Button
            label={`Send all · ${sendableSupplierCount} ${sendableSupplierCount === 1 ? 'supplier' : 'suppliers'}`}
            icon="paper-plane-outline"
            onPress={handleSendAll}
            disabled={sendableSupplierCount === 0}
            accessibilityHint={
              sendableSupplierCount < overview.supplierCount
                ? 'Sends suppliers that are configured. Resolve the other supplier rows separately.'
                : undefined
            }
            style={{ marginTop: ds.spacing(12) }}
          />
        ) : null}

        <SectionHeading label="Order later" count={overview.orderLater.length} />
        <Card flush>
          {overview.orderLater.length > 0 ? (
            overview.orderLater.map((item, index) => (
              <OrderLaterRow
                key={item.id}
                item={item}
                last={index === overview.orderLater.length - 1}
                onEdit={() => setActionsItemId(item.id)}
              />
            ))
          ) : (
            <View style={{ padding: ds.spacing(14) }}>
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.secondary),
                  color: color.ink2,
                }}
              >
                Nothing scheduled.
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      <ItemActionSheet
        visible={actionsItem !== null}
        title="Order Later"
        subtitle={actionsItem?.itemName}
        sections={actionSections}
        onClose={() => setActionsItemId(null)}
      />

      <OrderLaterAddToSheet
        visible={addToItem !== null}
        itemName={addToItem?.itemName}
        suppliers={supplierOptions}
        selectedSupplierId={selectedSupplierId}
        supplierError={supplierError}
        isSubmitting={isAddingToSupplier}
        onSupplierChange={(supplierId) => {
          setSelectedSupplierId(supplierId);
          setSupplierError(null);
        }}
        onConfirm={() => void handleAddToSupplier()}
        onClose={() => {
          if (!isAddingToSupplier) setAddToItemId(null);
        }}
      />

      <OrderLaterScheduleModal
        visible={scheduleItem !== null}
        title="Edit schedule"
        initialScheduledAt={scheduleItem?.scheduledAt}
        onClose={() => setScheduleItemId(null)}
        onConfirm={async (scheduledAt) => {
          if (!scheduleItem) return;
          await updateOrderLaterItemSchedule(scheduleItem.id, scheduledAt);
          await overview.refresh();
          void triggerNotificationHaptic(NotificationFeedbackType.Success);
          showStudioToast(`${scheduleItem.itemName} schedule updated`);
        }}
      />
    </SafeAreaView>
  );
}
