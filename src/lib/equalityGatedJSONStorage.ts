import {
  createJSONStorage,
  type PersistStorage,
  type StateStorage,
  type StorageValue,
} from 'zustand/middleware';

interface PersistIdentity<Key> {
  key: Key;
  version: number | undefined;
}

type Operation<State, Key> =
  | { kind: 'write'; identity: PersistIdentity<Key>; value: StorageValue<State> }
  | { kind: 'remove' };

interface StoredKey<State, Key> {
  /** Bumped whenever the known disk identity changes or an operation starts. */
  revision: number;
  /** Identity of the value known to be on disk, or null when unknown or absent. */
  persisted: PersistIdentity<Key> | null;
  inFlight: {
    operation: Operation<State, Key>;
    promise: Promise<unknown>;
  } | null;
  queued: {
    operation: Operation<State, Key>;
    resolve: (result: unknown) => void;
    reject: (error: unknown) => void;
    promise: Promise<unknown>;
  } | null;
}

const noop = () => undefined;

/**
 * JSON persistence that avoids serialization and native writes while the
 * selected persisted value is unchanged. Operations for one storage name
 * (writes and removes) are serialized: while one is in flight, the newest
 * requested operation waits and runs once the in-flight one settles, so the
 * last value on disk is always the newest one requested. A failed operation
 * makes the disk identity unknown, so the next request always writes.
 */
export function createEqualityGatedJSONStorage<State, Key>(
  getStorage: () => StateStorage,
  selectKey: (state: State) => Key,
  equals: (left: Key, right: Key) => boolean = Object.is,
): PersistStorage<State> | undefined {
  const jsonStorage = createJSONStorage<State>(getStorage);
  if (!jsonStorage) return undefined;

  const keysByStorageName = new Map<string, StoredKey<State, Key>>();
  const identitiesEqual = (
    left: PersistIdentity<Key>,
    right: PersistIdentity<Key>,
  ): boolean => left.version === right.version && equals(left.key, right.key);
  const getStoredKey = (name: string): StoredKey<State, Key> => {
    const existing = keysByStorageName.get(name);
    if (existing) return existing;
    const created: StoredKey<State, Key> = {
      revision: 0,
      persisted: null,
      inFlight: null,
      queued: null,
    };
    keysByStorageName.set(name, created);
    return created;
  };

  const operationIdentity = (
    operation: Operation<State, Key>,
  ): PersistIdentity<Key> | null =>
    operation.kind === 'write' ? operation.identity : null;

  const operationsEqual = (
    left: Operation<State, Key>,
    right: Operation<State, Key>,
  ): boolean => {
    if (left.kind === 'remove' || right.kind === 'remove') {
      return left.kind === right.kind;
    }
    return identitiesEqual(left.identity, right.identity);
  };

  /** True when the operation would leave disk exactly as it is known to be. */
  const alreadyOnDisk = (
    storedKey: StoredKey<State, Key>,
    operation: Operation<State, Key>,
  ): boolean => {
    if (operation.kind === 'remove') return false;
    return (
      storedKey.persisted !== null &&
      identitiesEqual(storedKey.persisted, operation.identity)
    );
  };

  const start = (
    name: string,
    storedKey: StoredKey<State, Key>,
    operation: Operation<State, Key>,
  ): Promise<unknown> => {
    const previousRevision = storedKey.revision;
    storedKey.revision = previousRevision + 1;

    let result: unknown | Promise<unknown>;
    try {
      result =
        operation.kind === 'write'
          ? jsonStorage.setItem(name, operation.value)
          : jsonStorage.removeItem(name);
    } catch (error) {
      storedKey.revision = previousRevision;
      throw error;
    }

    const promise = Promise.resolve(result).then(
      (settled) => {
        storedKey.persisted = operationIdentity(operation);
        storedKey.revision += 1;
        storedKey.inFlight = null;
        drainQueue(name, storedKey);
        return settled;
      },
      (error: unknown) => {
        // The backing store may or may not have changed. Forget what is on
        // disk so the next request for any value writes it.
        storedKey.persisted = null;
        storedKey.revision += 1;
        storedKey.inFlight = null;
        drainQueue(name, storedKey);
        throw error;
      },
    );
    // Callers that await still see the rejection. zustand's persist calls
    // setItem without handling the promise, so mark it handled here to avoid
    // an unhandled rejection for a native storage failure.
    promise.catch(noop);

    storedKey.inFlight = { operation, promise };
    return promise;
  };

  const drainQueue = (name: string, storedKey: StoredKey<State, Key>) => {
    const queued = storedKey.queued;
    if (!queued) return;
    storedKey.queued = null;
    if (alreadyOnDisk(storedKey, queued.operation)) {
      queued.resolve(undefined);
      return;
    }
    try {
      start(name, storedKey, queued.operation).then(queued.resolve, queued.reject);
    } catch (error) {
      queued.reject(error);
    }
  };

  const request = (
    name: string,
    operation: Operation<State, Key>,
  ): Promise<unknown> | void => {
    const storedKey = getStoredKey(name);

    if (storedKey.queued) {
      // Only the newest requested operation runs after the in-flight one
      // settles. Earlier queued operations are superseded.
      storedKey.queued.operation = operation;
      return storedKey.queued.promise;
    }

    if (storedKey.inFlight) {
      if (operationsEqual(storedKey.inFlight.operation, operation)) {
        return storedKey.inFlight.promise;
      }
      let resolve!: (result: unknown) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<unknown>((done, fail) => {
        resolve = done;
        reject = fail;
      });
      promise.catch(noop);
      storedKey.queued = { operation, resolve, reject, promise };
      return promise;
    }

    if (alreadyOnDisk(storedKey, operation)) return;

    return start(name, storedKey, operation);
  };

  return {
    getItem: async (name) => {
      const storedKey = getStoredKey(name);
      const revision = storedKey.revision;
      const value = await jsonStorage.getItem(name);

      // Only trust the read when nothing started or completed meanwhile.
      if (storedKey.revision === revision) {
        if (value) {
          storedKey.persisted = {
            key: selectKey(value.state),
            version: value.version,
          };
        } else {
          storedKey.persisted = null;
        }
      }

      return value;
    },

    setItem: (name, value) =>
      request(name, {
        kind: 'write',
        identity: { key: selectKey(value.state), version: value.version },
        value,
      }),

    removeItem: (name) => request(name, { kind: 'remove' }),
  };
}
