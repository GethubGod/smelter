import type { StateStorage } from 'zustand/middleware';

import { createEqualityGatedJSONStorage } from '../lib/equalityGatedJSONStorage';

interface PersistedState {
  items: { id: string }[];
  isLoading: boolean;
  error: string | null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function lastWrittenItems(
  setItemMock: jest.Mock<Promise<void>, [string, string]>,
): PersistedState['items'] {
  const lastCall = setItemMock.mock.calls[setItemMock.mock.calls.length - 1];
  if (!lastCall) throw new Error('Expected at least one native write.');
  const parsed: unknown = JSON.parse(lastCall[1]);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('state' in parsed) ||
    typeof parsed.state !== 'object' ||
    parsed.state === null ||
    !('items' in parsed.state)
  ) {
    throw new Error('Unexpected persisted payload shape.');
  }
  return parsed.state.items as PersistedState['items'];
}

function setupStorage(initialValue: string | null = null) {
  const setItemMock = jest.fn(
    async (_name: string, _value: string): Promise<void> => undefined,
  );
  const rawStorage: StateStorage = {
    getItem: jest.fn(async () => initialValue),
    setItem: setItemMock,
    removeItem: jest.fn(async () => undefined),
  };
  const storage = createEqualityGatedJSONStorage<PersistedState, PersistedState['items']>(
    () => rawStorage,
    (state) => state.items,
  );
  if (!storage) throw new Error('Expected test storage to be available.');
  return { rawStorage, setItemMock, storage };
}

describe('createEqualityGatedJSONStorage', () => {
  test('skips serialization and native writes when only non-persisted state changes', async () => {
    const { rawStorage, storage } = setupStorage();
    const items = [{ id: 'item-1' }];
    const stringifySpy = jest.spyOn(JSON, 'stringify');

    await storage.setItem('inventory', {
      state: { items, isLoading: false, error: null },
    });
    await storage.setItem('inventory', {
      state: { items, isLoading: true, error: null },
    });
    await storage.setItem('inventory', {
      state: { items, isLoading: false, error: 'network down' },
    });

    expect(stringifySpy).toHaveBeenCalledTimes(1);
    expect(rawStorage.setItem).toHaveBeenCalledTimes(1);

    const changedItems = [...items, { id: 'item-2' }];
    await storage.setItem('inventory', {
      state: { items: changedItems, isLoading: false, error: null },
    });

    expect(stringifySpy).toHaveBeenCalledTimes(2);
    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
    stringifySpy.mockRestore();
  });

  test('retries the same state after a failed native write', async () => {
    const { rawStorage, setItemMock, storage } = setupStorage();
    setItemMock
      .mockRejectedValueOnce(new Error('disk unavailable'))
      .mockResolvedValueOnce(undefined);
    const value = {
      state: {
        items: [{ id: 'item-1' }],
        isLoading: false,
        error: null,
      },
    };

    await expect(storage.setItem('inventory', value)).rejects.toThrow(
      'disk unavailable',
    );
    await expect(storage.setItem('inventory', value)).resolves.toBeUndefined();

    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
  });

  test('writes the current value behind a conflicting pending write', async () => {
    const { rawStorage, setItemMock, storage } = setupStorage();
    const itemsA = [{ id: 'item-a' }];
    const itemsB = [{ id: 'item-b' }];
    await storage.setItem('inventory', {
      state: { items: itemsA, isLoading: false, error: null },
    });
    const pendingWrite = deferred<void>();
    setItemMock.mockReturnValueOnce(pendingWrite.promise);

    const writeB = storage.setItem('inventory', {
      state: { items: itemsB, isLoading: false, error: null },
    });
    const writeA = storage.setItem('inventory', {
      state: { items: itemsA, isLoading: true, error: null },
    });

    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
    pendingWrite.resolve();
    await Promise.all([writeB, writeA]);
    expect(rawStorage.setItem).toHaveBeenCalledTimes(3);
    expect(lastWrittenItems(setItemMock)).toEqual(itemsA);
  });

  test('the newest value is on disk when the older write settles last', async () => {
    // Regression for PR #75 P1: without serialized writes, an older write that
    // completed after a newer one left stale inventory as the final value.
    const { rawStorage, setItemMock, storage } = setupStorage();
    const itemsOld = [{ id: 'item-old' }];
    const itemsNew = [{ id: 'item-new' }];
    const oldWrite = deferred<void>();
    setItemMock.mockReturnValueOnce(oldWrite.promise);

    const writeOld = storage.setItem('inventory', {
      state: { items: itemsOld, isLoading: false, error: null },
    });
    const writeNew = storage.setItem('inventory', {
      state: { items: itemsNew, isLoading: false, error: null },
    });

    // The newer write waits for the older one instead of racing it.
    expect(rawStorage.setItem).toHaveBeenCalledTimes(1);
    oldWrite.resolve();
    await Promise.all([writeOld, writeNew]);

    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
    expect(lastWrittenItems(setItemMock)).toEqual(itemsNew);

    // Nothing further is written for the value already on disk.
    await storage.setItem('inventory', {
      state: { items: itemsNew, isLoading: true, error: null },
    });
    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
  });

  test('coalesces values requested behind an in-flight write into one write', async () => {
    const { rawStorage, setItemMock, storage } = setupStorage();
    const first = deferred<void>();
    setItemMock.mockReturnValueOnce(first.promise);
    const itemsC = [{ id: 'item-c' }];

    const writeA = storage.setItem('inventory', {
      state: { items: [{ id: 'item-a' }], isLoading: false, error: null },
    });
    const writeB = storage.setItem('inventory', {
      state: { items: [{ id: 'item-b' }], isLoading: false, error: null },
    });
    const writeC = storage.setItem('inventory', {
      state: { items: itemsC, isLoading: false, error: null },
    });

    first.resolve();
    await Promise.all([writeA, writeB, writeC]);

    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
    expect(lastWrittenItems(setItemMock)).toEqual(itemsC);
  });

  test('a queued write still runs after the in-flight write fails', async () => {
    const { rawStorage, setItemMock, storage } = setupStorage();
    const failing = deferred<void>();
    setItemMock.mockReturnValueOnce(failing.promise);
    const itemsNew = [{ id: 'item-new' }];

    const writeOld = storage.setItem('inventory', {
      state: { items: [{ id: 'item-old' }], isLoading: false, error: null },
    });
    const writeNew = storage.setItem('inventory', {
      state: { items: itemsNew, isLoading: false, error: null },
    });

    failing.reject(new Error('disk unavailable'));
    await expect(writeOld).rejects.toThrow('disk unavailable');
    await expect(writeNew).resolves.toBeUndefined();

    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
    expect(lastWrittenItems(setItemMock)).toEqual(itemsNew);
  });

  test('persists a version change even when the selected state is unchanged', async () => {
    const { rawStorage, storage } = setupStorage();
    const items = [{ id: 'item-1' }];

    await storage.setItem('inventory', { state: { items, isLoading: false, error: null } });
    await storage.setItem('inventory', {
      state: { items, isLoading: false, error: null },
      version: 1,
    });

    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
  });

  test('can retry after a synchronous storage failure', async () => {
    const { rawStorage, setItemMock, storage } = setupStorage();
    const value = {
      state: {
        items: [{ id: 'item-1' }],
        isLoading: false,
        error: null,
      },
    };
    setItemMock.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });

    expect(() => storage.setItem('inventory', value)).toThrow(
      'storage unavailable',
    );
    await expect(storage.setItem('inventory', value)).resolves.toBeUndefined();

    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
  });

  test('removeItem clears the equality state so the same data is durable again', async () => {
    const { rawStorage, storage } = setupStorage();
    const value = {
      state: {
        items: [{ id: 'item-1' }],
        isLoading: false,
        error: null,
      },
    };

    await storage.setItem('inventory', value);
    await storage.setItem('inventory', value);
    await storage.removeItem('inventory');
    await storage.setItem('inventory', value);

    expect(rawStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(rawStorage.setItem).toHaveBeenCalledTimes(2);
  });

  test('hydration does not suppress a later update with a new items reference', async () => {
    const hydratedItems = [{ id: 'item-1' }];
    const storedValue = JSON.stringify({
      state: { items: hydratedItems, isLoading: false, error: null },
    });
    const { rawStorage, storage } = setupStorage(storedValue);

    await expect(storage.getItem('inventory')).resolves.toEqual({
      state: { items: hydratedItems, isLoading: false, error: null },
    });

    await storage.setItem('inventory', {
      state: {
        items: [{ id: 'item-1' }, { id: 'item-2' }],
        isLoading: false,
        error: null,
      },
    });

    expect(rawStorage.setItem).toHaveBeenCalledTimes(1);
  });
});
