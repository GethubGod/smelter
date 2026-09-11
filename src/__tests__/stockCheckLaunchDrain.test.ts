/**
 * Regression cover for the second half of issue #74: the queue drained only
 * when a stock screen opened.
 *
 * The gate was correct, but nothing registered a drain on a launch that did
 * not go to a stock route. `useStockCheckStore` is imported only by the three
 * stock screens, expo-router loads a route's module on first navigation, so
 * on a checklist launch the store had never been evaluated and the restored
 * session arrived at an empty gate. The Release verifier saw a count queued
 * offline before a force quit sit at `pendingOps 1` with `syncError null` for
 * 60 seconds after relaunch, and land only once Stock check was opened.
 *
 * This file replays that process: the module registry is reset, only the gate
 * is loaded, and the session is then restored with no stock screen anywhere.
 * `jest.resetModules` is what makes it a cold launch — importing the store at
 * the top of the file, as the sibling suites do, is precisely the condition
 * that was missing on device.
 */
const STORAGE_KEY = 'stock-check-store-v1';
const LOCATION_ID = '45000000-0000-4000-8000-000000000001';
const SALMON_ID = '48000000-0000-4000-8000-000000000001';
const SESSION_ID = '4d000000-0000-4000-8000-000000000001';
const USER_A = '4a000000-0000-4000-8000-00000000000a';

/** What AsyncStorage hands back after a force quit with one count owed. */
function persistedQueue(ownerUserId: string | null): string {
  return JSON.stringify({
    state: {
      perLocationState: {},
      pendingOps: [
        {
          id: 'op-offline-1',
          kind: 'count',
          locationId: LOCATION_ID,
          ownerUserId,
          areaItemId: SALMON_ID,
          quantity: 60,
          createdAt: new Date().toISOString(),
        },
      ],
      lastSyncAt: null,
    },
    version: 2,
  });
}

let storedQueue: string | null = null;

const mockAsyncStorage = {
  getItem: jest.fn(async (key: string) => (key === STORAGE_KEY ? storedQueue : null)),
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

/**
 * The launch path is a chain of promises: the dynamic import, zustand's
 * rehydrate read, then the drain's RPCs. Turning the microtask queue over
 * enough times covers all of it without fake timers.
 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    await Promise.resolve();
  }
}

type QueueDrainGate = typeof import('../features/stock-check/queueDrainGate');
type StockCheckStoreModule = typeof import('../features/stock-check/useStockCheckStore');

describe('stock-check queue drain on a launch with no stock screen', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    storedQueue = null;
    startOrResumeStockCheckMock.mockResolvedValue({ id: SESSION_ID, locationId: LOCATION_ID });
    recordStockCheckCountMock.mockResolvedValue({ areaItemId: SALMON_ID });
    completeStockCheckMock.mockResolvedValue({ id: SESSION_ID, status: 'completed' });
  });

  test('a count queued before a force quit is sent once the session is restored', async () => {
    storedQueue = persistedQueue(USER_A);

    const gate: QueueDrainGate = await import('../features/stock-check/queueDrainGate');

    // Cold launch: the store module has not been evaluated, so nothing has
    // read the persisted queue. This is the state the verifier's device was
    // in on the checklist screen.
    expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();

    gate.notifyAuthSessionRestored(USER_A);
    await flushMicrotasks();

    // The gate pulled the store in itself; no stock screen ever mounted.
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(startOrResumeStockCheckMock).toHaveBeenCalledWith(LOCATION_ID);
    expect(recordStockCheckCountMock).toHaveBeenCalledWith(SESSION_ID, SALMON_ID, {
      entryMode: 'numeric',
      quantity: 60,
    });

    const { useStockCheckStore }: StockCheckStoreModule = await import(
      '../features/stock-check/useStockCheckStore'
    );
    const state = useStockCheckStore.getState();
    expect(state.pendingOps).toHaveLength(0);
    expect(state.syncError).toBeNull();
  });

  test('an empty queue makes no RPC at launch', async () => {
    storedQueue = null;

    const gate: QueueDrainGate = await import('../features/stock-check/queueDrainGate');
    gate.notifyAuthSessionRestored(USER_A);
    await flushMicrotasks();

    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(startOrResumeStockCheckMock).not.toHaveBeenCalled();
    expect(recordStockCheckCountMock).not.toHaveBeenCalled();
  });

  test('no session means no store load and no drain', async () => {
    storedQueue = persistedQueue(USER_A);

    const gate: QueueDrainGate = await import('../features/stock-check/queueDrainGate');
    // A suspended session is exactly this case: the auth store restores it but
    // never reports it, so the queue must stay where it is (issue #62).
    gate.notifyStockQueueRehydrated();
    await flushMicrotasks();

    expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
    expect(startOrResumeStockCheckMock).not.toHaveBeenCalled();
    expect(recordStockCheckCountMock).not.toHaveBeenCalled();
  });
});
