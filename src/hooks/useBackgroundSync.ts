// Background sync hook for automatic data refresh and cache management
// Runs every 2 minutes to keep data fresh without user intervention

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function useBackgroundSync() {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(Date.now());

  const refreshData = useCallback(async () => {
    // Only sync if page is visible (save battery when in background)
    if (document.visibilityState !== 'visible') {
      return;
    }

    // Only sync if online
    if (!navigator.onLine) {
      return;
    }

    console.log('[BackgroundSync] Refreshing data...');
    lastSyncRef.current = Date.now();

    try {
      // Invalidate react-query caches to trigger refetch
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['earthquakes'] }),
        queryClient.invalidateQueries({ queryKey: ['road-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['panic-alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['help-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['user-locations'] }),
        queryClient.invalidateQueries({ queryKey: ['community-events'] }),
      ]);

      // Check for service worker updates
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      }

      console.log('[BackgroundSync] Data refresh complete');
    } catch (error) {
      console.warn('[BackgroundSync] Error during sync:', error);
    }
  }, [queryClient]);

  // Start background sync
  useEffect(() => {
    // Initial sync after a short delay
    const initialTimeout = setTimeout(() => {
      refreshData();
    }, 10000); // 10 seconds after mount

    // Set up interval
    intervalRef.current = setInterval(() => {
      refreshData();
    }, SYNC_INTERVAL_MS);

    // Handle visibility change - sync when returning to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastSync = Date.now() - lastSyncRef.current;
        // If more than 2 minutes since last sync, refresh now
        if (timeSinceLastSync > SYNC_INTERVAL_MS) {
          refreshData();
        }
      }
    };

    // Handle coming back online
    const handleOnline = () => {
      console.log('[BackgroundSync] Back online, syncing...');
      refreshData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshData]);

  return {
    lastSync: lastSyncRef.current,
    forceSync: refreshData,
  };
}
