import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { EmptyState, Loading, getTabBarClearance } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  ImpactFeedbackStyle,
  triggerImpactHaptic,
} from '@/lib/haptics';
import { useAuthStore } from '@/store';
import { color, space } from '@/theme/tokens';
import type { Location } from '@/types';
import { StockCheckHeader } from './components/StockCheckHeader';
import { StockCheckProgressBar } from './components/StockCheckProgressBar';
import {
  buildStationCardModel,
  StationCard,
  type StationCardModel,
  StationSeparator,
} from './components/StationCard';
import {
  computeAreaProgress,
  computeOverallProgress,
  useStockCheckStore,
} from './useStockCheckStore';
import { useStockCheckSync } from './useStockCheckSync';

function StockHomeScreenImpl() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();

  const location = useAuthStore((state) => state.location);
  const allLocations = useAuthStore((state) => state.locations);
  const setAuthLocation = useAuthStore((state) => state.setLocation);

  const loadLocation = useStockCheckStore((s) => s.loadLocation);
  const {
    areas,
    itemsById,
    isLoading,
    loadError,
  } = useStockCheckStore(
    useShallow((s) => ({
      areas: s.areas,
      itemsById: s.itemsById,
      isLoading: s.isLoading,
      loadError: s.loadError,
    })),
  );

  const [refreshing, setRefreshing] = useState(false);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);

  // Counts saved while the API was unreachable go up as soon as it is back.
  useStockCheckSync();

  useEffect(() => {
    if (location?.id) {
      void loadLocation(location.id);
    }
  }, [loadLocation, location?.id]);

  const overallProgress = useMemo(
    () => computeOverallProgress(areas, itemsById),
    [areas, itemsById],
  );

  const stationCards = useMemo(
    () =>
      areas
        .map((area) =>
          buildStationCardModel(
            area,
            computeAreaProgress(area, itemsById),
          ),
        )
        .filter((model) => model.statusLabel !== 'DONE'),
    [areas, itemsById],
  );

  const handleRefresh = useCallback(async () => {
    if (!location?.id) return;
    setRefreshing(true);
    try {
      await loadLocation(location.id);
    } finally {
      setRefreshing(false);
    }
  }, [loadLocation, location?.id]);

  const handleToggleLocationDropdown = useCallback(() => {
    setLocationDropdownOpen((prev) => !prev);
  }, []);

  const handleCloseLocationDropdown = useCallback(() => {
    setLocationDropdownOpen(false);
  }, []);

  const handleSelectLocation = useCallback(
    (next: Location) => {
      if (next.id === location?.id) return;
      setAuthLocation(next);
      void triggerImpactHaptic(ImpactFeedbackStyle.Light);
    },
    [location?.id, setAuthLocation],
  );

  const handleOpenStation = useCallback((stationId: string) => {
    void triggerImpactHaptic(ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(tabs)/stock-check-list',
      params: { stationId },
    } as never);
  }, []);

  const handleOpenPastChecks = useCallback(() => {
    void triggerImpactHaptic(ImpactFeedbackStyle.Light);
    router.push('/(tabs)/past-checks' as never);
  }, []);

  const renderStation = useCallback(
    ({ item }: { item: StationCardModel }) => (
      <StationCard model={item} onPress={handleOpenStation} />
    ),
    [handleOpenStation],
  );

  const keyExtractor = useCallback(
    (item: StationCardModel) => item.area.id,
    [],
  );

  // Stock check is an employee surface: the floating pill toolbar hovers over
  // the station list, so the last card has to scroll clear of it.
  const floatingChromeClearance = getTabBarClearance(insets.bottom);

  if (!location?.id) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: color.page }}
        edges={['top', 'left', 'right']}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="location-outline"
            title="No location selected"
            body="Choose a location to start a stock check."
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && areas.length === 0) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: color.page }}
        edges={['top', 'left', 'right']}
      >
        <Loading label="Loading stock check" />
      </SafeAreaView>
    );
  }

  if (loadError && areas.length === 0) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: color.page }}
        edges={['top', 'left', 'right']}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="alert-circle-outline"
            tone="alert"
            title="We could not load your storage areas."
            body={loadError}
            action={{ label: 'Try again', onPress: () => void loadLocation(location.id) }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.page }}
      edges={['top', 'left', 'right']}
    >
      <FlatList
        data={stationCards}
        keyExtractor={keyExtractor}
        renderItem={renderStation}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={color.accent}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: ds.spacing(space[4]),
          paddingTop: ds.spacing(space[1]),
          paddingBottom: floatingChromeClearance + ds.spacing(space[6]),
        }}
        ListHeaderComponent={
          <View style={{ zIndex: 10 }}>
            <StockCheckHeader
              locationLabel={location.name}
              locations={allLocations}
              selectedLocationId={location.id}
              isDropdownOpen={locationDropdownOpen}
              onToggleDropdown={handleToggleLocationDropdown}
              onSelectLocation={handleSelectLocation}
              onCloseDropdown={handleCloseLocationDropdown}
              onPressMore={handleOpenPastChecks}
              moreAccessibilityLabel="View past checks"
              moreIconName="time-outline"
            />
            <StockCheckProgressBar
              totalItems={overallProgress.totalItems}
              checkedItems={overallProgress.checkedItems}
              itemsToOrder={overallProgress.itemsToOrder}
              labelMode="uncheckedRemaining"
            />
          </View>
        }
        ItemSeparatorComponent={StationSeparator}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

export const StockHomeScreen = memo(StockHomeScreenImpl);
