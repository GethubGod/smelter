import type { StateStorage } from 'zustand/middleware';

import { createEqualityGatedJSONStorage } from '../lib/equalityGatedJSONStorage';

interface PersistedState {
  items: { id: string }[];
  isLoading: boolean;
  error: string | null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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

    expect(rawStorage.setItem).toHaveBeenCalledTimes(3);
    pendingWrite.resolve();
    await Promise.all([writeB, writeA]);
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
