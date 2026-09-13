import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { Card, EmptyState, ListRow, Loading, ScreenHeader, getTabBarClearance } from '@/components/ui';
import { LocationPill } from '@/components/ui/LocationPill';
import { useAuthStore, useOrderStore } from '@/store';
import { useModuleAccessGuard } from '@/hooks';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { OrderDetailSheet } from '@/features/simpleOrder/components/OrderDetailSheet';
import { buildReorderItemsFromPayload, formatHistoryDate, formatSentTime, type RecentOrder } from '@/features/simpleOrder/recentOrders';
import { useSimpleOrderUiStore } from '@/store/simpleOrderUiStore';
import { switchViewMode } from '@/lib/switchViewMode';
import { color, radius, typeScale, weight } from '@/theme/tokens';

export default function FulfillmentHistoryRoute() {
  const guard = useModuleAccessGuard('fulfillment', '/(manager)');
  if (guard.isChecking) return null;
  if (guard.redirectTo) return <Redirect href={guard.redirectTo} />;
  return <FulfillmentHistoryScreen />;
}

function FulfillmentHistoryScreen() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore(state => state.user?.id);
  const { location, locations, setLocation } = useResolvedActiveLocation();
  const { pastOrders, fetchPastOrders, flushPendingPastOrderSync } = useOrderStore(useShallow(state => ({ pastOrders: state.pastOrders, fetchPastOrders: state.fetchPastOrders, flushPendingPastOrderSync: state.flushPendingPastOrderSync })));
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecentOrder | null>(null);
  const refresh = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try { await flushPendingPastOrderSync(userId); await fetchPastOrders(userId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load your past orders.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [fetchPastOrders, flushPendingPastOrderSync, userId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const suppliers = useMemo(() => [...new Set(pastOrders.map(order => order.supplierName))], [pastOrders]);
  const rows = useMemo(() => pastOrders.filter(order => Date.parse(order.createdAt) >= Date.now() - 90 * 86400000 && (filter === 'all' || (filter === 'pending' ? order.syncStatus === 'pending_sync' : order.supplierName === filter))), [filter, pastOrders]);
  const chips = [{ key: 'all', label: 'All' }, ...suppliers.map(name => ({ key: name, label: name })), { key: 'pending', label: 'Pending sync' }];
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.page }}>
    <ScreenHeader title="Past orders" includeSafeArea={false} right={<LocationPill location={location} locations={locations} onSelect={setLocation} />} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: ds.spacing(20), paddingTop: ds.spacing(2), paddingBottom: ds.spacing(6), gap: ds.spacing(8) }}>
      {chips.map(chip => <Pressable key={chip.key} accessibilityRole="button" accessibilityState={{ selected: filter === chip.key }} onPress={() => setFilter(chip.key)} style={{ borderRadius: radius.pill, paddingHorizontal: ds.spacing(13), paddingVertical: ds.spacing(8), backgroundColor: filter === chip.key ? color.ink : color.card }}><Text style={{ fontSize: ds.fontSize(typeScale.secondary), fontWeight: weight.semibold, color: filter === chip.key ? color.onAccent : color.ink2 }}>{chip.label}</Text></Pressable>)}
    </ScrollView>
    {loading ? <Loading label="Loading past orders" /> : error ? <EmptyState icon="alert-circle-outline" title="History unavailable" body={error} action={{ label: 'Try again', onPress: () => void refresh() }} /> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: ds.spacing(16), paddingTop: ds.spacing(2), paddingBottom: getTabBarClearance(insets.bottom) }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void refresh(); }} tintColor={color.accent} />}>
      {rows.length ? <Card flush>{rows.map((order, index) => <ListRow key={order.id} icon="receipt-outline" title={order.supplierName} subtitle={`${formatHistoryDate(order.createdAt)} · ${order.itemCount} items · ${formatSentTime(order.createdAt)}`} last={index === rows.length - 1}
        onPress={() => setDetail({ id: order.id, supplierName: order.supplierName, createdAt: order.createdAt, itemCount: order.itemCount, messageText: order.messageText, reorderItems: buildReorderItemsFromPayload(order.payload), status: order.syncStatus === 'pending_sync' ? 'Pending' : 'Sent' })}
        right={<View style={{ paddingHorizontal: ds.spacing(8), paddingVertical: ds.spacing(4), borderRadius: radius.pill, backgroundColor: order.syncStatus === 'pending_sync' ? color.warningBg : color.goodBg }}><Text style={{ fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.bold, textTransform: 'uppercase', color: order.syncStatus === 'pending_sync' ? color.warning : color.good }}>{order.syncStatus === 'pending_sync' ? 'Pending sync' : 'Sent'}</Text></View>} />)}</Card> : <EmptyState icon="receipt-outline" title="No past orders" body="Finalized supplier orders will show up here." />}
    </ScrollView>}
    <OrderDetailSheet order={detail} onClose={() => setDetail(null)} onReorder={order => { useSimpleOrderUiStore.getState().setPendingReorder({ items: order.reorderItems, sourceLabel: formatHistoryDate(order.createdAt) }); switchViewMode('employee', { announce: false }); }} />
  </SafeAreaView>;
}
