import { useEffect } from 'react';
import { useStockCheckStore } from './useStockCheckStore';

/**
 * Drains the stock-check write queue when connectivity comes back.
 *
 * The other two drain triggers live in the store: `loadLocation` flushes when
 * a stock screen opens, and `onRehydrateStorage` flushes on launch. This hook
 * covers the remaining case — the app stayed open across an outage — and is
 * mounted by the stock-check screens.
 *
 * Reachability is only ever used to schedule an extra attempt. Writes are
 * never gated on it: the app can be on Wi-Fi while the API itself is down, so
 * the queue's own failures, not NetInfo, decide what stays owed.
 */
export function useStockCheckSync(): void {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      // Lazy require so the app still boots if the dependency is missing,
      // matching `useStockNetworkStatus`.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const NetInfo = require('@react-native-community/netinfo');
      unsubscribe = NetInfo.addEventListener(
        (state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => {
          const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
          if (isOnline) {
            void useStockCheckStore.getState().syncPendingOps();
          }
        },
      );
    } catch {
      void useStockCheckStore.getState().syncPendingOps();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);
}
