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
import { EmptyState, Loading, ScreenHeader, getTabBarClearance } from '@/components/ui';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  ImpactFeedbackStyle,
  triggerImpactHaptic,
} from '@/lib/haptics';
import { useAuthStore } from '@/store';
import { color, space } from '@/theme/tokens';
import {
  buildStationCardModel,
  StationCard,
  type StationCardModel,
  StationSeparator,
} from './components/StationCard';
import {
  computeAreaProgress,
  useStockCheckStore,
} from './useStockCheckStore';

function PastChecksScreenImpl() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();

  const location = useAuthStore((state) => state.location);
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

  useEffect(() => {
    if (location?.id) {
      void loadLocation(location.id);
    }
  }, [loadLocation, location?.id]);

  const completedStationCards = useMemo(
    () =>
      areas
        .map((area) =>
          buildStationCardModel(
            area,
            computeAreaProgress(area, itemsById),
          ),
        )
        .filter((model) => model.statusLabel === 'DONE'),
    [areas, itemsById],
  );

  const handleBack = useCallback(() => {
    void triggerImpactHaptic(ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!location?.id) return;
    setRefreshing(true);
    try {
      await loadLocation(location.id);
    } finally {
      setRefreshing(false);
    }
  }, [loadLocation, location?.id]);

  const handleOpenStation = useCallback((stationId: string) => {
    void triggerImpactHaptic(ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(tabs)/stock-check-list',
      params: { stationId },
    } as never);
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

  // The floating pill hovers over this list too, so the last card scrolls clear.
  const floatingChromeClearance = getTabBarClearance(insets.bottom);

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        icon="checkmark-done-outline"
        title="No completed checks yet"
        body="Stations you finish appear here."
      />
    ),
    [],
  );

  const header = (
    <ScreenHeader
      mode="pushed"
      title="Past checks"
      onBack={handleBack}
      backAccessibilityLabel="Back to stock check"
      includeSafeArea={false}
      style={{ paddingHorizontal: 0 }}
    />
  );

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
            body="Choose a location to view completed checks."
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
        <Loading label="Loading past checks" />
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
            title="We could not load your completed checks."
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
        data={completedStationCards}
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
        ListHeaderComponent={header}
        ListEmptyComponent={ListEmptyComponent}
        ItemSeparatorComponent={StationSeparator}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

export const PastChecksScreen = memo(PastChecksScreenImpl);
