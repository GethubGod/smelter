import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect, router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants';
import { ManagerScaleContainer } from '@/components/ManagerScaleContainer';
import { ScreenHeader } from '@/components/ui';
import { useAuthStore, useOrderStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { useManagedRefresh } from '@/hooks/useManagedRefresh';
import { useModuleAccessGuard } from '@/hooks';
import {
  listDiscrepancies,
  type ReceiptDiscrepancy,
} from '@/services/orderReceiving';
import { describeDiscrepancyLine } from '@/features/simpleOrder/receiving/receiveLineState';
import { color, radius, typeScale } from '@/theme/tokens';

type DateFilter = 'all' | 'today' | '7d' | '30d';

interface SupplierLookupRow {
  name: string;
  active: boolean;
}

const DATE_FILTER_OPTIONS: { key: DateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
];

function getPastOrderSummary(pastOrder: any) {
  const payload = (pastOrder?.payload || {}) as Record<string, unknown>;
  const regularItems = Array.isArray(payload.regularItems) ? payload.regularItems : [];
  const remainingItems = Array.isArray(payload.remainingItems) ? payload.remainingItems : [];
  const totalItemCountRaw =
    typeof payload.totalItemCount === 'number'
      ? payload.totalItemCount
      : typeof payload.total_item_count === 'number'
        ? payload.total_item_count
        : regularItems.length + remainingItems.length;
  const totalItemCount = Number.isFinite(totalItemCountRaw) ? totalItemCountRaw : 0;

  const locationsRaw = Array.isArray(payload.locations)
    ? payload.locations
    : Array.isArray(payload.location_groups)
      ? payload.location_groups
      : [];
  const locations = locationsRaw
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);

  return {
    totalItemCount,
    locations,
  };
}

function isInDateFilter(createdAt: string, filter: DateFilter) {
  if (filter === 'all') return true;
  const now = Date.now();
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) return false;

  if (filter === 'today') {
    const created = new Date(createdAt);
    const current = new Date();
    return (
      created.getFullYear() === current.getFullYear() &&
      created.getMonth() === current.getMonth() &&
      created.getDate() === current.getDate()
    );
  }

  if (filter === '7d') {
    return createdTime >= now - 7 * 24 * 60 * 60 * 1000;
  }

  if (filter === '30d') {
    return createdTime >= now - 30 * 24 * 60 * 60 * 1000;
  }

  return true;
}

export default function FulfillmentHistoryRoute() {
  // Phase 3: same fulfillment-module gate as the parent fulfillment tab —
  // deep links to a disabled module redirect to manager home.
  const guard = useModuleAccessGuard('fulfillment', '/(manager)');

  if (guard.isChecking) {
    return null;
  }

  if (guard.redirectTo) {
    return <Redirect href={guard.redirectTo} />;
  }

  return <FulfillmentHistoryScreen />;
}

function FulfillmentHistoryScreen() {
  const user = useAuthStore((state) => state.user);
  const { pastOrders, fetchPastOrders, flushPendingPastOrderSync } = useOrderStore(
    useShallow((state) => ({
      pastOrders: state.pastOrders,
      fetchPastOrders: state.fetchPastOrders,
      flushPendingPastOrderSync: state.flushPendingPastOrderSync,
    })),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [supplierById, setSupplierById] = useState<Record<string, SupplierLookupRow>>({});
  const [discrepancies, setDiscrepancies] = useState<ReceiptDiscrepancy[]>([]);

  // 7a: one listDiscrepancies fetch powers both the per-order "Delivery issue"
  // badge and the recent-issues section. Failures are non-fatal — the history
  // list must never break because receiving data is unavailable.
  const loadDiscrepancies = useCallback(async () => {
    try {
      setDiscrepancies(await listDiscrepancies(30));
    } catch (error) {
      console.warn('Unable to load delivery discrepancies.', error);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    const run = async (columns: string) =>
      (supabase as any)
        .from('suppliers')
        .select(columns)
        .order('name', { ascending: true });

    let data: any[] | null = null;
    let error: any = null;

    ({ data, error } = await run('id,name,active'));
    if (error?.code === '42703') {
      ({ data, error } = await run('id,name'));
    }
    if (error) {
      console.warn('Unable to load suppliers for past-orders list.', error);
      return;
    }

    const lookup: Record<string, SupplierLookupRow> = {};
    (Array.isArray(data) ? data : []).forEach((row) => {
      const id = typeof row?.id === 'string' ? row.id.trim() : '';
      const name = typeof row?.name === 'string' ? row.name.trim() : '';
      if (!id || !name) return;
      lookup[id] = {
        name,
        active: row?.active !== false,
      };
    });

    setSupplierById(lookup);
  }, []);

  const refreshData = useCallback(async () => {
    const managerId = user?.id ?? null;
    await flushPendingPastOrderSync(managerId);
    await Promise.all([fetchPastOrders(managerId), loadSuppliers(), loadDiscrepancies()]);
  }, [fetchPastOrders, flushPendingPastOrderSync, loadDiscrepancies, loadSuppliers, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshData();
    }, [refreshData])
  );

  const { refreshing, onRefresh } = useManagedRefresh(refreshData);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    return pastOrders.filter((row) => {
      if (!isInDateFilter(row.createdAt, dateFilter)) return false;
      if (!normalizedSearch) return true;
      const supplierLookup = row.supplierId ? supplierById[row.supplierId] : null;
      const fallbackName =
        typeof row.supplierId === 'string' && row.supplierId.length > 0
          ? `Unknown Supplier (${row.supplierId.slice(0, 8)})`
          : 'Unknown Supplier';
      const displayName = (supplierLookup?.name || row.supplierName || fallbackName).toLowerCase();
      return displayName.includes(normalizedSearch);
    });
  }, [dateFilter, normalizedSearch, pastOrders, supplierById]);

  const orderIdsWithIssues = useMemo(
    () => new Set(discrepancies.map((entry) => entry.pastOrderId)),
    [discrepancies],
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: color.page }} edges={['top', 'left', 'right']}>
      <ManagerScaleContainer>
        <ScreenHeader
          title="Past Orders"
          subtitle={`${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'}`}
          mode="pushed"
          onBack={() => router.replace('/(manager)/fulfillment')}
          includeSafeArea={false}
          style={{ backgroundColor: color.card, borderBottomWidth: 1, borderColor: color.hairline }}
        />

        <View className="px-4 pt-4 pb-2" style={{ backgroundColor: color.page }}>
          <View className="border px-3 py-2.5 flex-row items-center" style={{ backgroundColor: color.card, borderRadius: radius.control, borderColor: color.hairlineStrong }}>
            <Ionicons name="search-outline" size={16} color={colors.gray[400]} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search supplier"
              placeholderTextColor={colors.gray[400]}
              className="ml-2 flex-1" style={{ fontSize: typeScale.body, color: color.ink }}
            />
          </View>
          <View className="flex-row mt-3">
            {DATE_FILTER_OPTIONS.map((option) => {
              const selected = option.key === dateFilter;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setDateFilter(option.key)}
                  className={`px-3 py-2 mr-2 ${selected ? '' : 'border'}`} style={{ borderRadius: radius.pill, backgroundColor: selected ? color.accent : color.card, borderColor: selected ? undefined : color.hairlineStrong }}
                >
                  <Text className="font-semibold" style={{ fontSize: typeScale.secondary, color: selected ? color.onAccent : color.ink2 }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
            />
          }
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListHeaderComponent={
            discrepancies.length > 0 ? (
              <View className="border px-4 py-3 mb-4" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.alert }}>
                <View className="flex-row items-center mb-2">
                  <Ionicons name="alert-circle" size={16} color={colors.red} />
                  <Text className="ml-1.5 font-bold" style={{ fontSize: typeScale.body, color: color.ink }}>
                    Delivery issues (last 30 days)
                  </Text>
                </View>
                {discrepancies.slice(0, 5).map((entry) => (
                  <View
                    key={entry.line.id}
                    className="flex-row items-start py-1.5 border-t" style={{ borderColor: color.hairline }}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="font-semibold" style={{ fontSize: typeScale.body, color: color.ink }} numberOfLines={1}>
                        {entry.line.itemName}
                        <Text className="font-normal" style={{ color: color.alert }}>
                          {'  '}
                          {describeDiscrepancyLine(entry.line)}
                        </Text>
                      </Text>
                      <Text className="mt-0.5" style={{ fontSize: typeScale.secondary, color: color.ink2 }} numberOfLines={1}>
                        {entry.supplierName}
                        {entry.employee?.name ? ` • ${entry.employee.name}` : ''}
                        {entry.receiptReceivedAt
                          ? ` • ${new Date(entry.receiptReceivedAt).toLocaleDateString()}`
                          : ''}
                      </Text>
                    </View>
                  </View>
                ))}
                {discrepancies.length > 5 && (
                  <Text className="mt-1.5" style={{ fontSize: typeScale.secondary, color: color.ink3 }}>
                    +{discrepancies.length - 5} more flagged item
                    {discrepancies.length - 5 === 1 ? '' : 's'}
                  </Text>
                )}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const summary = getPastOrderSummary(item);
            const dateLabel = new Date(item.createdAt).toLocaleString();

            return (
              <TouchableOpacity
                onPress={() =>
                    router.push({
                      pathname: '/(manager)/past-orders/[id]',
                      params: { id: item.id },
                    } as any)
                }
                className="border px-4 py-3" style={{ backgroundColor: color.card, borderRadius: radius.card, borderColor: color.hairline }}
                activeOpacity={0.7}
              >
                {(() => {
                  const supplierLookup = item.supplierId ? supplierById[item.supplierId] : null;
                  const fallbackName =
                    typeof item.supplierId === 'string' && item.supplierId.length > 0
                      ? `Unknown Supplier (${item.supplierId.slice(0, 8)})`
                      : 'Unknown Supplier';
                  const supplierLabel = supplierLookup?.name || item.supplierName || fallbackName;
                  const supplierInactive = supplierLookup ? supplierLookup.active === false : false;
                  return (
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center">
                      <Text className="font-semibold" style={{ fontSize: typeScale.body, color: color.ink }}>{supplierLabel}</Text>
                      {supplierInactive && (
                        <View className="ml-2 border px-2 py-0.5" style={{ borderRadius: radius.pill, borderColor: color.warning, backgroundColor: color.warningBg }}>
                          <Text className="font-semibold" style={{ fontSize: typeScale.caption, color: color.warning }}>Inactive</Text>
                        </View>
                      )}
                      {item.syncStatus === 'pending_sync' && (
                        <View className="ml-2 border px-2 py-0.5" style={{ borderRadius: radius.pill, borderColor: color.warning, backgroundColor: color.warningBg }}>
                          <Text className="font-semibold" style={{ fontSize: typeScale.caption, color: color.warning }}>Pending sync</Text>
                        </View>
                      )}
                    </View>
                    <Text className="mt-1" style={{ fontSize: typeScale.secondary, color: color.ink2 }}>{dateLabel}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.gray[400]} />
                </View>
                  );
                })()}

                <View className="flex-row items-center mt-3">
                  <View className="px-2.5 py-1 mr-2" style={{ borderRadius: radius.pill, backgroundColor: color.well }}>
                    <Text className="font-semibold" style={{ fontSize: typeScale.caption, color: color.ink2 }}>
                      {item.itemCount} item{item.itemCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {orderIdsWithIssues.has(item.id) && (
                    <View className="px-2.5 py-1 mr-2" style={{ borderRadius: radius.pill, backgroundColor: color.alertBg }}>
                      <Text className="font-semibold" style={{ fontSize: typeScale.caption, color: color.alert }}>
                        Delivery issue
                      </Text>
                    </View>
                  )}
                  {item.remainingCount > 0 && (
                    <View className="px-2.5 py-1 mr-2" style={{ borderRadius: radius.pill, backgroundColor: color.warningBg }}>
                      <Text className="font-semibold" style={{ fontSize: typeScale.caption, color: color.warning }}>
                        {item.remainingCount} remaining
                      </Text>
                    </View>
                  )}
                  {summary.locations.length > 0 && (
                    <Text style={{ fontSize: typeScale.secondary, color: color.ink2 }}>
                      {summary.locations.join(', ')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Ionicons name="time-outline" size={40} color={colors.gray[300]} />
              <Text className="mt-3" style={{ color: color.ink2, fontSize: typeScale.body }}>No past orders</Text>
              <Text className="mt-1 text-center px-10" style={{ color: color.ink3, fontSize: typeScale.body }}>
                Finalized supplier orders will show up here.
              </Text>
            </View>
          }
        />
      </ManagerScaleContainer>
    </SafeAreaView>
  );
}
