import {
  createJSONStorage,
  type PersistStorage,
  type StateStorage,
  type StorageValue,
} from 'zustand/middleware';

interface StoredKey<State, Key> {
  revision: number;
  persisted: PersistIdentity<Key> | null;
  inFlight: {
    identity: PersistIdentity<Key>;
    promise: Promise<unknown>;
  } | null;
  queued: {
    identity: PersistIdentity<Key>;
    value: StorageValue<State>;
    resolve: (result: unknown) => void;
    reject: (error: unknown) => void;
    promise: Promise<unknown>;
  } | null;
}

interface PersistIdentity<Key> {
  key: Key;
  version: number | undefined;
}

/**
 * JSON persistence that avoids serialization and native writes while the
 * selected persisted value is unchanged. Writes for one storage name are
 * serialized: while a native write is in flight, the newest requested value
 * waits and is written once the in-flight write settles, so the last value
 * on disk is always the newest one requested. Failed writes remain eligible
 * for retry.
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

  const startWrite = (
    name: string,
    storedKey: StoredKey<State, Key>,
    identity: PersistIdentity<Key>,
    value: StorageValue<State>,
  ): Promise<unknown> => {
    const previousRevision = storedKey.revision;
    storedKey.revision = previousRevision + 1;

    let write: unknown | Promise<unknown>;
    try {
      write = jsonStorage.setItem(name, value);
    } catch (error) {
      storedKey.revision = previousRevision;
      throw error;
    }

    const promise = Promise.resolve(write).then(
      (result) => {
        storedKey.persisted = identity;
        storedKey.inFlight = null;
        drainQueue(name, storedKey);
        return result;
      },
      (error: unknown) => {
        storedKey.inFlight = null;
        drainQueue(name, storedKey);
        throw error;
      },
    );

    storedKey.inFlight = { identity, promise };
    return promise;
  };

  const drainQueue = (name: string, storedKey: StoredKey<State, Key>) => {
    const queued = storedKey.queued;
    if (!queued) return;
    storedKey.queued = null;
    if (
      storedKey.persisted &&
      identitiesEqual(storedKey.persisted, queued.identity)
    ) {
      queued.resolve(undefined);
      return;
    }
    try {
      startWrite(name, storedKey, queued.identity, queued.value).then(
        queued.resolve,
        queued.reject,
      );
    } catch (error) {
      queued.reject(error);
    }
  };

  return {
    getItem: async (name) => {
      const storedKey = getStoredKey(name);
      const revision = storedKey.revision;
      const value = await jsonStorage.getItem(name);

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

    setItem: (name, value) => {
      const storedKey = getStoredKey(name);
      const nextIdentity: PersistIdentity<Key> = {
        key: selectKey(value.state),
        version: value.version,
      };

      if (storedKey.queued) {
        // Only the newest requested value is written after the in-flight
        // write settles. Earlier queued values are superseded.
        storedKey.queued.identity = nextIdentity;
        storedKey.queued.value = value;
        return storedKey.queued.promise;
      }

      if (storedKey.inFlight) {
        if (identitiesEqual(storedKey.inFlight.identity, nextIdentity)) {
          return storedKey.inFlight.promise;
        }
        let resolve!: (result: unknown) => void;
        let reject!: (error: unknown) => void;
        const promise = new Promise<unknown>((done, fail) => {
          resolve = done;
          reject = fail;
        });
        storedKey.queued = { identity: nextIdentity, value, resolve, reject, promise };
        return promise;
      }

      if (storedKey.persisted && identitiesEqual(storedKey.persisted, nextIdentity)) {
        return;
      }

      return startWrite(name, storedKey, nextIdentity, value);
    },

    removeItem: (name) => {
      keysByStorageName.delete(name);
      return jsonStorage.removeItem(name);
    },
  };
}
