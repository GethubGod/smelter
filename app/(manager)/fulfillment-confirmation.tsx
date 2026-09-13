import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { SUPPLIER_CATEGORY_LABELS } from '@/constants';
import { useAuthStore, useOrderStore, useSettingsStore } from '@/store';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '@/lib/supabase';
import {
  FulfillmentConfirmItemRow,
  QuantityExportSelector,
  SupplierPickerBottomSheet,
} from '@/features/fulfillment/components';
import { OrderLaterScheduleModal } from '@/features/fulfillment/components/OrderLaterScheduleModal';
import type { SupplierPickerOption } from '@/features/fulfillment/components';
import { ItemActionSheet } from '@/components';
import type { ItemActionSheetSection } from '@/components';
import { buildSupplierConfirmationData } from '@/services/fulfillmentDataSource';
import { loadSupplierLookup, type SupplierLookupRow } from '@/services/supplierResolver';
import {
  UnitConversionLookup,
  applyUnitConversion,
  loadUnitConversionLookup,
  resolveUnitConversionMultiplier,
} from '@/services/unitConversion';
import { findStaleConsumedOrderItemIds } from '@/services/orderItemFreshness';
import {
  buildUnitLabelAvailabilityMap,
  resolveUnitSelectorProps,
  type InventoryUnitInfo,
  type UnitLabelAvailability,
  type UnitSelectorProps,
} from '@/features/fulfillment/unitLabels';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useModuleAccessGuard } from '@/hooks';
import { color, radius, space, typeScale, weight } from '@/theme/tokens';
import { Button, Card, ScreenHeader, SectionLabel, StatusPill } from '@/components/ui';
import { showNotice } from '@/components/ui/NoticeSheet';
import { Sheet } from '@/components/ui/Sheet';

interface ConfirmationDetail {
  locationId?: string;
  locationName: string;
  orderedBy: string;
  quantity: number;
  shortCode?: string;
}

interface ConfirmationContributor {
  userId: string | null;
  name: string;
  quantity: number;
}

interface ConfirmationNote {
  id: string;
  author: string;
  text: string;
  locationName: string;
  shortCode: string;
}

type LocationGroup = 'sushi' | 'poki';

const LOCATION_GROUP_LABELS: Record<LocationGroup, string> = {
  sushi: 'Sushi',
  poki: 'Poki',
};

interface ConfirmationItem {
  id: string;
  inventoryItemId: string;
  name: string;
  category: string;
  locationGroup: LocationGroup;
  quantity: number;
  unitType: 'base' | 'pack';
  unitLabel: string;
  sumOfContributorQuantities: number;
  sourceOrderItemIds: string[];
  sourceOrderIds: string[];
  sourceDraftItemIds: string[];
  contributors: ConfirmationContributor[];
  notes: ConfirmationNote[];
  details: ConfirmationDetail[];
  secondarySupplierName: string | null;
  secondarySupplierId: string | null;
}

interface RemainingConfirmationItem {
  orderItemId: string;
  orderId: string;
  inventoryItemId: string;
  name: string;
  category: string;
  locationGroup: LocationGroup;
  locationId: string;
  locationName: string;
  shortCode: string;
  unitType: 'base' | 'pack';
  unitLabel: string;
  reportedRemaining: number;
  decidedQuantity: number | null;
  note: string | null;
  orderedBy: string;
  secondarySupplierName: string | null;
  secondarySupplierId: string | null;
}

type ReviewListEntry =
  | { key: string; type: 'regular'; item: ConfirmationItem }
  | { key: string; type: 'remaining'; item: RemainingConfirmationItem };

function parseParamArray<T>(value: string | string[] | undefined): T[] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return [];

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
}

function normalizeLocationGroup(group: unknown): LocationGroup {
  return group === 'poki' ? 'poki' : 'sushi';
}

function toNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return parsed;
}

function toNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }
  return fallback;
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? `${value}` : `${value}`.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function buildFinalizePayloadFromItems(
  regularItems: ConfirmationItem[],
  remainingItems: RemainingConfirmationItem[]
) {
  const regularPayload = regularItems.map((item) => ({
    id: item.id,
    inventoryItemId: item.inventoryItemId,
    name: item.name,
    category: item.category,
    locationGroup: item.locationGroup,
    quantity: item.quantity,
    unitType: item.unitType,
    unitLabel: item.unitLabel,
    notes: item.notes.map((note) => note.text),
    sourceOrderItemIds: item.sourceOrderItemIds,
    sourceOrderIds: item.sourceOrderIds,
    sourceDraftItemIds: item.sourceDraftItemIds,
  }));

  const remainingPayload = remainingItems.map((item) => ({
    orderItemId: item.orderItemId,
    orderId: item.orderId,
    inventoryItemId: item.inventoryItemId,
    name: item.name,
    category: item.category,
    locationGroup: item.locationGroup,
    locationId: item.locationId,
    locationName: item.locationName,
    quantity: item.decidedQuantity ?? 0,
    decidedQuantity: item.decidedQuantity ?? 0,
    reportedRemaining: item.reportedRemaining,
    unitType: item.unitType,
    unitLabel: item.unitLabel,
    note: item.note,
  }));

  const locationSet = new Set<string>();
  regularPayload.forEach((item) => {
    locationSet.add(item.locationGroup === 'poki' ? 'Poki' : 'Sushi');
  });
  remainingPayload.forEach((item) => {
    locationSet.add(item.locationGroup === 'poki' ? 'Poki' : 'Sushi');
  });

  const consumedOrderItemIds = Array.from(
    new Set([
      ...regularPayload.flatMap((item) => item.sourceOrderItemIds),
      ...remainingPayload.map((item) => item.orderItemId),
    ])
  );

  const consumedDraftItemIds = Array.from(
    new Set(regularPayload.flatMap((item) => item.sourceDraftItemIds))
  );

  const sourceOrderIds = Array.from(
    new Set([
      ...regularPayload.flatMap((item) => item.sourceOrderIds),
      ...remainingPayload.map((item) => item.orderId),
    ])
  );

  const historyLineItems = [
    ...regularPayload.map((item) => ({
      itemId: item.inventoryItemId,
      itemName: item.name,
      unit: item.unitLabel,
      quantity: item.quantity,
      locationId: null,
      locationName: null,
      locationGroup: item.locationGroup,
      unitType: item.unitType,
      note: item.notes.length > 0 ? item.notes[0] : null,
    })),
    ...remainingPayload.map((item) => ({
      itemId: item.inventoryItemId,
      itemName: item.name,
      unit: item.unitLabel,
      quantity: item.decidedQuantity ?? item.quantity,
      locationId: item.locationId,
      locationName: item.locationName,
      locationGroup: item.locationGroup,
      unitType: item.unitType,
      note: item.note,
    })),
  ].filter(
    (line) =>
      typeof line.itemId === 'string' &&
      line.itemId.trim().length > 0 &&
      Number.isFinite(line.quantity) &&
      line.quantity > 0
  );

  return {
    regularPayload,
    remainingPayload,
    historyLineItems,
    locationLabels: Array.from(locationSet),
    consumedOrderItemIds,
    consumedDraftItemIds,
    sourceOrderIds,
    totalItemCount: regularPayload.length + remainingPayload.length,
  };
}

function encodeHistorySignaturePart(value: string | null | undefined): string {
  return encodeURIComponent(value ?? '');
}

function decodeHistorySignaturePart(value: string | undefined): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function assertNoReportedInExportText(message: string) {
  if (__DEV__ && /\breported\b/i.test(message)) {
    throw new Error('Exported fulfillment message cannot contain "reported".');
  }
}

interface ItemExportSettings {
  exportUnitType: 'base' | 'pack';
}

interface RemainingContributorSummary {
  name: string;
  reportedTotal: number;
  rowCount: number;
}

interface RemainingItemRowProps {
  item: RemainingConfirmationItem;
  suggested: number | null;
  isSaving: boolean;
  unitSelectorProps: UnitSelectorProps;
  exportUnitType: 'base' | 'pack';
  contributorBreakdown: RemainingContributorSummary[];
  onUnitChange: (unit: 'base' | 'pack') => void;
  onQuantityChange: (item: RemainingConfirmationItem, value: number | null) => void;
  onOverflowPress: (item: RemainingConfirmationItem) => void;
  last?: boolean;
}

const RemainingItemRow = React.memo(function RemainingItemRow({
  item,
  suggested,
  isSaving,
  unitSelectorProps,
  exportUnitType,
  contributorBreakdown,
  onUnitChange,
  onQuantityChange,
  onOverflowPress,
  last = false,
}: RemainingItemRowProps) {
  const ds = useScaledStyles();
  const breakdown = contributorBreakdown.length > 0
    ? contributorBreakdown
        .map((entry) => `${entry.name} ${formatQuantity(entry.reportedTotal)}`)
        .join(' · ')
    : `${item.orderedBy} ${formatQuantity(item.reportedRemaining)}`;

  return (
    <FulfillmentConfirmItemRow
      title={item.name}
      orderedByContent={
        <Text
          numberOfLines={1}
          style={{ fontSize: ds.fontSize(typeScale.meta), color: color.ink3 }}
        >
          {breakdown}
        </Text>
      }
      trailingChip={
        suggested !== null ? (
          <TouchableOpacity
            onPress={() => onQuantityChange(item, suggested)}
            accessibilityRole="button"
            accessibilityLabel={`Use suggested quantity ${formatQuantity(suggested)} for ${item.name}`}
            style={{
              paddingHorizontal: ds.spacing(7),
              paddingVertical: ds.spacing(3),
              borderRadius: radius.pill,
              backgroundColor: color.tint,
            }}
          >
            <Text
              style={{
                fontSize: ds.fontSize(typeScale.meta),
                fontWeight: weight.semibold,
                color: color.accent,
              }}
            >
              Suggested {formatQuantity(suggested)}
            </Text>
          </TouchableOpacity>
        ) : undefined
      }
      headerActions={
        <TouchableOpacity
          onPress={() => onOverflowPress(item)}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${item.name}`}
          style={{ padding: ds.spacing(4) }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={ds.icon(18)} color={color.ink3} />
        </TouchableOpacity>
      }
      quantityValue={item.decidedQuantity === null ? '' : formatQuantity(item.decidedQuantity)}
      onQuantityChangeText={(text) => {
        const sanitized = text.replace(/[^0-9.]/g, '');
        if (sanitized.length === 0) {
          onQuantityChange(item, null);
          return;
        }
        const parsed = Number(sanitized);
        if (!Number.isFinite(parsed) || parsed < 0) return;
        onQuantityChange(item, parsed);
      }}
      onDecrement={() => {
        const current = item.decidedQuantity ?? 0;
        onQuantityChange(item, Math.max(0, current - 1));
      }}
      onIncrement={() => {
        const current = item.decidedQuantity ?? 0;
        onQuantityChange(item, current + 1);
      }}
      quantityPlaceholder="–"
      unitSelector={
        <QuantityExportSelector
          exportUnitType={exportUnitType}
          baseUnitLabel={unitSelectorProps.baseUnitLabel}
          packUnitLabel={unitSelectorProps.packUnitLabel}
          canSwitchUnit={unitSelectorProps.canSwitchUnit}
          onUnitChange={onUnitChange}
        />
      }
      footer={
        isSaving ? (
          <Text style={{ fontSize: ds.fontSize(typeScale.meta), color: color.ink3 }}>
            Saving…
          </Text>
        ) : undefined
      }
      disableControls={isSaving}
      last={last}
    />
  );
});

export default function FulfillmentConfirmationRoute() {
  // Phase 3: same fulfillment-module gate as the parent fulfillment tab —
  // deep links to a disabled module redirect to manager home.
  const guard = useModuleAccessGuard('fulfillment', '/(manager)');

  if (guard.isChecking) {
    return null;
  }

  if (guard.redirectTo) {
    return <Redirect href={guard.redirectTo} />;
  }

  return <FulfillmentConfirmationScreen />;
}

function FulfillmentConfirmationScreen() {
  const ds = useScaledStyles();
  const params = useLocalSearchParams<{
    items?: string;
    supplier?: string;
    supplierLabel?: string;
    from?: string;
    remaining?: string;
  }>();
  const { user, locations } = useAuthStore(useShallow((state) => ({
    user: state.user,
    locations: state.locations,
  })));
  const exportFormat = useSettingsStore((state) => state.exportFormat);
  const {
    createOrderLaterItem,
    fetchPendingFulfillmentOrders,
    finalizeSupplierOrder,
    getSupplierDraftItems,
    getLastOrderedQuantities,
    markOrderItemsStatus,
    removeSupplierDraftItem,
    removeSupplierDraftItems,
    addSupplierDraftItem,
    setSupplierOverride,
    updateSupplierDraftItemQuantity,
  } = useOrderStore(useShallow((state) => ({
    createOrderLaterItem: state.createOrderLaterItem,
    fetchPendingFulfillmentOrders: state.fetchPendingFulfillmentOrders,
    finalizeSupplierOrder: state.finalizeSupplierOrder,
    getSupplierDraftItems: state.getSupplierDraftItems,
    getLastOrderedQuantities: state.getLastOrderedQuantities,
    markOrderItemsStatus: state.markOrderItemsStatus,
    removeSupplierDraftItem: state.removeSupplierDraftItem,
    removeSupplierDraftItems: state.removeSupplierDraftItems,
    addSupplierDraftItem: state.addSupplierDraftItem,
    setSupplierOverride: state.setSupplierOverride,
    updateSupplierDraftItemQuantity: state.updateSupplierDraftItemQuantity,
  })));

  const initialItems = useMemo(() => {
    return parseParamArray<ConfirmationItem>(params.items)
      .map((item, index) => {
        const normalizedContributors = Array.isArray(item.contributors)
          ? item.contributors
              .map((contributor) => ({
                userId: typeof contributor.userId === 'string' ? contributor.userId : null,
                name:
                  typeof contributor.name === 'string' && contributor.name.trim().length > 0
                    ? contributor.name.trim()
                    : 'Unknown',
                quantity: toNonNegativeNumber(contributor.quantity, 0),
              }))
              .filter((contributor) => contributor.quantity > 0)
          : [];
        const contributorTotal = normalizedContributors.reduce((sum, contributor) => sum + contributor.quantity, 0);

        const normalizedDetails = Array.isArray(item.details)
          ? item.details
              .map((detail) => ({
                locationId: typeof detail.locationId === 'string' ? detail.locationId : undefined,
                locationName:
                  typeof detail.locationName === 'string' && detail.locationName.trim().length > 0
                    ? detail.locationName.trim()
                    : 'Unknown',
                orderedBy:
                  typeof detail.orderedBy === 'string' && detail.orderedBy.trim().length > 0
                    ? detail.orderedBy.trim()
                    : 'Unknown',
                quantity: toNonNegativeNumber(detail.quantity, 0),
                shortCode:
                  typeof detail.shortCode === 'string' && detail.shortCode.trim().length > 0
                    ? detail.shortCode.trim()
                    : undefined,
              }))
              .filter((detail) => detail.quantity > 0)
          : [];

        const normalizedNotes = Array.isArray(item.notes)
          ? item.notes
              .map((note, noteIndex) => {
                const text = typeof note.text === 'string' ? note.text.trim() : '';
                if (text.length === 0) return null;
                return {
                  id:
                    typeof note.id === 'string' && note.id.trim().length > 0
                      ? note.id
                      : `${item.id || item.inventoryItemId || index}-note-${noteIndex}`,
                  author:
                    typeof note.author === 'string' && note.author.trim().length > 0
                      ? note.author.trim()
                      : 'Unknown',
                  text,
                  locationName:
                    typeof note.locationName === 'string' && note.locationName.trim().length > 0
                      ? note.locationName.trim()
                      : 'Unknown',
                  shortCode:
                    typeof note.shortCode === 'string' && note.shortCode.trim().length > 0
                      ? note.shortCode.trim()
                      : '??',
                } satisfies ConfirmationNote;
              })
              .filter((note): note is ConfirmationNote => Boolean(note))
          : [];

        const safeUnitType: 'base' | 'pack' = item.unitType === 'base' ? 'base' : 'pack';
        const safeId =
          typeof item.id === 'string' && item.id.length > 0
            ? item.id
            : `${normalizeLocationGroup(item.locationGroup)}-${item.inventoryItemId || item.name || index}`;

        return {
          ...item,
          id: safeId,
          inventoryItemId:
            typeof item.inventoryItemId === 'string' && item.inventoryItemId.length > 0
              ? item.inventoryItemId
              : safeId,
          locationGroup: normalizeLocationGroup(item.locationGroup),
          quantity: toNonNegativeNumber(item.quantity, 0),
          unitType: safeUnitType,
          unitLabel:
            typeof item.unitLabel === 'string' && item.unitLabel.trim().length > 0
              ? item.unitLabel.trim()
              : safeUnitType === 'pack'
                ? 'pack'
                : 'unit',
          sumOfContributorQuantities:
            toNonNegativeNumber(item.sumOfContributorQuantities, contributorTotal) || contributorTotal,
          sourceOrderItemIds: Array.isArray(item.sourceOrderItemIds)
            ? item.sourceOrderItemIds.filter(
                (id): id is string => typeof id === 'string' && id.trim().length > 0
              )
            : [],
          sourceOrderIds: Array.isArray(item.sourceOrderIds)
            ? item.sourceOrderIds.filter(
                (id): id is string => typeof id === 'string' && id.trim().length > 0
              )
            : [],
          sourceDraftItemIds: Array.isArray(item.sourceDraftItemIds)
            ? item.sourceDraftItemIds.filter(
                (id): id is string => typeof id === 'string' && id.trim().length > 0
              )
            : [],
          contributors: normalizedContributors,
          notes: normalizedNotes,
          details: normalizedDetails,
        } satisfies ConfirmationItem;
      })
      .sort((a, b) => {
        if (a.locationGroup !== b.locationGroup) return a.locationGroup.localeCompare(b.locationGroup);
        return a.name.localeCompare(b.name);
      });
  }, [params.items]);

  const initialRemainingItems = useMemo(() => {
    return parseParamArray<RemainingConfirmationItem>(params.remaining).map((item) => ({
      ...item,
      locationGroup: normalizeLocationGroup(item.locationGroup),
      reportedRemaining: Math.max(0, Number(item.reportedRemaining || 0)),
      decidedQuantity: toNumberOrNull(item.decidedQuantity),
      note: typeof item.note === 'string' && item.note.trim().length > 0 ? item.note.trim() : null,
    }));
  }, [params.remaining]);

  const [items, setItems] = useState<ConfirmationItem[]>(initialItems);
  const [remainingItems, setRemainingItems] = useState<RemainingConfirmationItem[]>(initialRemainingItems);
  const [savingRemainingIds, setSavingRemainingIds] = useState<Set<string>>(new Set());
  const [lastOrderedByRemainingId, setLastOrderedByRemainingId] = useState<
    Record<string, { quantity: number; orderedAt: string }>
  >({});
  const [loadingLastOrdered, setLoadingLastOrdered] = useState(false);
  const [historyUnavailableOffline, setHistoryUnavailableOffline] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const finalizeInFlightRef = useRef(false);
  const [orderLaterTarget, setOrderLaterTarget] = useState<
    | { kind: 'regular'; id: string }
    | { kind: 'remaining'; id: string }
    | null
  >(null);
  const [overflowTarget, setOverflowTarget] = useState<
    | { kind: 'regular'; id: string }
    | { kind: 'remaining'; id: string }
    | null
  >(null);
  const [supplierPickerTarget, setSupplierPickerTarget] = useState<
    | { kind: 'regular'; item: ConfirmationItem }
    | { kind: 'remaining'; item: RemainingConfirmationItem }
    | null
  >(null);
  const [isMovingSupplier, setIsMovingSupplier] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<SupplierLookupRow[]>([]);
  const [noteEditorTarget, setNoteEditorTarget] = useState<
    | { kind: 'regular'; id: string }
    | { kind: 'remaining'; id: string }
    | null
  >(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [unitInfoMap, setUnitInfoMap] = useState<Record<string, InventoryUnitInfo>>({});
  const [unitConversionLookup, setUnitConversionLookup] = useState<UnitConversionLookup>({});
  const [exportSettings, setExportSettings] = useState<Record<string, ItemExportSettings>>({});

  const getExportSettings = useCallback(
    (itemId: string, defaultUnitType: 'base' | 'pack'): ItemExportSettings =>
      exportSettings[itemId] ?? { exportUnitType: defaultUnitType },
    [exportSettings]
  );

  const updateExportSettings = useCallback(
    (itemId: string, patch: Partial<ItemExportSettings>) => {
      setExportSettings((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] ?? { exportUnitType: 'base' }),
          ...patch,
        },
      }));
    },
    []
  );

  const supplierParam = Array.isArray(params.supplier) ? params.supplier[0] : params.supplier;
  const supplierLabelParam = Array.isArray(params.supplierLabel)
    ? params.supplierLabel[0]
    : params.supplierLabel;
  const openedFromSendAll = (
    Array.isArray(params.from) ? params.from[0] : params.from
  ) === 'send-all';
  const supplierId = useMemo(() => {
    if (typeof supplierParam !== 'string') return null;
    const trimmed = supplierParam.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [supplierParam]);
  const supplierLabel = useMemo(() => {
    if (typeof supplierLabelParam === 'string' && supplierLabelParam.trim().length > 0) {
      return supplierLabelParam.trim();
    }
    if (!supplierId) return 'Supplier';
    return SUPPLIER_CATEGORY_LABELS[supplierId] || supplierId;
  }, [supplierId, supplierLabelParam]);
  const managerLocationIds = useMemo(
    () =>
      locations
        .map((location) => (typeof location.id === 'string' ? location.id.trim() : ''))
        .filter((id) => id.length > 0),
    [locations]
  );

  // Reset local state when the supplier param changes (prevents stale flash from previous supplier)
  useEffect(() => {
    setItems(initialItems);
    setRemainingItems(initialRemainingItems);
    setSavingRemainingIds(new Set());
    setIsFinalizing(false);
    setOrderLaterTarget(null);
    setOverflowTarget(null);
    setSupplierPickerTarget(null);
    setNoteEditorTarget(null);
    setNoteDraft('');
    setExportSettings({});
  }, [supplierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const inventoryItemLookupSignature = useMemo(
    () =>
      Array.from(
        new Set(
          [...items, ...remainingItems]
            .map((entry) =>
              typeof entry.inventoryItemId === 'string' ? entry.inventoryItemId.trim() : ''
            )
            .filter((id) => id.length > 0)
        )
      )
        .sort()
        .join('|'),
    [items, remainingItems]
  );

  // Batch-load inventory item unit info for unit switching
  useEffect(() => {
    const ids = inventoryItemLookupSignature
      ? inventoryItemLookupSignature.split('|').filter((id) => id.length > 0)
      : [];
    if (ids.length === 0) return;

    let active = true;
    (supabase as any)
      .from('inventory_items')
      .select('id, base_unit, pack_unit, pack_size')
      .in('id', ids)
      .then(({ data }: { data: InventoryUnitInfo[] | null }) => {
        if (!active || !data) return;
        const map: Record<string, InventoryUnitInfo> = {};
        data.forEach((row) => {
          map[row.id] = row;
        });
        setUnitInfoMap(map);
      });

    return () => {
      active = false;
    };
  }, [inventoryItemLookupSignature]);

  useEffect(() => {
    const ids = inventoryItemLookupSignature
      ? inventoryItemLookupSignature.split('|').filter((id) => id.length > 0)
      : [];

    if (ids.length === 0) {
      setUnitConversionLookup({});
      return;
    }

    let active = true;
    (async () => {
      try {
        const lookup = await loadUnitConversionLookup(ids);
        if (!active) return;
        setUnitConversionLookup(lookup);
      } catch {
        if (active) {
          setUnitConversionLookup({});
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [inventoryItemLookupSignature]);

  useEffect(() => {
    let active = true;
    loadSupplierLookup()
      .then((lookup) => {
        if (!active) return;
        setSupplierOptions(lookup.suppliers);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const supplierPickerOptions = useMemo<SupplierPickerOption[]>(
    () =>
      supplierOptions
        .filter((row) => row.active)
        .map((row) => ({ id: row.id, name: row.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [supplierOptions]
  );

  const hasAlternateSupplierOptions = useMemo(
    () => supplierPickerOptions.some((row) => row.id !== supplierId),
    [supplierId, supplierPickerOptions]
  );

  const refreshFromSupplierSource = useCallback(async () => {
    if (!supplierId) return null;

    try {
      await fetchPendingFulfillmentOrders(managerLocationIds);
      const supplierLookup = await loadSupplierLookup();
      const stateOrders = (useOrderStore.getState().orders || []) as any;
      const supplierDraftItems = getSupplierDraftItems(supplierId) as any;
      const rebuilt = buildSupplierConfirmationData({
        supplierId,
        orders: stateOrders,
        supplierLookup,
        supplierDraftItems,
      });

      const nextRegularItems = rebuilt.regularItems as unknown as ConfirmationItem[];
      const nextRemainingItems = rebuilt.remainingItems as unknown as RemainingConfirmationItem[];
      setItems(nextRegularItems);
      setRemainingItems(nextRemainingItems);
      return {
        regularItems: nextRegularItems,
        remainingItems: nextRemainingItems,
      };
    } catch {
      return null;
    }
  }, [fetchPendingFulfillmentOrders, getSupplierDraftItems, managerLocationIds, supplierId]);

  useFocusEffect(
    useCallback(() => {
      void refreshFromSupplierSource();
    }, [refreshFromSupplierSource])
  );

  const handleBackPress = useCallback(() => {
    if (openedFromSendAll) {
      router.back();
      return;
    }
    router.replace('/(manager)/fulfillment');
  }, [openedFromSendAll]);

  const syncOrderStoreDecision = useCallback(
    (orderItemId: string, decidedQuantity: number, decidedBy: string, decidedAt: string) => {
      useOrderStore.setState((state: any) => {
        const patchOrder = (orderLike: any) => {
          if (!orderLike || !Array.isArray(orderLike.order_items)) return orderLike;

          let changed = false;
          const nextItems = orderLike.order_items.map((orderItem: any) => {
            if (orderItem?.id !== orderItemId) return orderItem;
            changed = true;
            return {
              ...orderItem,
              quantity: decidedQuantity,
              decided_quantity: decidedQuantity,
              decided_by: decidedBy,
              decided_at: decidedAt,
            };
          });

          return changed ? { ...orderLike, order_items: nextItems } : orderLike;
        };

        return {
          orders: Array.isArray(state.orders) ? state.orders.map((order: any) => patchOrder(order)) : state.orders,
          currentOrder: patchOrder(state.currentOrder),
        };
      });
    },
    []
  );

  const persistRemainingDecision = useCallback(
    async (orderItemId: string, quantity: number, options?: { silent?: boolean }) => {
      if (!user?.id) {
        if (!options?.silent) {
          showNotice('Sign In Required', 'Please sign in again to save remaining item decisions.');
        }
        return false;
      }

      const decidedAt = new Date().toISOString();
      setSavingRemainingIds((prev) => {
        const next = new Set(prev);
        next.add(orderItemId);
        return next;
      });

      try {
        const { error } = await (supabase as any)
          .from('order_items')
          .update({
            quantity,
            decided_quantity: quantity,
            decided_by: user.id,
            decided_at: decidedAt,
          })
          .eq('id', orderItemId);

        if (error) throw error;

        syncOrderStoreDecision(orderItemId, quantity, user.id, decidedAt);
        return true;
      } catch (error: unknown) {
        if (!options?.silent) {
          showNotice('Unable to Save Decision', getErrorMessage(error, 'Please try again.'));
        }
        return false;
      } finally {
        setSavingRemainingIds((prev) => {
          const next = new Set(prev);
          next.delete(orderItemId);
          return next;
        });
      }
    },
    [syncOrderStoreDecision, user?.id]
  );

  const remainingHistorySignature = useMemo(() => {
    return remainingItems
      .map((item) =>
        [
          encodeHistorySignaturePart(item.orderItemId),
          encodeHistorySignaturePart(item.inventoryItemId),
          encodeHistorySignaturePart(item.unitLabel.toLowerCase()),
          encodeHistorySignaturePart(item.locationId),
          encodeHistorySignaturePart(item.locationGroup),
        ].join('|')
      )
      .sort()
      .join('||');
  }, [remainingItems]);

  const remainingHistoryLookupItems = useMemo(
    () =>
      remainingHistorySignature
        .split('||')
        .map((entry) => {
          if (!entry) return null;
          const [rawKey, rawItemId, rawUnit, rawLocationId, rawLocationGroup] = entry.split('|');
          const key = decodeHistorySignaturePart(rawKey);
          const itemId = decodeHistorySignaturePart(rawItemId);
          const unit = decodeHistorySignaturePart(rawUnit);
          const locationId = decodeHistorySignaturePart(rawLocationId);
          const locationGroup = decodeHistorySignaturePart(rawLocationGroup);
          if (!key || !itemId || !unit) return null;
          return {
            key,
            itemId,
            unit,
            locationId: locationId || null,
            locationGroup:
              locationGroup === 'sushi' || locationGroup === 'poki' ? locationGroup : null,
          };
        })
        .filter(
          (
            item
          ): item is {
            key: string;
            itemId: string;
            unit: string;
            locationId: string | null;
            locationGroup: 'sushi' | 'poki' | null;
          } => Boolean(item)
        ),
    [remainingHistorySignature]
  );

  useEffect(() => {
    let isActive = true;

    const loadLastOrdered = async () => {
      if (!supplierId || remainingHistoryLookupItems.length === 0) {
        if (isActive) {
          setLastOrderedByRemainingId({});
          setHistoryUnavailableOffline(false);
          setLoadingLastOrdered(false);
        }
        return;
      }

      setLoadingLastOrdered(true);
      try {
        const result = await getLastOrderedQuantities({
          supplierId,
          managerId: user?.id ?? null,
          items: remainingHistoryLookupItems,
        });

        if (isActive) {
          const nextValues: Record<string, { quantity: number; orderedAt: string }> = {};
          Object.entries(result.values).forEach(([key, value]) => {
            nextValues[key] = {
              quantity: value.quantity,
              orderedAt: value.orderedAt,
            };
          });
          setLastOrderedByRemainingId(nextValues);
          setHistoryUnavailableOffline(result.historyUnavailableOffline);
          setLoadingLastOrdered(false);
        }
      } catch {
        if (isActive) {
          setLastOrderedByRemainingId({});
          setHistoryUnavailableOffline(true);
          setLoadingLastOrdered(false);
        }
      }
    };

    void loadLastOrdered();

    return () => {
      isActive = false;
    };
  }, [
    getLastOrderedQuantities,
    remainingHistoryLookupItems,
    remainingHistorySignature,
    supplierId,
    user?.id,
  ]);

  const getSuggestion = useCallback(
    (item: RemainingConfirmationItem) => {
      const lastOrdered = lastOrderedByRemainingId[item.orderItemId];
      if (!lastOrdered || !Number.isFinite(lastOrdered.quantity) || lastOrdered.quantity <= 0) return null;
      return Math.max(0, lastOrdered.quantity);
    },
    [lastOrderedByRemainingId]
  );

  const suggestionCount = useMemo(() => {
    return remainingItems.filter((item) => getSuggestion(item) !== null).length;
  }, [getSuggestion, remainingItems]);

  const unresolvedRemainingItemIds = useMemo(() => {
    return remainingItems
      .filter(
        (item) =>
          item.decidedQuantity == null ||
          !Number.isFinite(item.decidedQuantity) ||
          item.decidedQuantity <= 0
      )
      .map((item) => item.orderItemId);
  }, [remainingItems]);

  const hasMissingRemaining = unresolvedRemainingItemIds.length > 0;
  const hasAnyItems = items.length > 0 || remainingItems.length > 0;
  const actionsDisabled =
    !hasAnyItems || hasMissingRemaining || savingRemainingIds.size > 0 || isFinalizing;

  const groupedItems = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const group = normalizeLocationGroup(item.locationGroup);
        acc[group].push(item);
        return acc;
      },
      { sushi: [] as ConfirmationItem[], poki: [] as ConfirmationItem[] }
    );
  }, [items]);

  const groupedRegularItems = useMemo(() => {
    const groupOrder: LocationGroup[] = ['sushi', 'poki'];
    const output: Record<LocationGroup, ConfirmationItem[]> = {
      sushi: [...(groupedItems.sushi || [])],
      poki: [...(groupedItems.poki || [])],
    };

    groupOrder.forEach((group) => {
      output[group].sort((a, b) => {
        const byName = a.name.localeCompare(b.name);
        if (byName !== 0) return byName;
        const byInventoryId = a.inventoryItemId.localeCompare(b.inventoryItemId);
        if (byInventoryId !== 0) return byInventoryId;
        if (a.unitType !== b.unitType) return a.unitType.localeCompare(b.unitType);
        return a.unitLabel.localeCompare(b.unitLabel);
      });
    });

    return output;
  }, [groupedItems]);

  const unitLabelAvailabilityByInventoryItemId = useMemo<
    Record<string, UnitLabelAvailability>
  >(
    () => buildUnitLabelAvailabilityMap([...items, ...remainingItems]),
    [items, remainingItems]
  );

  const getUnitSelectorPropsByInventoryItemId = useCallback(
    (inventoryItemId: string, unitType: 'base' | 'pack', unitLabel: string): UnitSelectorProps =>
      resolveUnitSelectorProps({
        unitInfo: unitInfoMap[inventoryItemId],
        availability: unitLabelAvailabilityByInventoryItemId[inventoryItemId],
        currentUnitType: unitType,
        currentUnitLabel: unitLabel,
      }),
    [unitInfoMap, unitLabelAvailabilityByInventoryItemId]
  );

  const resolvePreviewQuantityAndUnit = useCallback(
    ({
      inventoryItemId,
      sourceQuantity,
      sourceUnitType,
      sourceUnitLabel,
      targetUnitType,
      targetUnitLabel,
    }: {
      inventoryItemId: string;
      sourceQuantity: number;
      sourceUnitType: 'base' | 'pack';
      sourceUnitLabel: string;
      targetUnitType: 'base' | 'pack';
      targetUnitLabel: string;
    }) => {
      if (!Number.isFinite(sourceQuantity)) {
        return null;
      }

      if (sourceUnitType === targetUnitType) {
        return {
          quantity: sourceQuantity,
          unitType: targetUnitType,
          unitLabel: targetUnitLabel,
        };
      }

      const unitInfo = unitInfoMap[inventoryItemId];
      const conversionMultiplier = resolveUnitConversionMultiplier({
        inventoryItemId,
        fromUnitLabel: sourceUnitLabel,
        toUnitLabel: targetUnitLabel,
        fromUnitType: sourceUnitType,
        toUnitType: targetUnitType,
        packSize: unitInfo?.pack_size ?? null,
        lookup: unitConversionLookup,
      });

      if (!conversionMultiplier) {
        return {
          quantity: sourceQuantity,
          unitType: sourceUnitType,
          unitLabel: sourceUnitLabel,
        };
      }

      const convertedQuantity = applyUnitConversion(sourceQuantity, conversionMultiplier);
      if (!Number.isFinite(convertedQuantity)) {
        return null;
      }

      return {
        quantity: convertedQuantity,
        unitType: targetUnitType,
        unitLabel: targetUnitLabel,
      };
    },
    [unitConversionLookup, unitInfoMap]
  );

  const groupedRemainingItems = useMemo(() => {
    return remainingItems.reduce(
      (acc, item) => {
        const group = normalizeLocationGroup(item.locationGroup);
        acc[group].push(item);
        return acc;
      },
      { sushi: [] as RemainingConfirmationItem[], poki: [] as RemainingConfirmationItem[] }
    );
  }, [remainingItems]);

  const reviewListEntries = useMemo<ReviewListEntry[]>(
    () =>
      [
        ...items.map(
          (item): ReviewListEntry => ({
            key: `regular-${item.id}`,
            type: 'regular',
            item,
          }),
        ),
        ...remainingItems.map(
          (item): ReviewListEntry => ({
            key: `remaining-${item.orderItemId}`,
            type: 'remaining',
            item,
          }),
        ),
      ].sort((left, right) => {
        const groupOrder: Record<LocationGroup, number> = { sushi: 0, poki: 1 };
        return groupOrder[left.item.locationGroup] - groupOrder[right.item.locationGroup];
      }),
    [items, remainingItems],
  );

  const reviewNotes = useMemo(() => {
    const seen = new Set<string>();
    const notes: { id: string; text: string }[] = [];

    items.forEach((item) => {
      item.notes.forEach((note) => {
        const key = note.text.trim().toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        notes.push({
          id: `regular-${note.id}`,
          text: note.text,
        });
      });
    });

    remainingItems.forEach((item) => {
      const text = item.note?.trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      notes.push({
        id: `remaining-${item.orderItemId}`,
        text,
      });
    });

    return notes;
  }, [items, remainingItems]);

  const peopleCount = useMemo(() => {
    const names = new Set<string>();
    items.forEach((item) => {
      item.contributors.forEach((contributor) => {
        const name = contributor.name.trim();
        if (name && name !== 'Unknown') names.add(name.toLowerCase());
      });
      item.details.forEach((detail) => {
        const name = detail.orderedBy.trim();
        if (name && name !== 'Unknown') names.add(name.toLowerCase());
      });
    });
    remainingItems.forEach((item) => {
      const name = item.orderedBy.trim();
      if (name && name !== 'Unknown') names.add(name.toLowerCase());
    });
    return names.size;
  }, [items, remainingItems]);

  const remainingContributorBreakdownByOrderItemId = useMemo(() => {
    const groupedByItem = new Map<string, RemainingConfirmationItem[]>();
    remainingItems.forEach((item) => {
      const key = `${item.locationGroup}|${item.inventoryItemId}|${item.unitType}`;
      const rows = groupedByItem.get(key);
      if (rows) {
        rows.push(item);
      } else {
        groupedByItem.set(key, [item]);
      }
    });

    const next: Record<string, RemainingContributorSummary[]> = {};
    groupedByItem.forEach((rows) => {
      const summaryByName = new Map<string, RemainingContributorSummary>();
      rows.forEach((row) => {
        const rawName = typeof row.orderedBy === 'string' ? row.orderedBy : '';
        const name = rawName.trim().length > 0 ? rawName.trim() : 'Unknown';
        const existing = summaryByName.get(name);
        if (existing) {
          existing.reportedTotal += row.reportedRemaining;
          existing.rowCount += 1;
        } else {
          summaryByName.set(name, {
            name,
            reportedTotal: row.reportedRemaining,
            rowCount: 1,
          });
        }
      });

      const breakdown = Array.from(summaryByName.values()).sort((a, b) => {
        if (b.reportedTotal !== a.reportedTotal) return b.reportedTotal - a.reportedTotal;
        return a.name.localeCompare(b.name);
      });

      rows.forEach((row) => {
        next[row.orderItemId] = breakdown;
      });
    });

    return next;
  }, [remainingItems]);

  const formattedItems = useMemo(() => {
    const groupOrder: LocationGroup[] = ['sushi', 'poki'];
    const output = groupOrder
      .map((group) => {
        const orderedEntries: ({ type: 'grouped'; key: string } | { type: 'raw'; line: string })[] = [];
        const groupedLines = new Map<
          string,
          { name: string; quantity: number; unitLabel: string }
        >();
        const regularItems = groupedRegularItems[group] || [];
        const remainingRows = groupedRemainingItems[group] || [];

        const addGroupedLine = ({
          name,
          quantity,
          unitLabel,
          unitType,
        }: {
          name: string;
          quantity: number;
          unitLabel: string;
          unitType: 'base' | 'pack';
        }) => {
          const key = `${name.trim().toLowerCase()}|${unitType}|${unitLabel.trim().toLowerCase()}`;
          const existing = groupedLines.get(key);
          if (existing) {
            existing.quantity += quantity;
            return;
          }

          groupedLines.set(key, { name, quantity, unitLabel });
          orderedEntries.push({ type: 'grouped', key });
        };

        const addRawLine = (line: string) => {
          orderedEntries.push({ type: 'raw', line });
        };

        regularItems.forEach((item) => {
          const settings = getExportSettings(item.id, item.unitType);
          const targetUnit = settings.exportUnitType;
          const unitSelectorProps = getUnitSelectorPropsByInventoryItemId(
            item.inventoryItemId,
            item.unitType,
            item.unitLabel
          );
          const targetUnitLabel =
            targetUnit === 'pack'
              ? unitSelectorProps.packUnitLabel
              : unitSelectorProps.baseUnitLabel;
          const previewEntry = resolvePreviewQuantityAndUnit({
            inventoryItemId: item.inventoryItemId,
            sourceQuantity: item.quantity,
            sourceUnitType: item.unitType,
            sourceUnitLabel: item.unitLabel,
            targetUnitType: targetUnit,
            targetUnitLabel,
          });

          if (!previewEntry || !Number.isFinite(previewEntry.quantity) || previewEntry.quantity <= 0) {
            addRawLine(`- ${item.name}: ${formatQuantity(item.quantity)} ${item.unitLabel}`);
            return;
          }

          addGroupedLine({
            name: item.name,
            quantity: previewEntry.quantity,
            unitLabel: previewEntry.unitLabel,
            unitType: previewEntry.unitType,
          });
        });

        remainingRows.forEach((item) => {
          const settings = getExportSettings(item.orderItemId, item.unitType);
          const targetUnit = settings.exportUnitType;
          const unitSelectorProps = getUnitSelectorPropsByInventoryItemId(
            item.inventoryItemId,
            item.unitType,
            item.unitLabel
          );
          const sourceQty = item.decidedQuantity;
          const isValid =
            sourceQty != null && Number.isFinite(sourceQty) && sourceQty > 0;
          const targetUnitLabel =
            targetUnit === 'pack'
              ? unitSelectorProps.packUnitLabel
              : unitSelectorProps.baseUnitLabel;

          if (!isValid) {
            addRawLine(`- ${item.name}: [set qty] ${targetUnitLabel}`);
            return;
          }

          const previewEntry = resolvePreviewQuantityAndUnit({
            inventoryItemId: item.inventoryItemId,
            sourceQuantity: sourceQty!,
            sourceUnitType: item.unitType,
            sourceUnitLabel: item.unitLabel,
            targetUnitType: targetUnit,
            targetUnitLabel,
          });

          if (!previewEntry || !Number.isFinite(previewEntry.quantity) || previewEntry.quantity <= 0) {
            addRawLine(`- ${item.name}: ${formatQuantity(sourceQty!)} ${item.unitLabel}`);
            return;
          }

          addGroupedLine({
            name: item.name,
            quantity: previewEntry.quantity,
            unitLabel: previewEntry.unitLabel,
            unitType: previewEntry.unitType,
          });
        });

        const lines = orderedEntries.map((entry) => {
          if (entry.type === 'raw') return entry.line;
          const grouped = groupedLines.get(entry.key);
          if (!grouped) return null;
          return `- ${grouped.name}: ${formatQuantity(grouped.quantity)} ${grouped.unitLabel}`;
        }).filter((entry): entry is string => Boolean(entry));

        if (lines.length === 0) return null;
        return `--- ${LOCATION_GROUP_LABELS[group].toUpperCase()} ---\n${lines.join('\n')}`;
      })
      .filter(Boolean)
      .join('\n\n');

    return output.length > 0 ? output : 'No items to order.';
  }, [
    getExportSettings,
    getUnitSelectorPropsByInventoryItemId,
    groupedRegularItems,
    groupedRemainingItems,
    resolvePreviewQuantityAndUnit,
  ]);

  const messageText = useMemo(() => {
    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const variables: Record<string, string> = {
      supplier: supplierLabel,
      date: today,
      items: formattedItems,
    };

    const filled = Object.entries(variables).reduce((text, [key, value]) => {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      return text.replace(pattern, value);
    }, exportFormat.template);

    const normalizedMessage = filled.replace(/\\n/g, '\n');
    assertNoReportedInExportText(normalizedMessage);
    return normalizedMessage;
  }, [exportFormat.template, formattedItems, supplierLabel]);

  const persistRegularRemoval = useCallback(
    async (orderItemIds: string[], status: 'order_later' | 'cancelled' = 'cancelled') => {
      if (orderItemIds.length === 0) return true;
      const success = await markOrderItemsStatus(orderItemIds, status);
      if (!success) {
        showNotice('Unable to Update Item', 'Please try again.');
        return false;
      }
      return true;
    },
    [markOrderItemsStatus]
  );

  const persistRemainingRemoval = useCallback(
    async (orderItemId: string, status: 'order_later' | 'cancelled' = 'cancelled') => {
      if (!orderItemId) return true;
      const success = await markOrderItemsStatus([orderItemId], status);
      if (!success) {
        showNotice('Unable to Move Item', 'Please try again.');
        return false;
      }
      return true;
    },
    [markOrderItemsStatus]
  );

  const handleMoveToSecondarySupplier = useCallback(
    (item: ConfirmationItem) => {
      if (!item.secondarySupplierId || !item.secondarySupplierName) return;
      const targetName = item.secondarySupplierName;
      const targetId = item.secondarySupplierId;

      showNotice(
        `Move to ${targetName}?`,
        `${item.name} will move back to ${targetName} on fulfillment.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Move',
            onPress: () => {
              void (async () => {
                const moved = await setSupplierOverride(item.sourceOrderItemIds, targetId);
                if (!moved) {
                  showNotice('Unable to Move Item', 'Please try again.');
                  return;
                }

                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                setItems((prev) => prev.filter((row) => row.id !== item.id));
              })();
            },
          },
        ]
      );
    },
    [setSupplierOverride]
  );

  const handleMoveRemainingToSecondarySupplier = useCallback(
    (item: RemainingConfirmationItem) => {
      if (!item.secondarySupplierId || !item.secondarySupplierName) return;
      const targetName = item.secondarySupplierName;
      const targetId = item.secondarySupplierId;

      showNotice(
        `Move to ${targetName}?`,
        `${item.name} will move back to ${targetName} on fulfillment.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Move',
            onPress: () => {
              void (async () => {
                const moved = await setSupplierOverride([item.orderItemId], targetId);
                if (!moved) {
                  showNotice('Unable to Move Item', 'Please try again.');
                  return;
                }

                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                setRemainingItems((prev) =>
                  prev.filter((row) => row.orderItemId !== item.orderItemId)
                );
              })();
            },
          },
        ]
      );
    },
    [setSupplierOverride]
  );

  const moveDraftItemsToSupplier = useCallback(
    (draftIds: string[], targetSupplierId: string) => {
      const store = useOrderStore.getState();
      const allDrafts = Object.values(store.supplierDrafts || {}).flat();

      draftIds.forEach((draftId) => {
        const draft = allDrafts.find((row) => row.id === draftId);
        if (!draft) return;

        removeSupplierDraftItem(draftId);
        addSupplierDraftItem({
          supplierId: targetSupplierId,
          inventoryItemId: draft.inventoryItemId,
          name: draft.name,
          category: draft.category,
          quantity: draft.quantity,
          unitType: draft.unitType,
          unitLabel: draft.unitLabel,
          locationGroup: draft.locationGroup,
          locationId: draft.locationId,
          locationName: draft.locationName,
          note: draft.note,
          sourceOrderLaterItemId: draft.sourceOrderLaterItemId,
        });
      });
    },
    [addSupplierDraftItem, removeSupplierDraftItem]
  );

  const moveRegularItemToSupplier = useCallback(
    async (item: ConfirmationItem, targetSupplierId: string) => {
      if (!targetSupplierId || targetSupplierId === supplierId) return false;

      const hasOrderItems = item.sourceOrderItemIds.length > 0;
      const hasDraftItems = item.sourceDraftItemIds.length > 0;
      if (!hasOrderItems && !hasDraftItems) return false;

      if (hasOrderItems) {
        const moved = await setSupplierOverride(item.sourceOrderItemIds, targetSupplierId);
        if (!moved) return false;
      }

      if (hasDraftItems) {
        try {
          moveDraftItemsToSupplier(item.sourceDraftItemIds, targetSupplierId);
        } catch {
          return false;
        }
      }

      setItems((prev) => prev.filter((row) => row.id !== item.id));
      return true;
    },
    [moveDraftItemsToSupplier, setSupplierOverride, supplierId]
  );

  const moveRemainingItemToSupplier = useCallback(
    async (item: RemainingConfirmationItem, targetSupplierId: string) => {
      if (!targetSupplierId || targetSupplierId === supplierId || !item.orderItemId) {
        return false;
      }

      const moved = await setSupplierOverride([item.orderItemId], targetSupplierId);
      if (!moved) return false;

      setRemainingItems((prev) => prev.filter((row) => row.orderItemId !== item.orderItemId));
      return true;
    },
    [setSupplierOverride, supplierId]
  );

  const handleSupplierPickerSelect = useCallback(
    async (targetSupplierId: string) => {
      if (!supplierPickerTarget) return;

      setIsMovingSupplier(true);
      try {
        const success =
          supplierPickerTarget.kind === 'regular'
            ? await moveRegularItemToSupplier(supplierPickerTarget.item, targetSupplierId)
            : await moveRemainingItemToSupplier(supplierPickerTarget.item, targetSupplierId);

        if (!success) {
          showNotice('Unable to Move Item', 'Please try again.');
          return;
        }

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setSupplierPickerTarget(null);
      } finally {
        setIsMovingSupplier(false);
      }
    },
    [moveRegularItemToSupplier, moveRemainingItemToSupplier, supplierPickerTarget]
  );

  const handleDelete = useCallback(
    (item: ConfirmationItem) => {
      showNotice('Remove Item', `Remove ${item.name} from this supplier order?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const removed = await persistRegularRemoval(item.sourceOrderItemIds);
              if (!removed) return;

              if (item.sourceDraftItemIds.length > 0) {
                removeSupplierDraftItems(item.sourceDraftItemIds);
              }

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }

              setItems((prev) => prev.filter((row) => row.id !== item.id));
            })();
          },
        },
      ]);
    },
    [persistRegularRemoval, removeSupplierDraftItems]
  );

  const handleDeleteRemaining = useCallback(
    (item: RemainingConfirmationItem) => {
      showNotice('Remove Item', `Remove ${item.name} from this supplier order?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const removed = await persistRemainingRemoval(item.orderItemId);
              if (!removed) return;

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
              setRemainingItems((prev) =>
                prev.filter((row) => row.orderItemId !== item.orderItemId)
              );
            })();
          },
        },
      ]);
    },
    [persistRemainingRemoval]
  );

  const orderLaterRegularItem = useMemo(() => {
    if (!orderLaterTarget || orderLaterTarget.kind !== 'regular') return null;
    return items.find((row) => row.id === orderLaterTarget.id) ?? null;
  }, [items, orderLaterTarget]);

  const orderLaterRemainingItem = useMemo(() => {
    if (!orderLaterTarget || orderLaterTarget.kind !== 'remaining') return null;
    return remainingItems.find((row) => row.orderItemId === orderLaterTarget.id) ?? null;
  }, [orderLaterTarget, remainingItems]);

  const overflowRegularItem = useMemo(() => {
    if (!overflowTarget || overflowTarget.kind !== 'regular') return null;
    return items.find((row) => row.id === overflowTarget.id) ?? null;
  }, [items, overflowTarget]);

  const overflowRemainingItem = useMemo(() => {
    if (!overflowTarget || overflowTarget.kind !== 'remaining') return null;
    return remainingItems.find((row) => row.orderItemId === overflowTarget.id) ?? null;
  }, [overflowTarget, remainingItems]);

  const noteRegularItem = useMemo(() => {
    if (!noteEditorTarget || noteEditorTarget.kind !== 'regular') return null;
    return items.find((row) => row.id === noteEditorTarget.id) ?? null;
  }, [items, noteEditorTarget]);

  const noteRemainingItem = useMemo(() => {
    if (!noteEditorTarget || noteEditorTarget.kind !== 'remaining') return null;
    return remainingItems.find((row) => row.orderItemId === noteEditorTarget.id) ?? null;
  }, [noteEditorTarget, remainingItems]);

  const closeNoteEditor = useCallback(() => {
    setNoteEditorTarget(null);
    setNoteDraft('');
  }, []);

  const handleOpenRegularNoteEditor = useCallback((item: ConfirmationItem) => {
    setOverflowTarget(null);
    setNoteEditorTarget({ kind: 'regular', id: item.id });
    setNoteDraft(item.notes.map((note) => note.text.trim()).filter((note) => note.length > 0).join(' • '));
  }, []);

  const handleOpenRemainingNoteEditor = useCallback((item: RemainingConfirmationItem) => {
    setOverflowTarget(null);
    setNoteEditorTarget({ kind: 'remaining', id: item.orderItemId });
    setNoteDraft(item.note ?? '');
  }, []);

  const handleSaveNote = useCallback(async () => {
    const regularTarget = noteRegularItem;
    const remainingTarget = noteRemainingItem;
    if (!regularTarget && !remainingTarget) return;

    const normalized = noteDraft.trim();
    setIsSavingNote(true);
    try {
      if (regularTarget && regularTarget.sourceOrderItemIds.length > 0) {
        const { error } = await (supabase as any)
          .from('order_items')
          .update({ note: normalized.length > 0 ? normalized : null })
          .in('id', regularTarget.sourceOrderItemIds);
        if (error) throw error;
      }

      if (remainingTarget) {
        const { error } = await (supabase as any)
          .from('order_items')
          .update({ note: normalized.length > 0 ? normalized : null })
          .eq('id', remainingTarget.orderItemId);
        if (error) throw error;
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      closeNoteEditor();
      await refreshFromSupplierSource();
    } catch (error: unknown) {
      showNotice('Unable to Save Note', getErrorMessage(error, 'Please try again.'));
    } finally {
      setIsSavingNote(false);
    }
  }, [
    closeNoteEditor,
    noteDraft,
    noteRegularItem,
    noteRemainingItem,
    refreshFromSupplierSource,
  ]);

  const showRemainingBreakdown = useCallback(
    (item: RemainingConfirmationItem) => {
      const rows = remainingContributorBreakdownByOrderItemId[item.orderItemId] ?? [];
      if (rows.length <= 1) {
        showNotice('Breakdown', 'Only one employee contributed to this line.');
        return;
      }

      const message = rows
        .map((entry) => {
          const unit = item.unitLabel;
          const entryCount = entry.rowCount > 1 ? ` • ${entry.rowCount} entries` : '';
          return `${entry.name}: ${formatQuantity(entry.reportedTotal)} ${unit}${entryCount}`;
        })
        .join('\n');
      showNotice('Per-Employee Breakdown', message);
    },
    [remainingContributorBreakdownByOrderItemId]
  );

  const getRegularUnitSiblings = useCallback(
    (item: ConfirmationItem) =>
      items.filter(
        (row) =>
          row.id !== item.id &&
          row.inventoryItemId === item.inventoryItemId &&
          row.locationGroup === item.locationGroup
      ),
    [items]
  );

  const getRegularConversionMultiplier = useCallback(
    (source: ConfirmationItem, target: ConfirmationItem) => {
      const unitInfo = unitInfoMap[source.inventoryItemId];
      return resolveUnitConversionMultiplier({
        inventoryItemId: source.inventoryItemId,
        fromUnitLabel: source.unitLabel,
        toUnitLabel: target.unitLabel,
        fromUnitType: source.unitType,
        toUnitType: target.unitType,
        packSize: unitInfo?.pack_size ?? null,
        lookup: unitConversionLookup,
      });
    },
    [unitConversionLookup, unitInfoMap]
  );

  const combineRegularItemIntoTarget = useCallback(
    (sourceItemId: string, targetItemId: string) => {
      setItems((prev) => {
        const source = prev.find((row) => row.id === sourceItemId);
        const target = prev.find((row) => row.id === targetItemId);
        if (!source || !target) return prev;

        const conversionMultiplier = getRegularConversionMultiplier(source, target);
        if (!conversionMultiplier) return prev;

        const convertedQuantity = applyUnitConversion(source.quantity, conversionMultiplier);
        const convertedContributorTotal = applyUnitConversion(
          source.sumOfContributorQuantities,
          conversionMultiplier
        );

        if (!Number.isFinite(convertedQuantity) || convertedQuantity <= 0) return prev;

        const contributorMap = new Map<string, ConfirmationContributor>();
        target.contributors.forEach((entry) => {
          contributorMap.set(`${entry.userId || entry.name}:${entry.name}`, { ...entry });
        });
        source.contributors.forEach((entry) => {
          const converted = applyUnitConversion(entry.quantity, conversionMultiplier);
          if (!Number.isFinite(converted) || converted <= 0) return;

          const contributorKey = `${entry.userId || entry.name}:${entry.name}`;
          const existing = contributorMap.get(contributorKey);
          if (existing) {
            existing.quantity += converted;
          } else {
            contributorMap.set(contributorKey, {
              ...entry,
              quantity: converted,
            });
          }
        });

        const detailMap = new Map<string, ConfirmationDetail>();
        target.details.forEach((entry) => {
          detailMap.set(`${entry.locationId || entry.locationName}:${entry.orderedBy}`, { ...entry });
        });
        source.details.forEach((entry) => {
          const converted = applyUnitConversion(entry.quantity, conversionMultiplier);
          if (!Number.isFinite(converted) || converted <= 0) return;

          const key = `${entry.locationId || entry.locationName}:${entry.orderedBy}`;
          const existing = detailMap.get(key);
          if (existing) {
            existing.quantity += converted;
          } else {
            detailMap.set(key, {
              ...entry,
              quantity: converted,
            });
          }
        });

        const notes = [...target.notes];
        source.notes.forEach((note) => {
          if (!notes.some((existing) => existing.id === note.id || existing.text === note.text)) {
            notes.push({ ...note });
          }
        });

        const mergedTarget: ConfirmationItem = {
          ...target,
          quantity: target.quantity + convertedQuantity,
          sumOfContributorQuantities:
            target.sumOfContributorQuantities + convertedContributorTotal,
          sourceOrderItemIds: Array.from(
            new Set([...target.sourceOrderItemIds, ...source.sourceOrderItemIds])
          ),
          sourceOrderIds: Array.from(new Set([...target.sourceOrderIds, ...source.sourceOrderIds])),
          sourceDraftItemIds: Array.from(
            new Set([...target.sourceDraftItemIds, ...source.sourceDraftItemIds])
          ),
          contributors: Array.from(contributorMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
          details: Array.from(detailMap.values()).sort((a, b) =>
            a.locationName.localeCompare(b.locationName)
          ),
          notes: notes.sort((a, b) => a.text.localeCompare(b.text)),
        };

        return prev
          .filter((row) => row.id !== source.id)
          .map((row) => (row.id === target.id ? mergedTarget : row));
      });

    },
    [getRegularConversionMultiplier]
  );

  const handleResolveUnitCombine = useCallback(
    (item: ConfirmationItem) => {
      const siblings = getRegularUnitSiblings(item).filter(
        (row) => row.unitType !== item.unitType
      );

      if (siblings.length === 0) {
        showNotice(
          'No Unit Conflict',
          'This line has no alternate unit line to combine with.'
        );
        return;
      }

      const convertibleTargets = siblings.filter((target) => {
        const multiplier = getRegularConversionMultiplier(item, target);
        return Number.isFinite(multiplier) && (multiplier as number) > 0;
      });

      if (convertibleTargets.length === 0) {
        showNotice(
          'No Conversion Available',
          'No conversion rule is defined for this item yet. It will stay as separate lines.'
        );
        return;
      }

      const options = convertibleTargets.map((target) => ({
        text: `Convert into ${target.unitLabel}`,
        onPress: () => combineRegularItemIntoTarget(item.id, target.id),
      }));

      showNotice(
        'Resolve Units',
        `Choose how to resolve ${item.name}.`,
        [
          {
            text: 'Send as separate lines',
            style: 'cancel',
            onPress: () => {},
          },
          ...options,
        ]
      );
    },
    [combineRegularItemIntoTarget, getRegularConversionMultiplier, getRegularUnitSiblings]
  );

  const handleResetToSum = useCallback((item: ConfirmationItem) => {
    const resetQuantity = Math.max(0, item.sumOfContributorQuantities);
    if (resetQuantity <= 0) return;
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              quantity: resetQuantity,
            }
          : row
      )
    );
    if (item.sourceDraftItemIds.length === 1) {
      updateSupplierDraftItemQuantity(item.sourceDraftItemIds[0], resetQuantity);
    }
  }, [updateSupplierDraftItemQuantity]);

  const overflowActionSections = useMemo<ItemActionSheetSection[]>(() => {
    if (!overflowRegularItem && !overflowRemainingItem) return [];

    if (overflowRegularItem) {
      const sections: ItemActionSheetSection[] = [];
      const regularLogisticsItems: ItemActionSheetSection['items'] = [
          {
            id: 'regular-order-later',
            label: 'Move to Order Later',
            icon: 'time-outline',
            onPress: () => {
              setOverflowTarget(null);
              setOrderLaterTarget({ kind: 'regular', id: overflowRegularItem.id });
            },
          },
          ...(overflowRegularItem.contributors.length > 1
            ? [
                {
                  id: 'regular-breakdown',
                  label: 'View breakdown',
                  icon: 'list-outline' as const,
                  onPress: () => {
                    setOverflowTarget(null);
                    showNotice(
                      'Per-employee breakdown',
                      overflowRegularItem.contributors
                        .map(
                          (contributor) =>
                            `${contributor.name}: ${formatQuantity(contributor.quantity)} ${overflowRegularItem.unitLabel}`,
                        )
                        .join('\n'),
                    );
                  },
                },
                ...(Math.abs(
                  overflowRegularItem.quantity -
                    overflowRegularItem.sumOfContributorQuantities,
                ) > 0.000001
                  ? [
                      {
                        id: 'regular-reset-total',
                        label: 'Reset to employee total',
                        icon: 'refresh-outline' as const,
                        onPress: () => {
                          setOverflowTarget(null);
                          handleResetToSum(overflowRegularItem);
                        },
                      },
                    ]
                  : []),
              ]
            : []),
          ...(getRegularUnitSiblings(overflowRegularItem).some(
            (row) =>
              row.unitType !== overflowRegularItem.unitType &&
              Number.isFinite(getRegularConversionMultiplier(overflowRegularItem, row)) &&
              (getRegularConversionMultiplier(overflowRegularItem, row) as number) > 0
          )
            ? [
                {
                  id: 'regular-resolve-units',
                  label: 'Resolve units / Combine',
                  icon: 'git-merge-outline' as const,
                  onPress: () => {
                    setOverflowTarget(null);
                    handleResolveUnitCombine(overflowRegularItem);
                  },
                },
              ]
            : []),
      ];

      if (
        hasAlternateSupplierOptions &&
        (overflowRegularItem.sourceOrderItemIds.length > 0 ||
          overflowRegularItem.sourceDraftItemIds.length > 0)
      ) {
        regularLogisticsItems.push({
          id: 'regular-move-supplier',
          label: 'Move to Different Supplier',
          icon: 'swap-horizontal',
          detail: 'Reassign this line to another supplier for this order.',
          onPress: () => {
            setOverflowTarget(null);
            setSupplierPickerTarget({ kind: 'regular', item: overflowRegularItem });
          },
        });
      }

      sections.push({
        id: 'regular-logistics',
        title: 'Logistics',
        items: regularLogisticsItems,
      });

      const supplierItems = [];
      if (overflowRegularItem.secondarySupplierId && overflowRegularItem.secondarySupplierName) {
        supplierItems.push({
          id: 'regular-secondary',
          label: `Move to ${overflowRegularItem.secondarySupplierName}`,
          icon: 'swap-horizontal',
          onPress: () => {
            setOverflowTarget(null);
            handleMoveToSecondarySupplier(overflowRegularItem);
          },
        });
      }
      if (supplierItems.length > 0) {
        sections.push({
          id: 'regular-supplier',
          title: 'Supplier',
          items: supplierItems,
        });
      }

      sections.push({
        id: 'regular-item',
        title: 'Item',
        items: [
          {
            id: 'regular-note',
            label: overflowRegularItem.notes.length > 0 ? 'Edit Note' : 'Add Note',
            icon: 'create-outline',
            onPress: () => handleOpenRegularNoteEditor(overflowRegularItem),
          },
        ],
      });

      sections.push({
        id: 'regular-danger',
        title: 'Danger Zone',
        items: [
          {
            id: 'regular-remove',
            label: 'Remove item from this supplier order',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => {
              setOverflowTarget(null);
              handleDelete(overflowRegularItem);
            },
          },
        ],
      });

      return sections;
    }

    if (overflowRemainingItem) {
      const sections: ItemActionSheetSection[] = [];
      const breakdown = remainingContributorBreakdownByOrderItemId[overflowRemainingItem.orderItemId] ?? [];
      const logisticsItems: ItemActionSheetSection['items'] = [
        {
          id: 'remaining-order-later',
          label: 'Move to Order Later',
          icon: 'time-outline' as const,
          onPress: () => {
            setOverflowTarget(null);
            setOrderLaterTarget({ kind: 'remaining', id: overflowRemainingItem.orderItemId });
          },
        },
        ...(breakdown.length > 1
          ? [
              {
                id: 'remaining-breakdown',
                label: 'View breakdown',
                icon: 'list-outline' as const,
                onPress: () => {
                  setOverflowTarget(null);
                  showRemainingBreakdown(overflowRemainingItem);
                },
              },
            ]
          : []),
      ];

      if (hasAlternateSupplierOptions && overflowRemainingItem.orderItemId) {
        logisticsItems.push({
          id: 'remaining-move-supplier',
          label: 'Move to Different Supplier',
          icon: 'swap-horizontal',
          detail: 'Reassign this line to another supplier for this order.',
          onPress: () => {
            setOverflowTarget(null);
            setSupplierPickerTarget({ kind: 'remaining', item: overflowRemainingItem });
          },
        });
      }

      sections.push({
        id: 'remaining-logistics',
        title: 'Logistics',
        items: logisticsItems,
      });

      if (overflowRemainingItem.secondarySupplierId && overflowRemainingItem.secondarySupplierName) {
        sections.push({
          id: 'remaining-supplier',
          title: 'Supplier',
          items: [
            {
              id: 'remaining-secondary',
              label: `Move to ${overflowRemainingItem.secondarySupplierName}`,
              icon: 'swap-horizontal',
              onPress: () => {
                setOverflowTarget(null);
                handleMoveRemainingToSecondarySupplier(overflowRemainingItem);
              },
            },
          ],
        });
      }

      sections.push({
        id: 'remaining-item',
        title: 'Item',
        items: [
          {
            id: 'remaining-note',
            label: overflowRemainingItem.note ? 'Edit Note' : 'Add Note',
            icon: 'create-outline',
            onPress: () => handleOpenRemainingNoteEditor(overflowRemainingItem),
          },
        ],
      });

      sections.push({
        id: 'remaining-danger',
        title: 'Danger Zone',
        items: [
          {
            id: 'remaining-remove',
            label: 'Remove item from this supplier order',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => {
              setOverflowTarget(null);
              handleDeleteRemaining(overflowRemainingItem);
            },
          },
        ],
      });

      return sections;
    }

    return [];
  }, [
    handleDelete,
    handleDeleteRemaining,
    handleMoveRemainingToSecondarySupplier,
    handleMoveToSecondarySupplier,
    hasAlternateSupplierOptions,
    handleOpenRegularNoteEditor,
    handleOpenRemainingNoteEditor,
    handleResetToSum,
    handleResolveUnitCombine,
    overflowRegularItem,
    overflowRemainingItem,
    remainingContributorBreakdownByOrderItemId,
    getRegularConversionMultiplier,
    getRegularUnitSiblings,
    showRemainingBreakdown,
  ]);

  const handleRegularItemOverflow = useCallback((item: ConfirmationItem) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setOverflowTarget({ kind: 'regular', id: item.id });
  }, []);

  const handleRemainingItemOverflow = useCallback((item: RemainingConfirmationItem) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setOverflowTarget({ kind: 'remaining', id: item.orderItemId });
  }, []);

  const handleQuantityChange = useCallback(
    (item: ConfirmationItem, newQuantity: number) => {
      if (!Number.isFinite(newQuantity)) return;
      const safeValue = Math.max(0, newQuantity);

      if (safeValue <= 0) {
        handleDelete(item);
        return;
      }

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                quantity: safeValue,
              }
            : row
        )
      );

      if (item.sourceDraftItemIds.length === 1) {
        updateSupplierDraftItemQuantity(item.sourceDraftItemIds[0], safeValue);
      }
    },
    [handleDelete, updateSupplierDraftItemQuantity]
  );

  const setRemainingDecisionLocal = useCallback((orderItemId: string, decidedQuantity: number | null) => {
    setRemainingItems((prev) =>
      prev.map((item) =>
        item.orderItemId === orderItemId
          ? {
              ...item,
              decidedQuantity,
            }
          : item
      )
    );
  }, []);

  const handleRemainingQuantityChange = useCallback(
    (item: RemainingConfirmationItem, nextValue: number | null) => {
      if (nextValue == null) {
        setRemainingDecisionLocal(item.orderItemId, null);
        return;
      }

      const safeValue = Math.max(0, nextValue);
      const previousValue = item.decidedQuantity;
      setRemainingDecisionLocal(item.orderItemId, safeValue);
      void persistRemainingDecision(item.orderItemId, safeValue, { silent: true }).then((saved) => {
        if (!saved) {
          setRemainingDecisionLocal(item.orderItemId, previousValue);
        }
      });
    },
    [persistRemainingDecision, setRemainingDecisionLocal]
  );

  const handleAutoFillSuggestions = useCallback(async () => {
    const unresolvedItems = remainingItems.filter(
      (item) =>
        item.decidedQuantity == null ||
        !Number.isFinite(item.decidedQuantity) ||
        item.decidedQuantity <= 0
    );

    if (unresolvedItems.length === 0) {
      showNotice('Already Filled', 'All remaining items already have final quantities.');
      return;
    }

    const candidates = unresolvedItems
      .map((item) => ({ item, suggestion: getSuggestion(item) }))
      .filter(
        (entry): entry is { item: RemainingConfirmationItem; suggestion: number } =>
          entry.suggestion != null && Number.isFinite(entry.suggestion)
      );

    if (candidates.length === 0) {
      showNotice(
        historyUnavailableOffline ? 'History Unavailable Offline' : 'No History Available',
        historyUnavailableOffline
          ? 'Reconnect to load last ordered quantities.'
          : 'No previous order quantities were found for the unresolved items.'
      );
      return;
    }

    const previousValuesById = new Map(
      remainingItems.map((item) => [item.orderItemId, item.decidedQuantity] as const)
    );
    const nextById = new Map(candidates.map((entry) => [entry.item.orderItemId, entry.suggestion]));
    setRemainingItems((prev) =>
      prev.map((item) =>
        nextById.has(item.orderItemId)
          ? {
              ...item,
              decidedQuantity: nextById.get(item.orderItemId) ?? item.decidedQuantity,
            }
          : item
      )
    );

    const results = await Promise.all(
      candidates.map((entry) =>
        persistRemainingDecision(entry.item.orderItemId, entry.suggestion, { silent: true })
      )
    );
    results.forEach((saved, index) => {
      if (saved) return;
      const failedItem = candidates[index]?.item;
      if (!failedItem) return;
      setRemainingDecisionLocal(
        failedItem.orderItemId,
        previousValuesById.get(failedItem.orderItemId) ?? null
      );
    });
    const successCount = results.filter(Boolean).length;

    if (successCount > 0) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      showNotice('Suggestions Applied', `Updated ${successCount} remaining item${successCount === 1 ? '' : 's'}.`);
    }
  }, [
    getSuggestion,
    historyUnavailableOffline,
    persistRemainingDecision,
    remainingItems,
    setRemainingDecisionLocal,
  ]);

  const buildFinalizePayload = useCallback(() => {
    return buildFinalizePayloadFromItems(items, remainingItems);
  }, [items, remainingItems]);

  const finalizeOrder = useCallback(
    async (shareMethod: 'share' | 'copy') => {
      if (finalizeInFlightRef.current) {
        return false;
      }
      finalizeInFlightRef.current = true;

      try {
        if (!user?.id) {
          showNotice('Sign In Required', 'Please sign in again to finalize this order.');
          return false;
        }
        if (!supplierId) {
          showNotice('Missing Supplier', 'Unable to finalize because supplier info is missing.');
          return false;
        }

        let payload = buildFinalizePayload();
        if (
          payload.consumedOrderItemIds.length === 0 &&
          payload.consumedDraftItemIds.length === 0
        ) {
          const refreshed = await refreshFromSupplierSource();
          if (refreshed) {
            payload = buildFinalizePayloadFromItems(refreshed.regularItems, refreshed.remainingItems);
          }
        }

        if (
          payload.consumedOrderItemIds.length === 0 &&
          payload.consumedDraftItemIds.length === 0
        ) {
          showNotice(
            'Finalize Blocked',
            'No source links were found for these items. Pull to refresh and try again.'
          );
          return false;
        }

        try {
          const staleIds = await findStaleConsumedOrderItemIds(payload.consumedOrderItemIds);
          if (staleIds.length > 0) {
            showNotice(
              'Order Changed',
              'Some items were already processed on another device. The screen will refresh now.'
            );
            await fetchPendingFulfillmentOrders(managerLocationIds);
            handleBackPress();
            return false;
          }
        } catch {
          // Freshness validation is best-effort when the device is offline.
        }

        setIsFinalizing(true);
        try {
          // createPastOrder (called by finalizeSupplierOrder) handles:
          //   1. Inserting into past_orders + past_order_items tables
          //   2. Calling markOrderItemsStatus to set status='sent'
          //   3. Updating local state (pastOrders, orders) to remove consumed items
          //   4. Queueing for offline sync if DB operations fail
          await finalizeSupplierOrder({
            supplierId,
            supplierName: supplierLabel,
            createdBy: user.id,
            messageText,
            shareMethod,
            payload: {
              regularItems: payload.regularPayload,
              remainingItems: payload.remainingPayload,
              locations: payload.locationLabels,
              sourceOrderIds: payload.sourceOrderIds,
              source_order_ids: payload.sourceOrderIds,
              sourceOrderItemIds: payload.consumedOrderItemIds,
              source_order_item_ids: payload.consumedOrderItemIds,
              totalItemCount: payload.totalItemCount,
              finalizedAt: new Date().toISOString(),
            },
            consumedOrderItemIds: payload.consumedOrderItemIds,
            consumedDraftItemIds: payload.consumedDraftItemIds,
            lineItems: payload.historyLineItems,
          });

          // Refresh fulfillment data so the cleared items don't reappear
          try {
            await fetchPendingFulfillmentOrders(managerLocationIds);
          } catch {
            // Non-critical: local state was already updated by createPastOrder
          }

          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          handleBackPress();
          return true;
        } catch (error: unknown) {
          showNotice(
            'Finalize Failed',
            getErrorMessage(error, 'Unable to move this order to past orders.'),
          );
          return false;
        } finally {
          setIsFinalizing(false);
        }
      } finally {
        finalizeInFlightRef.current = false;
      }
    },
    [
      buildFinalizePayload,
      fetchPendingFulfillmentOrders,
      finalizeSupplierOrder,
      handleBackPress,
      managerLocationIds,
      messageText,
      refreshFromSupplierSource,
      supplierId,
      supplierLabel,
      user?.id,
    ]
  );

  const handleMoveTargetToOrderLater = useCallback(
    async (scheduledAtIso: string) => {
      if (!user?.id) {
        showNotice('Sign In Required', 'Please sign in again to schedule order-later items.');
        return;
      }

      const preferredSupplierId = supplierId ?? undefined;

      if (orderLaterRegularItem) {
        const removed = await persistRegularRemoval(orderLaterRegularItem.sourceOrderItemIds, 'order_later');
        if (!removed) return;

        if (orderLaterRegularItem.sourceDraftItemIds.length > 0) {
          removeSupplierDraftItems(orderLaterRegularItem.sourceDraftItemIds);
        }

        const noteText = orderLaterRegularItem.notes
          .map((note) => note.text.trim())
          .filter((note) => note.length > 0)
          .join(' • ');
        const firstDetail = orderLaterRegularItem.details[0];

        await createOrderLaterItem({
          createdBy: user.id,
          scheduledAt: scheduledAtIso,
          quantity: orderLaterRegularItem.quantity,
          itemId: orderLaterRegularItem.inventoryItemId,
          itemName: orderLaterRegularItem.name,
          unit: orderLaterRegularItem.unitLabel,
          locationId: firstDetail?.locationId,
          locationName: firstDetail?.locationName,
          notes: noteText.length > 0 ? noteText : null,
          suggestedSupplierId: preferredSupplierId,
          preferredSupplierId,
          preferredLocationGroup: orderLaterRegularItem.locationGroup,
          sourceOrderItemId:
            orderLaterRegularItem.sourceOrderItemIds.length === 1
              ? orderLaterRegularItem.sourceOrderItemIds[0]
              : null,
          sourceOrderItemIds: orderLaterRegularItem.sourceOrderItemIds,
          sourceOrderId:
            orderLaterRegularItem.sourceOrderIds.length === 1
              ? orderLaterRegularItem.sourceOrderIds[0]
              : null,
          payload: {
            quantity: orderLaterRegularItem.quantity,
            unitType: orderLaterRegularItem.unitType,
            unitLabel: orderLaterRegularItem.unitLabel,
            category: orderLaterRegularItem.category,
            locationGroup: orderLaterRegularItem.locationGroup,
            sourceDraftItemIds: orderLaterRegularItem.sourceDraftItemIds,
          },
        });

        setItems((prev) => prev.filter((item) => item.id !== orderLaterRegularItem.id));
      } else if (orderLaterRemainingItem) {
        const removed = await persistRemainingRemoval(orderLaterRemainingItem.orderItemId, 'order_later');
        if (!removed) return;

        await createOrderLaterItem({
          createdBy: user.id,
          scheduledAt: scheduledAtIso,
          quantity: orderLaterRemainingItem.decidedQuantity ?? 0,
          itemId: orderLaterRemainingItem.inventoryItemId,
          itemName: orderLaterRemainingItem.name,
          unit: orderLaterRemainingItem.unitLabel,
          locationId: orderLaterRemainingItem.locationId,
          locationName: orderLaterRemainingItem.locationName,
          notes: orderLaterRemainingItem.note,
          suggestedSupplierId: preferredSupplierId,
          preferredSupplierId,
          preferredLocationGroup: orderLaterRemainingItem.locationGroup,
          sourceOrderItemId: orderLaterRemainingItem.orderItemId,
          sourceOrderItemIds: [orderLaterRemainingItem.orderItemId],
          sourceOrderId: orderLaterRemainingItem.orderId,
          payload: {
            quantity: orderLaterRemainingItem.decidedQuantity ?? 0,
            reportedRemaining: orderLaterRemainingItem.reportedRemaining,
            unitType: orderLaterRemainingItem.unitType,
            unitLabel: orderLaterRemainingItem.unitLabel,
            category: orderLaterRemainingItem.category,
            locationGroup: orderLaterRemainingItem.locationGroup,
            inputMode: 'remaining',
          },
        });

        setRemainingItems((prev) =>
          prev.filter((item) => item.orderItemId !== orderLaterRemainingItem.orderItemId)
        );
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      showNotice('Moved to Order Later', 'Item moved to Order Later.');
      setOrderLaterTarget(null);
    },
    [
      createOrderLaterItem,
      orderLaterRegularItem,
      orderLaterRemainingItem,
      persistRegularRemoval,
      persistRemainingRemoval,
      removeSupplierDraftItems,
      supplierId,
      user?.id,
    ]
  );

  const handleShareOrder = useCallback(async () => {
    if (finalizeInFlightRef.current) {
      return;
    }
    if (actionsDisabled) {
      showNotice('Decision Required', 'Set final quantities greater than zero for all remaining items before ordering.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Start finalization in parallel with the share sheet so DB work
    // happens while the user is interacting with the share dialog.
    const finalizePromise = finalizeOrder('share');

    try {
      await Share.share({
        message: messageText,
        title: `${supplierLabel} Order`,
      });
    } catch {
      // Share dialog threw (rare) — finalization still running in background.
    }

    // Wait for finalization to finish (usually already done by now).
    await finalizePromise;
  }, [actionsDisabled, finalizeOrder, messageText, supplierLabel]);

  const handleCopyToClipboard = useCallback(async () => {
    if (finalizeInFlightRef.current) {
      return;
    }
    if (actionsDisabled) {
      showNotice('Decision Required', 'Set final quantities greater than zero for all remaining items before ordering.');
      return;
    }

    await Clipboard.setStringAsync(messageText);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Always finalize after copy — the order is done.
    await finalizeOrder('copy');
  }, [actionsDisabled, finalizeOrder, messageText]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color.page }}
      edges={['left', 'right']}
    >
      <ScreenHeader
        mode="pushed"
        title={supplierLabel}
        onBack={handleBackPress}
        right={
          <StatusPill
            status="submitted"
            showDot={false}
            label={remainingItems.length > 0 ? `${remainingItems.length} remaining` : 'Ready'}
          />
        }
      />

      <FlatList
        data={reviewListEntries}
        keyExtractor={(entry) => entry.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: ds.spacing(space[4]),
          paddingTop: ds.spacing(2),
          paddingBottom: ds.spacing(120),
        }}
        ListHeaderComponent={
          <View>
            <View
              style={{
                flexDirection: 'row',
                gap: ds.spacing(10),
                marginBottom: ds.spacing(12),
              }}
            >
              {[
                { label: 'items', value: reviewListEntries.length },
                { label: 'remaining', value: remainingItems.length },
                { label: 'people', value: peopleCount },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    paddingHorizontal: ds.spacing(space[3]),
                    paddingVertical: ds.spacing(space[3]),
                    borderRadius: radius.control,
                    backgroundColor: color.card,
                  }}
                >
                  <Text
                    style={{
                      fontSize: ds.fontSize(typeScale.stat),
                      fontWeight: weight.bold,
                      color: color.ink,
                    }}
                  >
                    {stat.value}
                  </Text>
                  <Text
                    style={{
                      marginTop: ds.spacing(space[1]),
                      fontSize: ds.fontSize(typeScale.meta),
                      color: color.ink2,
                    }}
                  >
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>

            {reviewNotes.length > 0 ? (
              <View
                style={{
                  padding: ds.spacing(14),
                  borderRadius: radius.card,
                  backgroundColor: color.tint,
                  gap: ds.spacing(space[2]),
                }}
              >
                {reviewNotes.map((note) => (
                  <View key={note.id}>
                    <Text
                      style={{
                        fontSize: ds.fontSize(typeScale.itemDense),
                        lineHeight: ds.fontSize(typeScale.itemDense) * 1.45,
                        color: color.accent,
                      }}
                    >
                      {note.text}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <SectionLabel style={{ flex: 1 }}>Items</SectionLabel>
              <TouchableOpacity
                onPress={handleAutoFillSuggestions}
                disabled={
                  suggestionCount === 0 ||
                  loadingLastOrdered ||
                  savingRemainingIds.size > 0
                }
                accessibilityRole="button"
                accessibilityLabel="Auto-fill remaining quantities"
                accessibilityState={{
                  disabled:
                    suggestionCount === 0 ||
                    loadingLastOrdered ||
                    savingRemainingIds.size > 0,
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingHorizontal: ds.spacing(space[1]) }}
              >
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.caption),
                    fontWeight: weight.semibold,
                    color: color.accent,
                    opacity:
                      suggestionCount === 0 ||
                      loadingLastOrdered ||
                      savingRemainingIds.size > 0
                        ? 0.45
                        : 1,
                  }}
                >
                  Auto-fill
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item: entry, index }) => {
          const last = index === reviewListEntries.length - 1;

          if (entry.type === 'remaining') {
            const item = entry.item;
            const settings = getExportSettings(item.orderItemId, item.unitType);
            return (
              <View
                style={{
                  overflow: 'hidden',
                  backgroundColor: color.card,
                  borderTopLeftRadius: index === 0 ? radius.card : 0,
                  borderTopRightRadius: index === 0 ? radius.card : 0,
                  borderBottomLeftRadius: last ? radius.card : 0,
                  borderBottomRightRadius: last ? radius.card : 0,
                  paddingTop: index === 0 ? ds.spacing(2) : 0,
                  paddingBottom: last ? ds.spacing(2) : 0,
                }}
              >
                <RemainingItemRow
                  item={item}
                  suggested={getSuggestion(item)}
                  isSaving={savingRemainingIds.has(item.orderItemId)}
                  unitSelectorProps={getUnitSelectorPropsByInventoryItemId(
                    item.inventoryItemId,
                    item.unitType,
                    item.unitLabel,
                  )}
                  exportUnitType={settings.exportUnitType}
                  contributorBreakdown={
                    remainingContributorBreakdownByOrderItemId[item.orderItemId] ?? []
                  }
                  onUnitChange={(unit) =>
                    updateExportSettings(item.orderItemId, { exportUnitType: unit })
                  }
                  onQuantityChange={handleRemainingQuantityChange}
                  onOverflowPress={handleRemainingItemOverflow}
                  last={last}
                />
              </View>
            );
          }

          const item = entry.item;
          const settings = getExportSettings(item.id, item.unitType);
          const unitSelectorProps = getUnitSelectorPropsByInventoryItemId(
            item.inventoryItemId,
            item.unitType,
            item.unitLabel,
          );
          const breakdown = item.contributors.length > 0
            ? item.contributors
                .map(
                  (contributor) =>
                    `${contributor.name} ${formatQuantity(contributor.quantity)}`,
                )
                .join(' · ')
            : item.details
                .map(
                  (detail) =>
                    `${detail.orderedBy} ${formatQuantity(detail.quantity)}`,
                )
                .join(' · ');

          return (
            <View
              style={{
                overflow: 'hidden',
                backgroundColor: color.card,
                borderTopLeftRadius: index === 0 ? radius.card : 0,
                borderTopRightRadius: index === 0 ? radius.card : 0,
                borderBottomLeftRadius: last ? radius.card : 0,
                borderBottomRightRadius: last ? radius.card : 0,
                paddingTop: index === 0 ? ds.spacing(2) : 0,
                paddingBottom: last ? ds.spacing(2) : 0,
              }}
            >
              <FulfillmentConfirmItemRow
                title={item.name}
                orderedByContent={
                  breakdown ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: ds.fontSize(typeScale.meta),
                        color: color.ink3,
                      }}
                    >
                      {breakdown}
                    </Text>
                  ) : undefined
                }
                headerActions={
                  <TouchableOpacity
                    onPress={() => handleRegularItemOverflow(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`More actions for ${item.name}`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: ds.spacing(space[1]) }}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={ds.icon(18)}
                      color={color.ink3}
                    />
                  </TouchableOpacity>
                }
                quantityValue={formatQuantity(item.quantity)}
                onQuantityChangeText={(text) => {
                  const sanitized = text.replace(/[^0-9.]/g, '');
                  if (!sanitized) return;
                  const parsed = Number(sanitized);
                  if (!Number.isFinite(parsed) || parsed < 0) return;
                  handleQuantityChange(item, parsed);
                }}
                onDecrement={() => handleQuantityChange(item, item.quantity - 1)}
                onIncrement={() => handleQuantityChange(item, item.quantity + 1)}
                unitSelector={
                  <QuantityExportSelector
                    exportUnitType={settings.exportUnitType}
                    baseUnitLabel={unitSelectorProps.baseUnitLabel}
                    packUnitLabel={unitSelectorProps.packUnitLabel}
                    canSwitchUnit={unitSelectorProps.canSwitchUnit}
                    onUnitChange={(unit) =>
                      updateExportSettings(item.id, { exportUnitType: unit })
                    }
                  />
                }
                last={last}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <Card>
            <Text
              style={{
                textAlign: 'center',
                fontSize: ds.fontSize(typeScale.secondary),
                color: color.ink2,
              }}
            >
              No items to order.
            </Text>
          </Card>
        }
        ListFooterComponent={
          <View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <SectionLabel style={{ flex: 1 }}>Message preview</SectionLabel>
              <TouchableOpacity
                onPress={() => router.push('/(manager)/manager-settings/export-format')}
                accessibilityRole="button"
                accessibilityLabel="Edit message format"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingHorizontal: ds.spacing(space[1]) }}
              >
                <Text
                  style={{
                    fontSize: ds.fontSize(typeScale.caption),
                    fontWeight: weight.semibold,
                    color: color.accent,
                  }}
                >
                  Format
                </Text>
              </TouchableOpacity>
            </View>
            <Card flush>
              <Text
                selectable
                style={{
                  padding: ds.spacing(14),
                  fontSize: ds.fontSize(typeScale.itemDense),
                  lineHeight: ds.fontSize(typeScale.itemDense) * 1.45,
                  color: color.ink,
                }}
              >
                {messageText}
              </Text>
            </Card>

            <View
              style={{
                flexDirection: 'row',
                gap: ds.spacing(10),
                marginTop: ds.spacing(14),
              }}
            >
              <Button
                variant="secondary"
                icon="copy-outline"
                label="Copy"
                onPress={handleCopyToClipboard}
                disabled={actionsDisabled}
                style={{ flex: 1 }}
              />
              <Button
                icon="share-social-outline"
                label="Share"
                onPress={handleShareOrder}
                disabled={actionsDisabled}
                loading={isFinalizing}
                style={{ flex: 1.4 }}
              />
            </View>
          </View>
        }
      />

      <ItemActionSheet
        visible={Boolean(overflowRegularItem || overflowRemainingItem)}
        title="Item actions"
        subtitle={overflowRegularItem?.name || overflowRemainingItem?.name}
        sections={overflowActionSections}
        onClose={() => setOverflowTarget(null)}
      />

      <Sheet
        visible={Boolean(noteRegularItem || noteRemainingItem)}
        title={noteRegularItem?.notes.length || noteRemainingItem?.note ? 'Edit note' : 'Add note'}
        subtitle={noteRegularItem?.name || noteRemainingItem?.name}
        onClose={closeNoteEditor}
        primary={{ label: 'Save note', onPress: handleSaveNote, loading: isSavingNote }}
      >
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="Add supplier note…"
          placeholderTextColor={color.ink3}
          multiline
          maxLength={240}
          textAlignVertical="top"
          accessibilityLabel="Supplier note"
          style={{
            minHeight: ds.spacing(112),
            borderRadius: radius.control,
            backgroundColor: color.well,
            paddingHorizontal: ds.spacing(space[3]),
            paddingVertical: ds.spacing(space[3]),
            fontSize: ds.fontSize(typeScale.body),
            color: color.ink,
          }}
        />
        <Text
          style={{
            marginTop: ds.spacing(space[2]),
            textAlign: 'right',
            fontSize: ds.fontSize(typeScale.meta),
            color: color.ink3,
          }}
        >
          {noteDraft.length}/240
        </Text>
      </Sheet>

      <SupplierPickerBottomSheet
        visible={Boolean(supplierPickerTarget)}
        itemName={
          supplierPickerTarget?.kind === 'regular'
            ? supplierPickerTarget.item.name
            : supplierPickerTarget?.kind === 'remaining'
              ? supplierPickerTarget.item.name
              : undefined
        }
        suppliers={supplierPickerOptions}
        currentSupplierId={supplierId}
        isMoving={isMovingSupplier}
        onSelect={(targetSupplierId) => {
          void handleSupplierPickerSelect(targetSupplierId);
        }}
        onClose={() => {
          if (!isMovingSupplier) setSupplierPickerTarget(null);
        }}
      />

      <OrderLaterScheduleModal
        visible={Boolean(orderLaterRegularItem || orderLaterRemainingItem)}
        title="Order later"
        subtitle="Choose when this item should be ordered."
        confirmLabel="Move item"
        onClose={() => setOrderLaterTarget(null)}
        onConfirm={handleMoveTargetToOrderLater}
      />
    </SafeAreaView>
  );
}
