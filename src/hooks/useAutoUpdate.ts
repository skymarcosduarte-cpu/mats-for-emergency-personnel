// Auto-update hook - forces app update on entry if new version available
import { useEffect, useRef } from 'react';
import { checkForUpdates, isNewerVersionAvailable, APP_VERSION } from '@/lib/versionCheck';

const AUTO_UPDATE_KEY = 'auto-update-checked';
const AUTO_UPDATE_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown to prevent loops

export function useAutoUpdate() {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    const performAutoUpdate = async () => {
      try {
        // Check if we recently did an auto-update to prevent loops
        const lastCheck = localStorage.getItem(AUTO_UPDATE_KEY);
        if (lastCheck) {
          const lastCheckTime = parseInt(lastCheck, 10);
          if (Date.now() - lastCheckTime < AUTO_UPDATE_COOLDOWN) {
            console.log('[AutoUpdate] Skipping - recently checked');
            return;
          }
        }

        console.log('[AutoUpdate] Checking for updates...');

        // Check server for new version
        const versionInfo = await checkForUpdates();

        if (versionInfo && isNewerVersionAvailable(APP_VERSION, versionInfo.latest)) {
          console.log('[AutoUpdate] New version available:', versionInfo.latest);
          
          // Mark that we're doing an update
          localStorage.setItem(AUTO_UPDATE_KEY, Date.now().toString());

          // Clear all caches
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('[AutoUpdate] Caches cleared');
          }

          // Unregister service workers
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log('[AutoUpdate] Service workers unregistered');
          }

          // Force reload with cache bust
          console.log('[AutoUpdate] Reloading app...');
          window.location.href = window.location.origin + '?v=' + Date.now();
        } else {
          console.log('[AutoUpdate] App is up to date');
          // Clear the check flag since no update was needed
          localStorage.removeItem(AUTO_UPDATE_KEY);
        }
      } catch (error) {
        console.warn('[AutoUpdate] Error checking for updates:', error);
        localStorage.removeItem(AUTO_UPDATE_KEY);
      }
    };

    // Small delay to not block initial render
    const timer = setTimeout(performAutoUpdate, 1000);

    return () => clearTimeout(timer);
  }, []);
}
