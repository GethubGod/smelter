/**
 * Regression cover for issue #74: the offline stock queue drained straight
 * out of zustand's `onRehydrateStorage`, which fires before the Supabase
 * session is restored. The launch attempt therefore ran with a null
 * `auth.uid()`, `start_or_resume_stock_check` raised "You must be signed in
 * to start a stock check", and the count sat in the queue until a stock
 * screen next opened.
 *
 * The drain now waits on the auth store reporting a restored session.
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

// eslint-disable-next-line import/first -- must load after the jest.mock() calls above so their mock vars are initialized first
import {
  __resetStockCheckSessionCache,
  useStockCheckStore,
} from '../features/stock-check/useStockCheckStore';
// eslint-disable-next-line import/first -- same ordering constraint as above
import {
  __resetStockQueueDrainGate,
  notifyAuthSessionCleared,
  notifyAuthSessionRestored,
  notifyStockQueueRehydrated,
} from '../features/stock-check/queueDrainGate';

const LOCATION_ID = '45000000-0000-4000-8000-000000000001';
const SALMON_ID = '48000000-0000-4000-8000-000000000001';
const SESSION_ID = '4d000000-0000-4000-8000-000000000001';

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
}

/** One count owed to the server, as AsyncStorage would hand it back. */
function seedPersistedQueue(): void {
  useStockCheckStore.setState({
    pendingOps: [
      {
        id: 'op-offline-1',
        kind: 'count',
        locationId: LOCATION_ID,
        areaItemId: SALMON_ID,
        quantity: 60,
        createdAt: new Date().toISOString(),
      },
    ],
  });
}

describe('stock-check queue drain at launch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetStockQueueDrainGate();
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

  test('rehydrate alone does not drain, and does not set an auth syncError', async () => {
    seedPersistedQueue();

    notifyStockQueueRehydrated();
    await flushMicrotasks();

    expect(startOrResumeStockCheckMock).not.toHaveBeenCalled();
    expect(recordStockCheckCountMock).not.toHaveBeenCalled();
    const state = useStockCheckStore.getState();
    expect(state.pendingOps).toHaveLength(1);
    // The old code failed here with "You must be signed in to start a stock
    // check" and left that on screen a second after launch.
    expect(state.syncError).toBeNull();
  });

  test('the queue drains once the auth store reports a restored session', async () => {
    seedPersistedQueue();

    notifyStockQueueRehydrated();
    await flushMicrotasks();
    expect(recordStockCheckCountMock).not.toHaveBeenCalled();

    notifyAuthSessionRestored();
    await flushMicrotasks();

    expect(startOrResumeStockCheckMock).toHaveBeenCalledWith(LOCATION_ID);
    expect(recordStockCheckCountMock).toHaveBeenCalledTimes(1);
    expect(recordStockCheckCountMock).toHaveBeenCalledWith(SESSION_ID, SALMON_ID, {
      entryMode: 'numeric',
      quantity: 60,
    });
    const state = useStockCheckStore.getState();
    expect(state.pendingOps).toHaveLength(0);
    expect(state.syncError).toBeNull();
  });

  test('a second auth notification does not drain twice', async () => {
    seedPersistedQueue();

    notifyStockQueueRehydrated();
    notifyAuthSessionRestored();
    await flushMicrotasks();
    expect(recordStockCheckCountMock).toHaveBeenCalledTimes(1);

    // A token refresh re-hydrates the auth session. Nothing new is owed, and
    // the launch drain must not run a second time.
    seedPersistedQueue();
    notifyAuthSessionRestored();
    await flushMicrotasks();

    expect(recordStockCheckCountMock).toHaveBeenCalledTimes(1);
    expect(useStockCheckStore.getState().pendingOps).toHaveLength(1);
  });

  test('auth arriving before rehydrate still drains, exactly once', async () => {
    seedPersistedQueue();

    // Order is not guaranteed: on a warm start the session can be restored
    // before AsyncStorage hands the queue back.
    notifyAuthSessionRestored();
    await flushMicrotasks();
    expect(recordStockCheckCountMock).not.toHaveBeenCalled();

    notifyStockQueueRehydrated();
    await flushMicrotasks();
    expect(recordStockCheckCountMock).toHaveBeenCalledTimes(1);

    notifyStockQueueRehydrated();
    await flushMicrotasks();
    expect(recordStockCheckCountMock).toHaveBeenCalledTimes(1);
  });

  test('signing out re-arms the gate for the next session', async () => {
    seedPersistedQueue();

    notifyStockQueueRehydrated();
    notifyAuthSessionRestored();
    await flushMicrotasks();
    expect(recordStockCheckCountMock).toHaveBeenCalledTimes(1);

    notifyAuthSessionCleared();
    seedPersistedQueue();
    notifyAuthSessionRestored();
    await flushMicrotasks();

    expect(recordStockCheckCountMock).toHaveBeenCalledTimes(2);
    expect(useStockCheckStore.getState().pendingOps).toHaveLength(0);
  });

  test('a failed launch drain leaves the count queued with the real error', async () => {
    seedPersistedQueue();
    recordStockCheckCountMock.mockRejectedValue(new Error('Network request failed'));

    notifyStockQueueRehydrated();
    notifyAuthSessionRestored();
    await flushMicrotasks();

    const state = useStockCheckStore.getState();
    expect(state.pendingOps).toHaveLength(1);
    expect(state.syncError).toBe('Network request failed');
  });
});
