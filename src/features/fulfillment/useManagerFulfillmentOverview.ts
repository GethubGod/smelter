import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { useResolvedActiveLocation } from '@/hooks/useResolvedActiveLocation';
import { supabase } from '@/lib/supabase';
import { useAuthStore, useOrderStore } from '@/store';
import type { OrderLaterItem } from '@/store/orderStore.types';
import type { PendingFulfillmentDataResult } from '@/services/fulfillmentDataSource';
import { invalidateSupplierCache } from '@/services/supplierResolver';
import {
  buildManagerFulfillmentModel,
  type ManagerFulfillmentModel,
} from './managerFulfillmentModel';

interface LoadedFulfillmentSource {
  result: PendingFulfillmentDataResult;
  orderLater: OrderLaterItem[];
}

interface ScopeSnapshot {
  source: LoadedFulfillmentSource | null;
  isLoading: boolean;
  error: string | null;
  refreshedAt: number;
}

interface ScopeEntry {
  snapshot: ScopeSnapshot;
  listeners: Set<() => void>;
  inFlight: Promise<void> | null;
  generation: number;
  queued: boolean;
  userId: string;
  locationId: string;
  realtimeChannel: RealtimeChannel | null;
  realtimeTimeout: ReturnType<typeof setTimeout> | null;
}

export interface ManagerFulfillmentOverview extends ManagerFulfillmentModel {
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const CACHE_TTL_MS = 15_000;
const LOAD_TIMEOUT_MS = 15_000;
const REALTIME_DEBOUNCE_MS = 300;
const EMPTY_SNAPSHOT: ScopeSnapshot = {
  source: null,
  isLoading: false,
  error: null,
  refreshedAt: 0,
};
const EMPTY_MODEL = buildManagerFulfillmentModel({
  orders: [],
  supplierDrafts: {},
  orderLater: [],
  supplierLookup: {
    suppliers: [],
    supplierById: new Map(),
    supplierByNameNormalized: new Map(),
  },
  locationId: null,
});

const scopeEntries = new Map<string, ScopeEntry>();
let loadSerial: Promise<void> = Promise.resolve();

class ScopeLoadCancelledError extends Error {}

function getScopeEntry(
  scopeKey: string,
  userId: string,
  locationId: string,
): ScopeEntry {
  const existing = scopeEntries.get(scopeKey);
  if (existing) return existing;
  const entry: ScopeEntry = {
    snapshot: EMPTY_SNAPSHOT,
    listeners: new Set(),
    inFlight: null,
    generation: 0,
    queued: false,
    userId,
    locationId,
    realtimeChannel: null,
    realtimeTimeout: null,
  };
  scopeEntries.set(scopeKey, entry);
  return entry;
}

function publish(entry: ScopeEntry, snapshot: ScopeSnapshot): void {
  entry.snapshot = snapshot;
  entry.listeners.forEach((listener) => listener());
}

function assertActiveScope(scopeKey: string, entry: ScopeEntry): void {
  const activeUserId = useAuthStore.getState().user?.id ?? null;
  if (scopeEntries.get(scopeKey) !== entry || activeUserId !== entry.userId) {
    throw new ScopeLoadCancelledError();
  }
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out. Pull down to try again.`)),
          LOAD_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function messageForError(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Unable to load fulfillment data. Pull down to retry.';
}

async function loadScopeSource(
  scopeKey: string,
  entry: ScopeEntry,
): Promise<LoadedFulfillmentSource> {
  assertActiveScope(scopeKey, entry);
  await useOrderStore
    .getState()
    .loadFulfillmentData(entry.userId, [entry.locationId]);
  assertActiveScope(scopeKey, entry);
  const result = await useOrderStore
    .getState()
    .fetchPendingFulfillmentOrders([entry.locationId]);
  assertActiveScope(scopeKey, entry);
  const orderLater = useOrderStore
    .getState()
    .orderLaterQueue.filter((item) => item.locationId === entry.locationId);
  return { result, orderLater };
}

function refreshScope(
  scopeKey: string,
  userId: string,
  locationId: string,
  queueIfBusy: boolean,
): Promise<void> {
  const entry = scopeEntries.get(scopeKey);
  if (
    !entry ||
    entry.listeners.size === 0 ||
    entry.userId !== userId ||
    entry.locationId !== locationId
  ) {
    return Promise.resolve();
  }
  if (entry.inFlight) {
    if (queueIfBusy) entry.queued = true;
    return entry.inFlight;
  }

  entry.generation += 1;
  const generation = entry.generation;
  publish(entry, { ...entry.snapshot, isLoading: true, error: null });

  const previousLoad = loadSerial;
  const sourcePromise = previousLoad.then(() => loadScopeSource(scopeKey, entry));
  loadSerial = sourcePromise.then(
    () => undefined,
    () => undefined,
  );

  const run = previousLoad.then(() =>
    withTimeout(sourcePromise, 'Fulfillment data'),
  );
  const settled = run
    .then((source) => {
      if (
        entry.generation !== generation ||
        scopeEntries.get(scopeKey) !== entry
      ) {
        return;
      }
      publish(entry, {
        source,
        isLoading: false,
        error: null,
        refreshedAt: Date.now(),
      });
    })
    .catch((error: unknown) => {
      if (
        error instanceof ScopeLoadCancelledError ||
        entry.generation !== generation ||
        scopeEntries.get(scopeKey) !== entry
      ) {
        return;
      }
      publish(entry, {
        ...entry.snapshot,
        isLoading: false,
        error: messageForError(error),
      });
    })
    .finally(() => {
      if (entry.inFlight !== settled) return;
      entry.inFlight = null;
      if (entry.queued && scopeEntries.get(scopeKey) === entry) {
        entry.queued = false;
        void refreshScope(scopeKey, userId, locationId, false);
      }
    });

  entry.inFlight = settled;
  return settled;
}

function ensureFresh(
  scopeKey: string,
  userId: string,
  locationId: string,
): Promise<void> {
  const entry = scopeEntries.get(scopeKey);
  if (!entry) return Promise.resolve();
  if (
    entry.snapshot.source &&
    Date.now() - entry.snapshot.refreshedAt < CACHE_TTL_MS
  ) {
    return Promise.resolve();
  }
  return refreshScope(scopeKey, userId, locationId, false);
}

function scheduleRealtimeRefresh(scopeKey: string, supplierChanged = false): void {
  const entry = scopeEntries.get(scopeKey);
  if (!entry) return;
  if (supplierChanged) invalidateSupplierCache();
  if (entry.realtimeTimeout) clearTimeout(entry.realtimeTimeout);
  entry.realtimeTimeout = setTimeout(() => {
    entry.realtimeTimeout = null;
    void refreshScope(
      scopeKey,
      entry.userId,
      entry.locationId,
      true,
    );
  }, REALTIME_DEBOUNCE_MS);
}

function startRealtime(scopeKey: string, entry: ScopeEntry): void {
  if (entry.realtimeChannel) return;
  entry.realtimeChannel = supabase
    .channel(`manager-fulfillment-overview-${entry.locationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `location_id=eq.${entry.locationId}`,
      },
      () => scheduleRealtimeRefresh(scopeKey),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_items' },
      () => scheduleRealtimeRefresh(scopeKey),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'suppliers' },
      () => scheduleRealtimeRefresh(scopeKey, true),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_later_items' },
      () => scheduleRealtimeRefresh(scopeKey),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'past_orders' },
      () => scheduleRealtimeRefresh(scopeKey),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'past_order_items' },
      () => scheduleRealtimeRefresh(scopeKey),
    )
    .subscribe();
}

function stopRealtime(entry: ScopeEntry): void {
  if (entry.realtimeTimeout) {
    clearTimeout(entry.realtimeTimeout);
    entry.realtimeTimeout = null;
  }
  if (entry.realtimeChannel) {
    void supabase.removeChannel(entry.realtimeChannel);
    entry.realtimeChannel = null;
  }
}

function disposeScope(scopeKey: string, entry: ScopeEntry): void {
  if (scopeEntries.get(scopeKey) !== entry) return;
  entry.generation += 1;
  entry.queued = false;
  stopRealtime(entry);
  scopeEntries.delete(scopeKey);
}

function subscribeScope(
  scopeKey: string,
  userId: string,
  locationId: string,
  listener: () => void,
): () => void {
  const entry = getScopeEntry(scopeKey, userId, locationId);
  entry.listeners.add(listener);
  if (entry.listeners.size === 1) startRealtime(scopeKey, entry);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) disposeScope(scopeKey, entry);
  };
}

useAuthStore.subscribe((state, previousState) => {
  if (state.user?.id === previousState.user?.id) return;
  scopeEntries.forEach((entry, scopeKey) => disposeScope(scopeKey, entry));
});

/** Shared, selected-location fulfillment source for Home, the badge, and Fulfillment. */
export function useManagerFulfillmentOverview(): ManagerFulfillmentOverview {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { location } = useResolvedActiveLocation();
  const locationId = location?.id ?? null;
  const scopeKey = userId && locationId ? `${userId}:${locationId}` : null;
  const { supplierDrafts, fulfillmentDataRevision } = useOrderStore(
    useShallow((state) => ({
      supplierDrafts: state.supplierDrafts,
      fulfillmentDataRevision: state.fulfillmentDataRevision,
    })),
  );

  const subscribe = useCallback(
    (listener: () => void) =>
      scopeKey && userId && locationId
        ? subscribeScope(scopeKey, userId, locationId, listener)
        : () => undefined,
    [locationId, scopeKey, userId],
  );
  const getSnapshot = useCallback(
    () =>
      scopeKey && userId && locationId
        ? getScopeEntry(scopeKey, userId, locationId).snapshot
        : EMPTY_SNAPSHOT,
    [locationId, scopeKey, userId],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refresh = useCallback(
    () =>
      scopeKey && userId && locationId
        ? refreshScope(scopeKey, userId, locationId, true)
        : Promise.resolve(),
    [locationId, scopeKey, userId],
  );

  useEffect(() => {
    if (!scopeKey || !userId || !locationId) return;
    void ensureFresh(scopeKey, userId, locationId);
  }, [locationId, scopeKey, userId]);

  const revisionRef = useRef(fulfillmentDataRevision);
  useEffect(() => {
    if (revisionRef.current === fulfillmentDataRevision) return;
    revisionRef.current = fulfillmentDataRevision;
    if (!scopeKey || !userId || !locationId) return;
    void refreshScope(scopeKey, userId, locationId, false);
  }, [fulfillmentDataRevision, locationId, scopeKey, userId]);

  const model = useMemo(() => {
    if (!snapshot.source || !locationId) return EMPTY_MODEL;
    return buildManagerFulfillmentModel({
      orders: snapshot.source.result.orders,
      supplierDrafts,
      orderLater: snapshot.source.orderLater,
      supplierLookup: snapshot.source.result.supplierLookup,
      locationId,
    });
  }, [locationId, snapshot.source, supplierDrafts]);

  return useMemo(
    () => ({
      ...model,
      isLoading:
        Boolean(scopeKey) &&
        (snapshot.isLoading || (!snapshot.source && !snapshot.error)),
      error: snapshot.error,
      refresh,
    }),
    [model, refresh, scopeKey, snapshot.error, snapshot.isLoading, snapshot.source],
  );
}
