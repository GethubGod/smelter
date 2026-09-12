import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, EmptyState, ListRow, Loading, ScreenHeader, SectionLabel, getTabBarClearance } from '@/components/ui';
import { LocationPill } from '@/components/ui/LocationPill';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { ImpactFeedbackStyle, triggerImpactHaptic } from '@/lib/haptics';
import { color, radius, typeScale, weight } from '@/theme/tokens';
import { useSimpleOrderUiStore } from '@/store/simpleOrderUiStore';
import { locationGroupForLocation } from '@/features/simpleOrder/checklistSelection';
import { OrderDetailSheet } from './components/OrderDetailSheet';
import { formatHistoryDate, formatSentTime, listMyOrderHistory, type RecentOrder } from './recentOrders';

export function HistoryScreen() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const { location, locations, setLocation } = useResolvedActiveLocation();
  const setPendingReorder = useSimpleOrderUiStore(state => state.setPendingReorder);
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detailOrder, setDetailOrder] = useState<RecentOrder | null>(null);
  const loadGeneration = useRef(0);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoadError(null);
    try { const result = await listMyOrderHistory(location?.id, locationGroupForLocation(location?.name, location?.short_code)); if (generation === loadGeneration.current) setOrders(result); }
    catch (error) { if (generation === loadGeneration.current) setLoadError(error instanceof Error ? error.message : 'Could not load your past orders.'); }
  }, [location?.id, location?.name, location?.short_code]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  const reorder = useCallback((order: RecentOrder) => {
    if (!order.reorderItems.length) return;
    void triggerImpactHaptic(ImpactFeedbackStyle.Light);
    setPendingReorder({ items: order.reorderItems, sourceLabel: formatHistoryDate(order.createdAt) });
    router.navigate('/(tabs)/simple-order');
  }, [setPendingReorder]);
  const groups = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return { week: (orders ?? []).filter(order => Date.parse(order.createdAt) >= start.getTime()), earlier: (orders ?? []).filter(order => Date.parse(order.createdAt) < start.getTime()) };
  }, [orders]);
  const rows = (items: RecentOrder[]) => <Card flush>{items.map((order, index) => <ListRow key={order.id} icon="receipt-outline" title={formatHistoryDate(order.createdAt)}
    subtitle={`${order.itemCount ?? order.reorderItems.length} items · ${order.supplierName} · ${formatSentTime(order.createdAt)}`}
    onPress={() => setDetailOrder(order)} last={index === items.length - 1}
    right={order.reorderItems.length ? <Pressable onPress={event => { event.stopPropagation(); reorder(order); }} accessibilityRole="button" accessibilityLabel={`Reorder ${formatHistoryDate(order.createdAt)}`} hitSlop={8}
      style={{ backgroundColor: color.tint, borderRadius: radius.pill, paddingHorizontal: ds.spacing(9), paddingVertical: ds.spacing(5) }}>
      <Text style={{ color: color.accent, fontSize: ds.fontSize(typeScale.caption), fontWeight: weight.bold, textTransform: 'uppercase' }}>Reorder</Text>
    </Pressable> : undefined} />)}</Card>;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.page }}>
    <ScreenHeader title="Past orders" includeSafeArea={false} right={<LocationPill location={location} locations={locations} onSelect={setLocation} />} />
    {orders === null && !loadError ? <Loading label="Loading past orders" /> : loadError ? <EmptyState icon="alert-circle-outline" title="History unavailable" body={loadError} action={{ label: 'Try again', onPress: () => void load() }} /> :
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: ds.spacing(16), paddingTop: ds.spacing(2), paddingBottom: getTabBarClearance(insets.bottom) }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.accent} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}><SectionLabel>This week</SectionLabel><Text style={{ color: color.ink3, fontSize: ds.fontSize(typeScale.caption) }}>{groups.week.length} sent</Text></View>
        {groups.week.length ? rows(groups.week) : null}
        <SectionLabel>Earlier</SectionLabel>
        {groups.earlier.length ? rows(groups.earlier) : <View style={{ alignItems: 'center', paddingVertical: ds.spacing(28), gap: ds.spacing(8) }}>
          <View style={{ width: ds.spacing(56), height: ds.spacing(56), backgroundColor: color.card, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="receipt-outline" size={ds.icon(24)} color={color.ink3} /></View>
          <Text style={{ color: color.ink, fontSize: ds.fontSize(typeScale.body), fontWeight: weight.semibold }}>Nothing older yet</Text>
          <Text style={{ color: color.ink2, fontSize: ds.fontSize(typeScale.secondary) }}>Orders stay here for 90 days.</Text>
        </View>}
      </ScrollView>}
    <OrderDetailSheet order={detailOrder} onClose={() => setDetailOrder(null)} onReorder={reorder} />
  </SafeAreaView>;
}
