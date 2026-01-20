// Auto-update hook - forces app update on EVERY entry if new version available
import { useEffect, useRef } from 'react';
import { checkForUpdates, isNewerVersionAvailable, APP_VERSION } from '@/lib/versionCheck';

// Use sessionStorage to prevent infinite loops within same session only
const SESSION_UPDATE_KEY = 'session-update-done';

export function useAutoUpdate() {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    const performAutoUpdate = async () => {
      try {
        // Only prevent infinite loops within the SAME session
        // Each new session (new tab, app restart) will check again
        if (sessionStorage.getItem(SESSION_UPDATE_KEY)) {
          console.log('[AutoUpdate] Already updated this session');
          return;
        }

        console.log('[AutoUpdate] Checking for updates on app entry...');

        // Check server for new version
        const versionInfo = await checkForUpdates();

        if (versionInfo && isNewerVersionAvailable(APP_VERSION, versionInfo.latest)) {
          console.log('[AutoUpdate] New version available:', versionInfo.latest, '(current:', APP_VERSION, ')');
          
          // Mark session so we don't loop infinitely
          sessionStorage.setItem(SESSION_UPDATE_KEY, 'true');

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
          console.log('[AutoUpdate] Forcing app reload...');
          window.location.href = window.location.origin + '?v=' + Date.now();
        } else {
          console.log('[AutoUpdate] App is up to date (v' + APP_VERSION + ')');
        }
      } catch (error) {
        console.warn('[AutoUpdate] Error checking for updates:', error);
      }
    };

    // Minimal delay to not block initial render
    const timer = setTimeout(performAutoUpdate, 500);

    return () => clearTimeout(timer);
  }, []);
}
