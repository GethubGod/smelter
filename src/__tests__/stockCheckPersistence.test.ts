/**
 * Regression cover for issue #69: a saved stock count only ever lived in
 * AsyncStorage, so it never reached `stock_updates` / `area_items` /
 * `stock_check_sessions` and there was no queue to flush after a reconnect.
 */
const mockAsyncStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
};

const getStorageAreasMock = jest.fn();
const getAreaItemsMock = jest.fn();
const startOrResumeStockCheckMock = jest.fn();
const recordStockCheckCountMock = jest.fn();
const completeStockCheckMock = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('../lib/api/stock', () => ({
  getStorageAreas: getStorageAreasMock,
  getAreaItems: getAreaItemsMock,
}));
jest.mock('../services/stockCheckV2', () => ({
  startOrResumeStockCheck: startOrResumeStockCheckMock,
  recordStockCheckCount: recordStockCheckCountMock,
  completeStockCheck: completeStockCheckMock,
}));

import {
  __resetStockCheckSessionCache,
  useStockCheckStore,
} from '../features/stock-check/useStockCheckStore';

const LOCATION_ID = '47000000-0000-4000-8000-000000000001';
const AREA_ID = '46000000-0000-4000-8000-000000000001';
const SALMON_ID = '48000000-0000-4000-8000-000000000001';
const RICE_ID = '48000000-0000-4000-8000-000000000002';
const SESSION_ID = '49000000-0000-4000-8000-000000000001';

function areaItemRow(id: string, name: string) {
  return {
    id,
    area_id: AREA_ID,
    par_level: 8,
    max_quantity: 8,
    unit_type: 'pack',
    inventory_item: {
      id: `inv-${id}`,
      name,
      category: 'seafood',
      pack_unit: 'case',
      base_unit: 'lb',
      pack_size: 10,
    },
  };
}

/** Lets every already-scheduled microtask settle, including the store's
 *  fire-and-forget drains. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
}

async function loadFixtureLocation(): Promise<void> {
  getStorageAreasMock.mockResolvedValue([
    { id: AREA_ID, name: 'Fixture Freezer', sort_order: 0, location_id: LOCATION_ID },
  ]);
  getAreaItemsMock.mockResolvedValue([
    areaItemRow(SALMON_ID, 'Fixture Salmon'),
    areaItemRow(RICE_ID, 'Fixture Rice'),
  ]);
  await useStockCheckStore.getState().loadLocation(LOCATION_ID);
  await flushMicrotasks();
}

describe('stock-check count persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetStockCheckSessionCache();
    useStockCheckStore.setState(
      {
        locationId: null,
        areas: [],
        itemsById: {},
        selectedAreaId: null,
        expandingItemId: null,
        perLocationState: {},
        isLoading: false,
        loadError: null,
        pendingOps: [],
        isSyncing: false,
        lastSyncAt: null,
        syncError: null,
      },
      false,
    );
    startOrResumeStockCheckMock.mockResolvedValue({ id: SESSION_ID, locationId: LOCATION_ID });
    recordStockCheckCountMock.mockResolvedValue({ areaItemId: SALMON_ID });
    completeStockCheckMock.mockResolvedValue({ id: SESSION_ID, status: 'completed' });
  });

  test('opening a location opens or resumes the server-side session', async () => {
    await loadFixtureLocation();

    expect(startOrResumeStockCheckMock).toHaveBeenCalledWith(LOCATION_ID);
  });

  test('a saved count writes through record_stock_check_count and leaves nothing queued', async () => {
    await loadFixtureLocation();

    useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
      stockUnit: 'pack',
      stockAmount: 6,
      stockPieces: 0,
    });

    // Local-first: the row is already updated before any network call settles.
    expect(useStockCheckStore.getState().itemsById[SALMON_ID].stockAmount).toBe(6);
    expect(useStockCheckStore.getState().itemsById[SALMON_ID].checked).toBe(true);

    await flushMicrotasks();

    expect(recordStockCheckCountMock).toHaveBeenCalledWith(SESSION_ID, SALMON_ID, {
      entryMode: 'numeric',
      quantity: 6,
    });
    expect(useStockCheckStore.getState().pendingOps).toHaveLength(0);
    expect(useStockCheckStore.getState().syncError).toBeNull();
  });

  test('a count entered in base units is converted into the area item unit', async () => {
    await loadFixtureLocation();

    // pack_size 10: 25 lb of a case-configured item is 2.5 cases.
    useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
      stockUnit: 'base',
      stockAmount: 25,
      stockPieces: 0,
    });
    await flushMicrotasks();

    expect(recordStockCheckCountMock).toHaveBeenCalledWith(SESSION_ID, SALMON_ID, {
      entryMode: 'numeric',
      quantity: 2.5,
    });
  });

  test('counting the last item completes the pass exactly once', async () => {
    await loadFixtureLocation();

    const commit = (itemId: string) =>
      useStockCheckStore.getState().commitStockEntry(itemId, {
        stockUnit: 'pack',
        stockAmount: 6,
        stockPieces: 0,
      });

    commit(SALMON_ID);
    await flushMicrotasks();
    expect(completeStockCheckMock).not.toHaveBeenCalled();

    commit(RICE_ID);
    await flushMicrotasks();
    expect(completeStockCheckMock).toHaveBeenCalledTimes(1);
    expect(completeStockCheckMock).toHaveBeenCalledWith(SESSION_ID);

    // Re-counting an already-counted row must not complete the pass again.
    commit(SALMON_ID);
    await flushMicrotasks();
    expect(completeStockCheckMock).toHaveBeenCalledTimes(1);
  });
});

describe('stock-check offline queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetStockCheckSessionCache();
    useStockCheckStore.setState(
      {
        locationId: null,
        areas: [],
        itemsById: {},
        selectedAreaId: null,
        expandingItemId: null,
        perLocationState: {},
        isLoading: false,
        loadError: null,
        pendingOps: [],
        isSyncing: false,
        lastSyncAt: null,
        syncError: null,
      },
      false,
    );
    startOrResumeStockCheckMock.mockResolvedValue({ id: SESSION_ID, locationId: LOCATION_ID });
    recordStockCheckCountMock.mockResolvedValue({ areaItemId: SALMON_ID });
    completeStockCheckMock.mockResolvedValue({ id: SESSION_ID, status: 'completed' });
  });

  test('a count taken while the API is unreachable stays queued with an honest error', async () => {
    await loadFixtureLocation();
    recordStockCheckCountMock.mockRejectedValue(new Error('Network request failed'));

    useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
      stockUnit: 'pack',
      stockAmount: 6,
      stockPieces: 0,
    });
    await flushMicrotasks();

    const state = useStockCheckStore.getState();
    // The count is still on screen, and the owed write is still owed.
    expect(state.itemsById[SALMON_ID].stockAmount).toBe(6);
    expect(state.pendingOps).toHaveLength(1);
    expect(state.pendingOps[0]).toMatchObject({
      kind: 'count',
      locationId: LOCATION_ID,
      areaItemId: SALMON_ID,
      quantity: 6,
    });
    expect(state.syncError).toBe('Network request failed');
  });

  test('the queue drains on reconnect and clears the error', async () => {
    await loadFixtureLocation();
    recordStockCheckCountMock.mockRejectedValue(new Error('Network request failed'));

    useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
      stockUnit: 'pack',
      stockAmount: 6,
      stockPieces: 0,
    });
    await flushMicrotasks();
    expect(useStockCheckStore.getState().pendingOps).toHaveLength(1);

    recordStockCheckCountMock.mockResolvedValue({ areaItemId: SALMON_ID });
    await useStockCheckStore.getState().syncPendingOps();
    await flushMicrotasks();

    expect(recordStockCheckCountMock).toHaveBeenLastCalledWith(SESSION_ID, SALMON_ID, {
      entryMode: 'numeric',
      quantity: 6,
    });
    const state = useStockCheckStore.getState();
    expect(state.pendingOps).toHaveLength(0);
    expect(state.syncError).toBeNull();
    expect(state.lastSyncAt).not.toBeNull();
  });

  test('a queue persisted across a relaunch drains without re-entering the count', async () => {
    // No loadLocation: this is the cold-launch path, where the only thing in
    // memory is what AsyncStorage rehydrated.
    useStockCheckStore.setState({
      pendingOps: [
        {
          id: 'op-1',
          kind: 'count',
          locationId: LOCATION_ID,
          areaItemId: SALMON_ID,
          quantity: 6,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await useStockCheckStore.getState().syncPendingOps();

    expect(startOrResumeStockCheckMock).toHaveBeenCalledWith(LOCATION_ID);
    expect(recordStockCheckCountMock).toHaveBeenCalledWith(SESSION_ID, SALMON_ID, {
      entryMode: 'numeric',
      quantity: 6,
    });
    expect(useStockCheckStore.getState().pendingOps).toHaveLength(0);
  });

  test('re-counting the same item while offline queues one write, not two', async () => {
    await loadFixtureLocation();
    recordStockCheckCountMock.mockRejectedValue(new Error('Network request failed'));

    const commit = (amount: number) =>
      useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
        stockUnit: 'pack',
        stockAmount: amount,
        stockPieces: 0,
      });

    commit(6);
    await flushMicrotasks();
    commit(9);
    await flushMicrotasks();

    const pendingOps = useStockCheckStore.getState().pendingOps;
    expect(pendingOps).toHaveLength(1);
    expect(pendingOps[0]).toMatchObject({ quantity: 9 });

    recordStockCheckCountMock.mockResolvedValue({ areaItemId: SALMON_ID });
    await useStockCheckStore.getState().syncPendingOps();

    expect(recordStockCheckCountMock).toHaveBeenLastCalledWith(SESSION_ID, SALMON_ID, {
      entryMode: 'numeric',
      quantity: 9,
    });
    expect(useStockCheckStore.getState().pendingOps).toHaveLength(0);
  });

  test('a failed write re-resolves the session on the next attempt', async () => {
    await loadFixtureLocation();
    expect(startOrResumeStockCheckMock).toHaveBeenCalledTimes(1);

    recordStockCheckCountMock.mockRejectedValueOnce(
      new Error('Only an in-progress stock check can accept counts'),
    );
    useStockCheckStore.getState().commitStockEntry(SALMON_ID, {
      stockUnit: 'pack',
      stockAmount: 6,
      stockPieces: 0,
    });
    await flushMicrotasks();
    expect(useStockCheckStore.getState().pendingOps).toHaveLength(1);

    const NEXT_SESSION_ID = '49000000-0000-4000-8000-000000000002';
    startOrResumeStockCheckMock.mockResolvedValue({ id: NEXT_SESSION_ID, locationId: LOCATION_ID });
    await useStockCheckStore.getState().syncPendingOps();

    expect(recordStockCheckCountMock).toHaveBeenLastCalledWith(NEXT_SESSION_ID, SALMON_ID, {
      entryMode: 'numeric',
      quantity: 6,
    });
    expect(useStockCheckStore.getState().pendingOps).toHaveLength(0);
  });

  test('writes older than the offline retention window are dropped', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    useStockCheckStore.setState({
      pendingOps: [
        {
          id: 'op-stale',
          kind: 'count',
          locationId: LOCATION_ID,
          areaItemId: SALMON_ID,
          quantity: 6,
          createdAt: eightDaysAgo,
        },
      ],
    });

    await useStockCheckStore.getState().syncPendingOps();

    expect(recordStockCheckCountMock).not.toHaveBeenCalled();
    expect(useStockCheckStore.getState().pendingOps).toHaveLength(0);
  });
});
