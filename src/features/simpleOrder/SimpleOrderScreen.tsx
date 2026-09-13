import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  RefreshControl,
  ScrollView,
  SectionList,
  type SectionListScrollParams,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FullWindowOverlay } from 'react-native-screens';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { Button, EmptyState, Loading, ScreenHeader, getTabBarClearance } from '@/components/ui';
import { LocationPill } from '@/components/ui/LocationPill';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  triggerConfirmationHaptic,
  triggerImpactHaptic,
  triggerNotificationHaptic,
} from '@/lib/haptics';
import {
  getOrGenerateMyChecklist,
  prepareDirectSend,
  regenerateMyChecklist,
  saveChecklistAsDefault,
  sendChecklistOrder,
  type Checklist,
  type DirectSendGroup,
} from '@/services/orderChecklist';
import { getMyOrderSendMode, type OrderSendMode } from '@/services/orderSendMode';
import type { SendAllQueueProgress } from '@/features/fulfillment/sendAll/sendAllQueue';
import { useAuthStore, useInventoryStore, useSettingsStore } from '@/store';
import { useSimpleOrderUiStore } from '@/store/simpleOrderUiStore';
import { color, motion, radius, tracking, typeScale, weight } from '@/theme/tokens';
import type { InventoryItem, Location } from '@/types';
import {
  addedLineKey,
  buildDefaultLines,
  buildSendLines,
  EMPTY_SELECTION_STATE,
  getCheckedLines,
  locationGroupForLocation,
  selectionReducer,
  type SelectionLine,
  type SelectionState,
} from './checklistSelection';
import { buildDirectSendLines } from './directSendFlow';
import { deriveDisplaySections, type DisplaySection } from './displaySections';
import {
  buildCatalogSearchIndex,
  filterCatalogSearchIndex,
  type VoiceAddition,
} from './catalogSearch';
import { unitOptionsForLine } from './unitOptions';
import { ChecklistItemRow } from './components/ChecklistItemRow';
import { ChecklistSettingsSheet } from './components/ChecklistSettingsSheet';
import { ChecklistToast, type ChecklistToastState } from './components/ChecklistToast';
import { ConfirmOrderSheet } from './components/ConfirmOrderSheet';
import { DirectSendQueue } from './components/DirectSendQueue';
import { NoteSheet } from './components/NoteSheet';
import { PinnedOrderBar } from './components/PinnedOrderBar';
import { QuantityCardSheet } from './components/QuantityCardSheet';
import { QuickActionsSheet, type QuickAction } from './components/QuickActionsSheet';
import { VoiceAddSheet } from './components/VoiceAddSheet';

const SHEET_TRANSITION_MS = 240;

interface SentOrderResult {
  orderId: string;
  itemCount: number;
}

function OrderSuccess({
  result,
  onDone,
}: {
  result: SentOrderResult;
  onDone: () => void;
}) {
  const ds = useScaledStyles();
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: motion.dur, easing: Easing.bezier(...motion.controlEase) });
    progress.value = withTiming(1, {
      duration: 420,
      easing: Easing.bezier(...motion.pop),
    });
  }, [opacity, progress]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + progress.value * 0.4 }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <FullWindowOverlay unstable_accessibilityContainerViewIsModal>
    <Animated.View
      key={result.orderId}
      style={[{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: color.page,
        alignItems: 'center',
        justifyContent: 'center',
        gap: ds.spacing(10),
        padding: ds.spacing(40),
      }, overlayStyle]}
    >
      <Animated.View
        style={[
          {
            width: 88,
            height: 88,
            marginBottom: ds.spacing(8),
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.goodBg,
          },
          ringStyle,
        ]}
      >
        <Ionicons name="checkmark" size={ds.icon(44)} color={color.good} />
      </Animated.View>
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.stat),
          fontWeight: weight.bold,
          color: color.ink,
        }}
      >
        Order sent
      </Text>
      <Text
        style={{
          marginBottom: ds.spacing(14),
          fontSize: ds.fontSize(typeScale.itemDense),
          color: color.ink2,
          textAlign: 'center',
        }}
      >
        {result.itemCount === 1 ? '1 item' : `${result.itemCount} items`} went to
        your manager for review.
      </Text>
      <Button
        label="Done"
        onPress={onDone}
        fullWidth={false}
        style={{ alignSelf: 'center' }}
        accessibilityHint="Returns to the checklist"
      />
    </Animated.View>
    </FullWindowOverlay>
  );
}

export function SimpleOrderScreen() {
  const ds = useScaledStyles();
  const insets = useSafeAreaInsets();

  const { location, locations, setLocation } = useResolvedActiveLocation();
  const fetchLocations = useAuthStore((state) => state.fetchLocations);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { items: inventoryItems, fetchItems } = useInventoryStore(
    useShallow((state) => ({
      items: state.items,
      fetchItems: state.fetchItems,
    })),
  );
  const density = useSettingsStore((state) => state.simpleOrderDensity);
  const setSimpleOrderDensity = useSettingsStore(
    (state) => state.setSimpleOrderDensity,
  );
  const showCategories = useSettingsStore((state) => state.simpleOrderShowCategories);
  const setShowCategories = useSettingsStore(
    (state) => state.setSimpleOrderShowCategories,
  );

  const quickActionsToken = useSimpleOrderUiStore((state) => state.quickActionsToken);
  const consumePendingReorder = useSimpleOrderUiStore(
    (state) => state.consumePendingReorder,
  );

  const locationGroup = useMemo(
    () => locationGroupForLocation(location?.name, location?.short_code),
    [location?.name, location?.short_code],
  );

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [selection, dispatch] = useReducer(selectionReducer, EMPTY_SELECTION_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displaySheetVisible, setDisplaySheetVisible] = useState(false);
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);
  const [note, setNote] = useState('');
  const [quantityKey, setQuantityKey] = useState<string | null>(null);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentOrder, setSentOrder] = useState<SentOrderResult | null>(null);
  const [sendMode, setSendMode] = useState<OrderSendMode>('review');
  const [directSendGroups, setDirectSendGroups] = useState<DirectSendGroup[] | null>(null);
  const [selectedSectionKey, setSelectedSectionKey] = useState('all');
  const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
  const [newlyAddedKey, setNewlyAddedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ChecklistToastState | null>(null);
  const listRef = useRef<SectionList<SelectionLine, DisplaySection>>(null);
  const scrollTargetRef = useRef<SectionListScrollParams | null>(null);
  const loadRequestRef = useRef(0);
  const toastIdRef = useRef(0);
  const quickActionsTokenRef = useRef(quickActionsToken);

  const showToast = useCallback(
    (message: string, action?: { actionLabel: string; onAction: () => void }) => {
      toastIdRef.current += 1;
      setToast({ id: toastIdRef.current, message, ...action });
    },
    [],
  );

  // The floating pill's dots button requests the quick-actions sheet from
  // outside this screen via the ui store's monotonic token.
  useEffect(() => {
    if (quickActionsToken !== quickActionsTokenRef.current) {
      quickActionsTokenRef.current = quickActionsToken;
      setQuickActionsVisible(true);
    }
  }, [quickActionsToken]);

  const applyPendingReorder = useCallback(() => {
    if (!checklist) return;
    const staged = consumePendingReorder();
    if (!staged || staged.items.length === 0) return;
    dispatch({ type: 'applyReorder', items: staged.items });
    showToast(
      `Loaded ${staged.items.length} ${staged.items.length === 1 ? 'item' : 'items'} from ${staged.sourceLabel}`,
    );
  }, [checklist, consumePendingReorder, showToast]);

  // History can focus this screen before its asynchronous checklist load
  // finishes. Consume the staged reorder only once there is a list to apply it to.
  useFocusEffect(
    useCallback(() => {
      applyPendingReorder();
    }, [applyPendingReorder]),
  );

  useEffect(() => {
    applyPendingReorder();
  }, [applyPendingReorder]);

  // Manager-configured 5b preference; unknown/error safely means review mode.
  useEffect(() => {
    let active = true;
    getMyOrderSendMode()
      .then((mode) => {
        if (active) setSendMode(mode);
      })
      .catch(() => {
        if (active) setSendMode('review');
      });
    return () => {
      active = false;
    };
  }, []);

  const loadChecklist = useCallback(
    async (mode: 'load' | 'refresh') => {
      const requestId = loadRequestRef.current + 1;
      loadRequestRef.current = requestId;

      if (mode === 'load') {
        setIsLoading(true);
      }
      setLoadError(null);

      try {
        const result =
          mode === 'refresh'
            ? await regenerateMyChecklist(locationGroup)
            : await getOrGenerateMyChecklist(locationGroup);
        if (loadRequestRef.current !== requestId) return;
        setChecklist(result);
        dispatch({ type: 'init', checklist: result });
      } catch (error) {
        if (loadRequestRef.current !== requestId) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Could not load your order checklist.';
        setLoadError(message);
      } finally {
        if (loadRequestRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [locationGroup],
  );

  useEffect(() => {
    setSentOrder(null);
    void loadChecklist('load');
  }, [loadChecklist]);

  useEffect(() => {
    void fetchItems();
    void fetchLocations();
  }, [fetchItems, fetchLocations]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadChecklist('refresh');
    } finally {
      setIsRefreshing(false);
    }
  }, [loadChecklist]);

  const handleSelectLocation = useCallback(
    (next: Location) => {
      if (next.id === location?.id) return;
      void triggerImpactHaptic(ImpactFeedbackStyle.Light);
      setSearchQuery('');
      setNote('');
      setLocation(next);
      showToast(`Ordering for ${next.name.replace(/^Babytuna\s+/i, '')}`);
    },
    [location?.id, setLocation, showToast],
  );

  const handleToggleLine = useCallback((key: string) => {
    dispatch({ type: 'toggle', key });
  }, []);

  const handleAdjustQuantity = useCallback((key: string, delta: number) => {
    dispatch({ type: 'adjustQuantity', key, delta });
  }, []);

  const handleOpenQuantityCard = useCallback((key: string) => {
    setQuantityKey(key);
  }, []);

  const handleAddInventoryItem = useCallback(
    (item: InventoryItem) => {
      const existing = selection.lines.find((line) => line.itemId === item.id);
      const key = existing?.key ?? addedLineKey(item.id);
      dispatch({ type: 'addInventoryItem', item });
      setPendingScrollKey(key);
      if (!existing) setNewlyAddedKey(key);
      showToast(`${item.name} added`);
    },
    [selection.lines, showToast],
  );

  const inventoryById = useMemo(
    () => new Map(inventoryItems.map((item) => [item.id, item])),
    [inventoryItems],
  );

  const categoryForItemId = useCallback(
    (itemId: string | null) =>
      itemId ? (inventoryById.get(itemId)?.category ?? null) : null,
    [inventoryById],
  );

  const searchableItems = useMemo(
    () => inventoryItems.filter((item) => item.active !== false),
    [inventoryItems],
  );

  const catalogSearchIndex = useMemo(
    () => buildCatalogSearchIndex(searchableItems),
    [searchableItems],
  );

  const searchResults = useMemo(
    () => filterCatalogSearchIndex(catalogSearchIndex, searchQuery),
    [catalogSearchIndex, searchQuery],
  );

  const handleVoiceApply = useCallback(
    (additions: VoiceAddition[]) => {
      for (const addition of additions) {
        dispatch({ type: 'addInventoryItem', item: addition.item });
        if (addition.quantity !== null) {
          const existing = selection.lines.find(
            (line) => line.itemId === addition.item.id,
          );
          dispatch({
            type: 'setQuantity',
            key: existing ? existing.key : addedLineKey(addition.item.id),
            quantity: addition.quantity,
          });
        }
      }
    },
    [selection.lines],
  );

  const checkedLines = useMemo(() => getCheckedLines(selection), [selection]);
  const checkedCount = checkedLines.length;
  const selectedItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const line of checkedLines) {
      if (line.itemId) ids.add(line.itemId);
    }
    return ids;
  }, [checkedLines]);
  const listedItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const line of selection.lines) {
      if (line.itemId) ids.add(line.itemId);
    }
    return ids;
  }, [selection.lines]);

  const { lines: sendLines, unmatchedNames } = useMemo(
    () => buildSendLines(selection),
    [selection],
  );
  const sendableCheckedLines = useMemo(
    () => checkedLines.filter((line) => line.itemId !== null),
    [checkedLines],
  );

  const listSections = useMemo(
    () =>
      deriveDisplaySections(selection, {
        showCategories,
        categoryForItemId,
      }),
    [categoryForItemId, selection, showCategories],
  );

  const categoryChips = useMemo(
    () => [
      { key: 'all', label: 'All', count: selection.lines.length },
      ...(showCategories
        ? listSections.map((section) => ({
            key: section.key,
            label: section.title.split(/\s+/)[0] ?? section.title,
            count: section.totalCount,
          }))
        : []),
    ],
    [listSections, selection.lines.length, showCategories],
  );

  useEffect(() => {
    if (selectedSectionKey === 'all') return;
    if (!listSections.some((section) => section.key === selectedSectionKey)) {
      setSelectedSectionKey('all');
    }
  }, [listSections, selectedSectionKey]);

  useEffect(() => {
    if (!pendingScrollKey) return;
    const sectionIndex = listSections.findIndex((section) =>
      section.data.some((line) => line.key === pendingScrollKey),
    );
    if (sectionIndex < 0) return;
    const itemIndex = listSections[sectionIndex].data.findIndex(
      (line) => line.key === pendingScrollKey,
    );
    const timeout = setTimeout(() => {
      const target = {
        sectionIndex,
        itemIndex,
        animated: true,
        viewPosition: 0.5,
      } satisfies SectionListScrollParams;
      scrollTargetRef.current = target;
      listRef.current?.scrollToLocation(target);
      setPendingScrollKey(null);
    }, 80);
    return () => clearTimeout(timeout);
  }, [listSections, pendingScrollKey]);

  useEffect(() => {
    if (!newlyAddedKey) return;
    const timeout = setTimeout(() => setNewlyAddedKey(null), 460);
    return () => clearTimeout(timeout);
  }, [newlyAddedKey]);

  const quantityLine = useMemo(
    () => selection.lines.find((line) => line.key === quantityKey) ?? null,
    [quantityKey, selection.lines],
  );
  const quantityUnitOptions = useMemo(
    () =>
      quantityLine
        ? unitOptionsForLine(
            quantityLine.unit,
            quantityLine.itemId ? inventoryById.get(quantityLine.itemId) ?? null : null,
          )
        : [],
    [inventoryById, quantityLine],
  );

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      setQuickActionsVisible(false);
      switch (action) {
        case 'clear': {
          const snapshot: SelectionState = selection;
          dispatch({ type: 'clearAll' });
          setNote('');
          showToast('Checklist cleared', {
            actionLabel: 'Undo',
            onAction: () => {
              dispatch({ type: 'restore', state: snapshot });
              setToast(null);
            },
          });
          break;
        }
        case 'saveDefault': {
          const defaults = buildDefaultLines(selection);
          if (defaults.length === 0) {
            showToast('Check some items first, then save them as your default');
            break;
          }
          void saveChecklistAsDefault(locationGroup, defaults)
            .then((count) => {
              void triggerConfirmationHaptic();
              showToast(`Saved as default · ${count} ${count === 1 ? 'item' : 'items'}`);
            })
            .catch((error: unknown) => {
              void triggerNotificationHaptic(NotificationFeedbackType.Error);
              showToast(
                error instanceof Error ? error.message : 'Could not save your default.',
              );
            });
          break;
        }
        case 'note':
          setTimeout(() => setNoteSheetVisible(true), SHEET_TRANSITION_MS);
          break;
        case 'display':
          setTimeout(() => setDisplaySheetVisible(true), SHEET_TRANSITION_MS);
          break;
        case 'receive':
          // Cast: .expo/types/router.d.ts is a stale generated artifact
          // (last regenerated June '26); the route file exists.
          setTimeout(
            () =>
              router.push(
                '/(tabs)/receive-delivery' as Parameters<typeof router.push>[0],
              ),
            SHEET_TRANSITION_MS,
          );
          break;
        case 'recent':
          setTimeout(
            () => router.push('/(tabs)/history' as Parameters<typeof router.push>[0]),
            SHEET_TRANSITION_MS,
          );
          break;
      }
    },
    [locationGroup, selection, showToast],
  );

  const handleSaveNote = useCallback(
    (nextNote: string) => {
      const hadNote = note.trim().length > 0;
      setNote(nextNote);
      setNoteSheetVisible(false);
      if (nextNote.trim()) {
        showToast(hadNote ? 'Note updated' : 'Note added');
      } else if (hadNote) {
        showToast('Note removed');
      }
    },
    [note, showToast],
  );

  const handleOpenConfirm = useCallback(() => {
    if (checkedCount === 0) return;
    void triggerImpactHaptic();
    setSendError(null);
    setConfirmVisible(true);
  }, [checkedCount]);

  const handleConfirmSend = useCallback(async () => {
    if (isSending) return;

    // 5b direct mode: group checked lines per supplier and run the Phase 1
    // style card queue instead of creating a manager-review order.
    if (sendMode === 'direct') {
      const { lines: directLines } = buildDirectSendLines(selection);
      if (directLines.length === 0) return;
      setIsSending(true);
      setSendError(null);
      try {
        const groups = await prepareDirectSend(directLines, locationGroup, note);
        void triggerConfirmationHaptic();
        setConfirmVisible(false);
        setDirectSendGroups(groups);
      } catch (error) {
        void triggerNotificationHaptic(NotificationFeedbackType.Error);
        setSendError(
          error instanceof Error
            ? error.message
            : 'Could not prepare your supplier orders. Please try again.',
        );
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (!selection.checklistId || sendLines.length === 0) return;
    setIsSending(true);
    setSendError(null);
    try {
      const result = await sendChecklistOrder(selection.checklistId, sendLines, { note });
      void triggerConfirmationHaptic();
      setConfirmVisible(false);
      setSentOrder({ orderId: result.orderId, itemCount: sendLines.length });
      setNote('');
      dispatch({ type: 'clearAll' });
    } catch (error) {
      void triggerNotificationHaptic(NotificationFeedbackType.Error);
      setSendError(
        error instanceof Error
          ? error.message
          : 'Could not send your order. Please try again.',
      );
    } finally {
      setIsSending(false);
    }
  }, [isSending, locationGroup, note, selection, sendLines, sendMode]);

  const handleDirectSendDone = useCallback(
    (progress: SendAllQueueProgress) => {
      setDirectSendGroups(null);
      // Anything was sent: reset the checklist back to its defaults, same as
      // the review-mode success state. All-skipped keeps the selection intact.
      if (progress.sent > 0 && checklist) {
        dispatch({ type: 'init', checklist });
        setNote('');
      }
    },
    [checklist],
  );

  const handleSuccessDone = useCallback(() => {
    setSentOrder(null);
    setNote('');
    dispatch({ type: 'clearAll' });
  }, []);

  const handleCategoryPress = useCallback(
    (key: string) => {
      const sectionIndex =
        key === 'all'
          ? 0
          : listSections.findIndex((section) => section.key === key);
      if (sectionIndex < 0 || listSections[sectionIndex].data.length === 0) return;
      void triggerImpactHaptic(ImpactFeedbackStyle.Light);
      setSelectedSectionKey(key);
      const target = {
        sectionIndex,
        itemIndex: 0,
        animated: true,
        viewPosition: 0,
      } satisfies SectionListScrollParams;
      scrollTargetRef.current = target;
      listRef.current?.scrollToLocation(target);
    },
    [listSections],
  );

  const handleScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      const target = scrollTargetRef.current;
      if (!target) return;
      listRef.current?.getScrollResponder()?.scrollTo({
        y: Math.max(0, info.averageItemLength * info.highestMeasuredFrameIndex),
        animated: false,
      });
      setTimeout(() => listRef.current?.scrollToLocation(target), 100);
    },
    [],
  );

  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: SelectionLine;
      index: number;
      section: DisplaySection;
    }) => (
      <ChecklistItemRow
        line={item}
        isFirst={index === 0}
        isLast={index === section.data.length - 1}
        isNew={item.key === newlyAddedKey}
        density={density}
        onToggle={handleToggleLine}
        onAdjustQuantity={handleAdjustQuantity}
        onOpenQuantityCard={handleOpenQuantityCard}
      />
    ),
    [
      density,
      handleAdjustQuantity,
      handleOpenQuantityCard,
      handleToggleLine,
      newlyAddedKey,
    ],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: DisplaySection }) => (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: ds.spacing(density === 'dense' ? 10 : 14),
          paddingBottom: ds.spacing(density === 'dense' ? 2 : 4),
          paddingHorizontal: ds.spacing(2),
          backgroundColor: color.page,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: ds.fontSize(typeScale.caption),
            fontWeight: weight.bold,
            letterSpacing: tracking.caption,
            textTransform: 'uppercase',
            color: color.ink3,
          }}
        >
          {section.title}
        </Text>
        <Text
          style={{
            fontSize: ds.fontSize(typeScale.caption),
            fontWeight: weight.semibold,
            color: color.ink3,
          }}
        >
          {section.selectedCount}/{section.totalCount}
        </Text>
      </View>
    ),
    [density, ds],
  );

  const orderBarRestingBottom = getTabBarClearance(insets.bottom, 'pinned');
  const listBottomPadding = getTabBarClearance(insets.bottom, 'order');

  let content: React.ReactNode;
  if (directSendGroups !== null) {
    content = (
      <DirectSendQueue groups={directSendGroups} onDone={handleDirectSendDone} />
    );
  } else if (sentOrder !== null) {
    content = (
      <OrderSuccess
        result={sentOrder}
        onDone={handleSuccessDone}
      />
    );
  } else if (isLoading) {
    content = <Loading label="Loading your checklist" />;
  } else if (loadError) {
    content = (
      <EmptyState
        icon="alert-circle-outline"
        tone="alert"
        title="Checklist unavailable"
        body={loadError}
        action={{ label: 'Try again', onPress: () => void loadChecklist('load') }}
      />
    );
  } else if (selection.lines.length === 0) {
    content = (
      <EmptyState
        icon="clipboard-outline"
        title="No checklist yet"
        body="Once you have order history here, your usual items appear automatically. Use the search bar below to add items."
      />
    );
  } else {
    content = (
      <SectionList
        ref={listRef}
        sections={listSections}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        contentContainerStyle={{
          paddingTop: ds.spacing(2),
          paddingBottom: listBottomPadding,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={color.accent}
          />
        }
      />
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: color.page }}
    >
      <View style={{ flex: 1, paddingHorizontal: ds.spacing(16) }}>
        {sentOrder === null ? (
          <ScreenHeader
            title="Order"
            subtitle={`${selection.lines.length} items · ${checkedCount} selected`}
            includeSafeArea={false}
            style={{ paddingHorizontal: ds.spacing(4), paddingTop: ds.spacing(4) }}
            right={
              <LocationPill
                location={location}
                locations={locations}
                onSelect={handleSelectLocation}
              />
            }
          />
        ) : null}

        {directSendGroups === null && sentOrder === null ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: ds.spacing(6),
              paddingHorizontal: ds.spacing(20),
              paddingTop: ds.spacing(2),
              paddingBottom: ds.spacing(6),
            }}
            style={{ marginHorizontal: ds.spacing(-16), flexGrow: 0 }}
          >
            {categoryChips.map((chip) => {
              const selected = chip.key === selectedSectionKey;
              return (
                <TouchableOpacity
                  key={chip.key}
                  onPress={() => handleCategoryPress(chip.key)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${chip.label}, ${chip.count} items`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: ds.spacing(4),
                    paddingHorizontal: ds.spacing(12),
                    paddingVertical: ds.spacing(7),
                    borderRadius: radius.pill,
                    backgroundColor: selected ? color.ink : color.card,
                  }}
                >
                  <Text
                    style={{
                      fontSize: ds.fontSize(typeScale.secondary),
                      fontWeight: weight.semibold,
                      color: selected ? color.onAccent : color.ink2,
                    }}
                  >
                    {chip.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: ds.fontSize(typeScale.secondary),
                      color: selected ? color.onInkMuted : color.ink3,
                    }}
                  >
                    {chip.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {content}
      </View>

      {directSendGroups === null &&
      sentOrder === null &&
      !isLoading &&
      !loadError ? (
        <PinnedOrderBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={searchResults}
          listedItemIds={listedItemIds}
          selectedItemIds={selectedItemIds}
          onAddItem={handleAddInventoryItem}
          checkedCount={checkedCount}
          onPressSend={handleOpenConfirm}
          voiceAvailable
          onPressMic={() => setVoiceVisible(true)}
          restingBottom={orderBarRestingBottom}
        />
      ) : null}

      <QuickActionsSheet
        visible={quickActionsVisible}
        hasNote={note.trim().length > 0}
        density={density}
        showCategories={showCategories}
        onAction={handleQuickAction}
        onClose={() => setQuickActionsVisible(false)}
      />

      <ChecklistSettingsSheet
        visible={displaySheetVisible}
        density={density}
        showCategories={showCategories}
        onSelectDensity={setSimpleOrderDensity}
        onToggleCategories={setShowCategories}
        onClose={() => setDisplaySheetVisible(false)}
      />

      <NoteSheet
        visible={noteSheetVisible}
        note={note}
        onSave={handleSaveNote}
        onClose={() => setNoteSheetVisible(false)}
      />

      <QuantityCardSheet
        visible={quantityKey !== null}
        line={quantityLine}
        unitOptions={quantityUnitOptions}
        onSetUnit={(key, unit) => dispatch({ type: 'setUnit', key, unit })}
        onCommit={(key, quantity) => {
          dispatch({ type: 'setQuantity', key, quantity });
          setQuantityKey(null);
        }}
        onClose={() => setQuantityKey(null)}
      />

      <VoiceAddSheet
        visible={voiceVisible}
        locationId={location?.id ?? null}
        userId={userId}
        inventoryItems={searchableItems}
        onApply={handleVoiceApply}
        onClose={() => setVoiceVisible(false)}
      />

      <ConfirmOrderSheet
        visible={confirmVisible}
        mode={sendMode}
        // Direct mode can send unmatched lines too — they go out via the
        // share-sheet-only Unassigned card instead of being skipped.
        lines={sendMode === 'direct' ? checkedLines : sendableCheckedLines}
        unmatchedNames={sendMode === 'direct' ? [] : unmatchedNames}
        note={note}
        onEditNote={() => {
          setConfirmVisible(false);
          setTimeout(() => setNoteSheetVisible(true), SHEET_TRANSITION_MS);
        }}
        isSending={isSending}
        sendError={sendError}
        onConfirm={() => void handleConfirmSend()}
        onClose={() => setConfirmVisible(false)}
      />

      <ChecklistToast
        toast={toast}
        bottom={200}
        onExpire={() => setToast(null)}
      />
    </SafeAreaView>
  );
}
