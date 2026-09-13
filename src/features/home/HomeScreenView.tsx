import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import {
  Button,
  Card,
  ListRow,
  ScreenHeader,
  SectionLabel,
  getTabBarClearance,
} from '@/components/ui';
import { LocationPill } from '@/components/ui/LocationPill';
import { useManagerFulfillmentOverview } from '@/features/fulfillment/useManagerFulfillmentOverview';
import {
  buildReorderItemsFromPayload,
  formatHistoryDate,
  listMyOrderHistory,
  type RecentOrder,
} from '@/features/simpleOrder/recentOrders';
import { locationGroupForLocation } from '@/features/simpleOrder/checklistSelection';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { switchViewMode } from '@/lib/switchViewMode';
import { useInventoryStore, useOrderStore, type PastOrder } from '@/store';
import { useSimpleOrderUiStore } from '@/store/simpleOrderUiStore';
import { color, radius, space, tracking, typeScale, weight } from '@/theme/tokens';
import type { HomeScreenMode } from './modes';

interface HomeScreenViewProps {
  mode: HomeScreenMode;
}

interface LocationRecentOrder {
  locationId: string;
  order: RecentOrder | null;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function getHomeGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatHomeDate(now: Date): string {
  return `${WEEKDAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`;
}

export function summarizeReorderItems(order: RecentOrder): string {
  const names = Array.from(new Set(order.reorderItems.map((item) => item.itemName)));
  const summary = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${summary}\u2026` : summary;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function normalizedLocationGroup(value: unknown): 'sushi' | 'poki' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('sushi') || normalized === 's') return 'sushi';
  if (normalized.includes('poki') || normalized.includes('pho') || normalized === 'p') {
    return 'poki';
  }
  return null;
}

function payloadForLocation(
  payload: Record<string, unknown>,
  locationId: string,
  locationGroup: 'sushi' | 'poki',
): Record<string, unknown> | null {
  if (
    typeof payload.locationId === 'string' &&
    payload.locationId.trim().length > 0 &&
    payload.locationId !== locationId
  ) {
    return null;
  }
  const payloadGroup =
    normalizedLocationGroup(payload.locationGroup) ??
    normalizedLocationGroup(payload.locationName);
  if (payloadGroup && payloadGroup !== locationGroup) return null;

  const keys = ['regularItems', 'remainingItems'] as const;
  const arrays = keys.map((key) => (Array.isArray(payload[key]) ? payload[key] : []));
  const rows = arrays.flat();
  const carriesRowLocation = rows.some((value) => {
    const row = record(value);
    return Boolean(row?.locationGroup || row?.locationId || row?.locationName);
  });

  if (carriesRowLocation) {
    const matches = (value: unknown) => {
      const row = record(value);
      if (!row) return false;
      if (typeof row.locationId === 'string' && row.locationId === locationId) return true;
      return (
        normalizedLocationGroup(row.locationGroup) === locationGroup ||
        normalizedLocationGroup(row.locationName) === locationGroup
      );
    };
    return {
      ...payload,
      regularItems: arrays[0].filter(matches),
      remainingItems: arrays[1].filter(matches),
    };
  }

  const locations = Array.isArray(payload.locations)
    ? payload.locations
        .map(normalizedLocationGroup)
        .filter((group): group is 'sushi' | 'poki' => group !== null)
    : [];
  if (locations.length > 0 && !locations.includes(locationGroup)) return null;
  if (new Set(locations).size > 1) return null;
  return payload;
}

export function recentManagerArchive(
  pastOrders: PastOrder[],
  locationId: string,
  locationGroup: 'sushi' | 'poki',
): RecentOrder | null {
  const candidates = pastOrders
    .map((order): RecentOrder | null => {
      const payload = payloadForLocation(order.payload, locationId, locationGroup);
      if (!payload) return null;
      const reorderItems = buildReorderItemsFromPayload(payload);
      if (reorderItems.length === 0) return null;
      return {
        id: order.id,
        supplierName: order.supplierName,
        createdAt: order.createdAt,
        itemCount: reorderItems.length,
        messageText: order.messageText,
        reorderItems,
      };
    })
    .filter((order): order is RecentOrder => order !== null)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  return candidates[0] ?? null;
}

function StatTile({ value, label }: { value: number | string; label: string }) {
  const ds = useScaledStyles();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: radius.control,
        backgroundColor: color.well,
        padding: ds.spacing(space[3]),
      }}
    >
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.stat),
          fontWeight: weight.bold,
          color: color.ink,
        }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: ds.fontSize(typeScale.meta), color: color.ink2 }}>
        {label}
      </Text>
    </View>
  );
}

function ManagerHomeContent({ mode }: { mode: HomeScreenMode }) {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();
  const { location, locations, setLocation } = useResolvedActiveLocation();
  const {
    supplierCount,
    totalItems,
    totalNotes,
    isLoading: overviewLoading,
    error: overviewError,
    refresh: refreshOverview,
  } = useManagerFulfillmentOverview();
  const { items, isLoading: inventoryLoading, fetchItems } = useInventoryStore(
    useShallow((state) => ({
      items: state.items,
      isLoading: state.isLoading,
      fetchItems: state.fetchItems,
    })),
  );
  const pastOrders = useOrderStore((state) => state.pastOrders);
  const setPendingReorder = useSimpleOrderUiStore((state) => state.setPendingReorder);
  const [fallbackRecentOrder, setFallbackRecentOrder] = useState<LocationRecentOrder | null>(null);
  const [recentOrderLoading, setRecentOrderLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const recentLoadGeneration = useRef(0);

  const locationGroup = locationGroupForLocation(location?.name, location?.short_code);
  const loadRecentOrder = useCallback(async () => {
    const generation = ++recentLoadGeneration.current;
    if (!location?.id) {
      setFallbackRecentOrder(null);
      setRecentOrderLoading(false);
      return;
    }

    setRecentOrderLoading(true);
    try {
      const orders = await listMyOrderHistory(location.id, locationGroup);
      if (generation !== recentLoadGeneration.current) return;
      setFallbackRecentOrder({
        locationId: location.id,
        order: orders.find((order) => order.reorderItems.length > 0) ?? null,
      });
    } catch {
      if (generation !== recentLoadGeneration.current) return;
      setFallbackRecentOrder(null);
    } finally {
      if (generation === recentLoadGeneration.current) setRecentOrderLoading(false);
    }
  }, [location?.id, locationGroup]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    void loadRecentOrder();
    return () => {
      recentLoadGeneration.current += 1;
    };
  }, [loadRecentOrder]);

  const activeInventory = useMemo(
    () => items.filter((item) => item.active !== false),
    [items],
  );
  const categoryCount = useMemo(
    () => new Set(activeInventory.map((item) => item.category)).size,
    [activeInventory],
  );
  const now = useMemo(() => new Date(), []);
  const bottomPadding = getTabBarClearance(insets.bottom) + ds.spacing(space[6]);
  const overviewHasError = Boolean(overviewError) && !overviewLoading;
  const overviewPending = overviewLoading && supplierCount === 0 && totalItems === 0 && totalNotes === 0;
  const supplierValue = overviewPending ? '\u2026' : supplierCount;
  const itemValue = overviewPending ? '\u2026' : totalItems;
  const noteValue = overviewPending ? '\u2026' : totalNotes;
  const managerArchive = useMemo(
    () =>
      location?.id
        ? recentManagerArchive(pastOrders, location.id, locationGroup)
        : null,
    [location?.id, locationGroup, pastOrders],
  );
  const compatibleFallback = fallbackRecentOrder && fallbackRecentOrder.locationId === location?.id
    ? fallbackRecentOrder.order
    : null;
  const recentOrder = managerArchive ?? (!overviewLoading ? compatibleFallback : null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refreshOverview(),
        fetchItems({ force: true }),
        loadRecentOrder(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchItems, loadRecentOrder, refreshOverview]);

  const handleReorder = useCallback(() => {
    if (!recentOrder) return;
    setPendingReorder({
      items: recentOrder.reorderItems,
      sourceLabel: formatHistoryDate(recentOrder.createdAt),
    });
    switchViewMode('employee', { announce: false });
  }, [recentOrder, setPendingReorder]);

  const reorderTitle = recentOrder
    ? `Reorder last ${new Date(recentOrder.createdAt).toLocaleDateString('en-US', {
        weekday: 'long',
      })}`
    : 'Reorder last order';
  const reorderSubtitle = recentOrder
    ? `${recentOrder.reorderItems.length} items · ${summarizeReorderItems(recentOrder)}`
    : recentOrderLoading || overviewLoading
      ? 'Loading recent orders'
      : 'No recent checklist order';
  const inventorySubtitle = inventoryLoading && activeInventory.length === 0
    ? 'Loading inventory'
    : `${activeInventory.length} items across ${categoryCount} categories`;

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: color.page }}>
      <ScreenHeader
        title={getHomeGreeting(now)}
        subtitle={formatHomeDate(now)}
        right={
          <LocationPill
            location={location}
            locations={locations}
            onSelect={setLocation}
          />
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: ds.spacing(space[4]),
          paddingBottom: bottomPadding,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={color.accent}
          />
        }
      >
        <Card
          style={{
            paddingHorizontal: ds.spacing(space[4]),
            paddingVertical: ds.spacing(space[4]),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: ds.spacing(space[3]),
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.hero),
                fontWeight: weight.bold,
                color: color.ink,
              }}
            >
              Fulfillment
            </Text>
            <View
              style={{
                paddingHorizontal: ds.spacing(space[2] + 1),
                paddingVertical: ds.spacing(space[1] - 1),
                borderRadius: radius.pill,
                backgroundColor: color.warningBg,
              }}
            >
              <Text
                style={{
                  fontSize: ds.fontSize(typeScale.caption),
                  fontWeight: weight.bold,
                  letterSpacing: tracking.tag,
                  textTransform: 'uppercase',
                  color: color.warning,
                }}
              >
                {supplierValue} waiting
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: ds.spacing(space[2]),
              marginTop: ds.spacing(space[3]),
            }}
          >
            <StatTile value={supplierValue} label="suppliers" />
            <StatTile value={itemValue} label="items" />
            <StatTile value={noteValue} label="notes" />
          </View>

          {overviewHasError ? (
            <Text
              style={{
                marginTop: ds.spacing(space[2]),
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.alert,
              }}
            >
              Could not load fulfillment. Pull to refresh.
            </Text>
          ) : null}

          <Button
            label="Review orders ›"
            onPress={() => router.push('/(manager)/fulfillment')}
            style={{ marginTop: ds.spacing(space[3]) }}
          />
        </Card>

        <SectionLabel>Quick actions</SectionLabel>
        <Card flush>
          <ListRow
            icon="repeat-outline"
            title={reorderTitle}
            subtitle={reorderSubtitle}
            onPress={recentOrder ? handleReorder : undefined}
            disabled={!recentOrder}
            chevron={Boolean(recentOrder)}
            style={{ paddingVertical: ds.spacing(space[3]) }}
          />
          <ListRow
            icon="grid-outline"
            title="Browse inventory"
            subtitle={inventorySubtitle}
            onPress={() => router.push(mode.buildBrowseHref())}
            chevron
            style={{ paddingVertical: ds.spacing(space[3]) }}
          />
          <ListRow
            icon="swap-horizontal"
            title="Switch to Employee view"
            subtitle="Place an order from the checklist"
            onPress={() => switchViewMode('employee')}
            chevron
            last
            style={{ paddingVertical: ds.spacing(space[3]) }}
          />
        </Card>

        <SectionLabel>Suggestions</SectionLabel>
        <Card>
          <View
            style={{
              alignItems: 'center',
              paddingHorizontal: ds.spacing(space[4]),
              paddingVertical: ds.spacing(space[5]),
            }}
          >
            <Ionicons name="sparkles-outline" size={ds.icon(28)} color={color.ink3} />
            <Text
              style={{
                marginTop: ds.spacing(space[2]),
                fontSize: ds.fontSize(typeScale.body),
                fontWeight: weight.semibold,
                color: color.ink,
              }}
            >
              Collecting more data
            </Text>
            <Text
              style={{
                marginTop: ds.spacing(space[1]),
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink2,
                textAlign: 'center',
              }}
            >
              Suggestions appear here as more orders are placed.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Employee Home is no longer a visible tab; retain the shared adapter safely. */
export function HomeScreenView({ mode }: HomeScreenViewProps) {
  if (mode.scope === 'employee') {
    return <Redirect href="/(tabs)/simple-order" />;
  }

  return <ManagerHomeContent mode={mode} />;
}
