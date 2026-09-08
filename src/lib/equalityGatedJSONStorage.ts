import {
  createJSONStorage,
  type PersistStorage,
  type StateStorage,
} from 'zustand/middleware';

interface StoredKey<Key> {
  revision: number;
  persisted: PersistIdentity<Key> | null;
  pending: {
    identity: PersistIdentity<Key>;
    promise: Promise<unknown>;
  } | null;
}

interface PersistIdentity<Key> {
  key: Key;
  version: number | undefined;
}

/**
 * JSON persistence that avoids serialization and native writes while the
 * selected persisted value is unchanged. Writes still start immediately when
 * that value changes, and failed writes remain eligible for retry.
 */
export function createEqualityGatedJSONStorage<State, Key>(
  getStorage: () => StateStorage,
  selectKey: (state: State) => Key,
  equals: (left: Key, right: Key) => boolean = Object.is,
): PersistStorage<State> | undefined {
  const jsonStorage = createJSONStorage<State>(getStorage);
  if (!jsonStorage) return undefined;

  const keysByStorageName = new Map<string, StoredKey<Key>>();
  const identitiesEqual = (
    left: PersistIdentity<Key>,
    right: PersistIdentity<Key>,
  ): boolean => left.version === right.version && equals(left.key, right.key);
  const getStoredKey = (name: string): StoredKey<Key> => {
    const existing = keysByStorageName.get(name);
    if (existing) return existing;
    const created: StoredKey<Key> = {
      revision: 0,
      persisted: null,
      pending: null,
    };
    keysByStorageName.set(name, created);
    return created;
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

      if (
        storedKey.pending &&
        identitiesEqual(storedKey.pending.identity, nextIdentity)
      ) {
        return storedKey.pending.promise;
      }
      if (!storedKey.pending && storedKey.persisted) {
        if (identitiesEqual(storedKey.persisted, nextIdentity)) return;
      }

      const previousRevision = storedKey.revision;
      const revision = previousRevision + 1;
      storedKey.revision = revision;

      let write: unknown | Promise<unknown>;
      try {
        write = jsonStorage.setItem(name, value);
      } catch (error) {
        storedKey.revision = previousRevision;
        throw error;
      }

      const promise = Promise.resolve(write).then(
        (result) => {
          // Track the last write that actually completed. If writes finish out
          // of order, the next state update repairs storage from that result.
          storedKey.persisted = nextIdentity;
          if (storedKey.revision === revision) {
            storedKey.pending = null;
          }
          return result;
        },
        (error: unknown) => {
          if (storedKey.revision === revision) {
            storedKey.pending = null;
          }
          throw error;
        },
      );

      storedKey.pending = { identity: nextIdentity, promise };
      return promise;
    },

    removeItem: (name) => {
      keysByStorageName.delete(name);
      return jsonStorage.removeItem(name);
    },
  };
}
