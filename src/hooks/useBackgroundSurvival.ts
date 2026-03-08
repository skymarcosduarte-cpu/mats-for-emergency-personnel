// Background Survival Hook for MATS (Android PWA)
// Prevents the OS from killing/suspending the PWA when in background
// Uses multiple strategies: Web Locks API, periodic self-ping, SW keep-alive

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

// Interval for the keep-alive timer (25 seconds – below Chrome's 30 s throttle)
const KEEP_ALIVE_INTERVAL = 25_000;
// Shorter interval for the first few seconds after going to background
const AGGRESSIVE_INTERVAL = 5_000;
const AGGRESSIVE_DURATION = 60_000; // 1 minute of aggressive pings after backgrounding

/**
 * Acquires a Web Lock that is never released while the page lives.
 * Chrome Android respects Web Locks: a page holding a lock is less
 * likely to be discarded by the OS / browser.
 */
function acquireWebLock(): void {
  if (!('locks' in navigator)) return;

  navigator.locks.request(
    'mats-background-survival',
    { mode: 'exclusive', ifAvailable: false },
    () =>
      // Return a promise that never resolves → lock held forever
      new Promise<void>(() => {
        console.log('[BackgroundSurvival] Web Lock acquired');
      }),
  ).catch((err) => {
    console.warn('[BackgroundSurvival] Web Lock failed:', err);
  });
}

/**
 * Registers a periodic background sync with the service worker.
 * On Chrome Android this runs even when the tab is frozen (~every 12h min)
 * but it signals to the browser that the app needs background time.
 */
async function registerPeriodicSync(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && 'periodicSync' in reg) {
      // @ts-ignore – periodicSync not in all TS lib defs yet
      await reg.periodicSync.register('mats-keep-alive', {
        minInterval: 60 * 1000, // 1 min (browser will clamp to its own minimum)
      });
      console.log('[BackgroundSurvival] Periodic sync registered');
    }
  } catch (err) {
    // Permission denied or not supported – not critical
    console.warn('[BackgroundSurvival] Periodic sync not available:', err);
  }
}

/**
 * Asks the SW to send itself a push-like message on a timer
 * so the SW stays alive and can wake the client.
 */
async function askSWKeepAlive(userId?: string): Promise<void> {
  // Pass Supabase credentials so the SW can heartbeat directly via REST
  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  } catch { /* ignore */ }

  navigator.serviceWorker?.controller?.postMessage({
    type: 'START_KEEP_ALIVE',
    auth: {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      accessToken,
      userId,
    },
  });
}

function askSWStopKeepAlive(): void {
  navigator.serviceWorker?.controller?.postMessage({
    type: 'STOP_KEEP_ALIVE',
  });
}

/**
 * Main hook – call once in the root component.
 * Keeps the Android PWA alive in the background by combining:
 * 1. Web Locks API (prevents tab discard)
 * 2. Periodic self-wake via setTimeout chain (survives setInterval throttling)
 * 3. Service Worker keep-alive messaging
 * 4. Lightweight heartbeat to the DB so the user stays "online"
 */
export function useBackgroundSurvival() {
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundSinceRef = useRef<number | null>(null);
  const isBackgroundRef = useRef(false);

  // Ensure user has a row in user_locations (even without GPS).
  // ignoreDuplicates: true → only inserts if no row exists, never overwrites coords.
  const ensurePresenceRow = useCallback(async () => {
    if (!user) return;
    try {
      // Insert a placeholder row if none exists (ignoreDuplicates skips if row exists)
      await supabase
        .from('user_locations')
        .upsert(
          {
            user_id: user.id,
            lat: 0,
            lng: 0,
            is_online: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );

      // Always mark as online (works whether row was just created or already existed)
      await supabase
        .from('user_locations')
        .update({ is_online: true, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      console.log('[BackgroundSurvival] Presence row ensured');
    } catch {
      // non-critical
    }
  }, [user]);

  // Lightweight heartbeat – only touches is_online + updated_at, never overwrites GPS coords
  const heartbeat = useCallback(async () => {
    if (!user) return;
    try {
      await supabase
        .from('user_locations')
        .update({ updated_at: new Date().toISOString(), is_online: true })
        .eq('user_id', user.id);
    } catch {
      // non-critical
    }
  }, [user]);

  // Self-scheduling timer chain (more resilient than setInterval on Android)
  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const now = Date.now();
    const bgSince = backgroundSinceRef.current;
    const inAggressivePhase = bgSince && now - bgSince < AGGRESSIVE_DURATION;
    const interval = isBackgroundRef.current && inAggressivePhase
      ? AGGRESSIVE_INTERVAL
      : KEEP_ALIVE_INTERVAL;

    timerRef.current = setTimeout(async () => {
      // Send heartbeat even in background
      await heartbeat();
      // Reschedule
      scheduleNext();
    }, interval);
  }, [heartbeat]);

  // Visibility change handler
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        isBackgroundRef.current = true;
        backgroundSinceRef.current = Date.now();
        // Immediately start aggressive keep-alive
        scheduleNext();
        askSWKeepAlive(user?.id);
        console.log('[BackgroundSurvival] Entered background – aggressive keep-alive started');
      } else {
        isBackgroundRef.current = false;
        backgroundSinceRef.current = null;
        // Back to normal cadence
        scheduleNext();
        askSWStopKeepAlive();
        // Immediate heartbeat on return
        heartbeat();
        console.log('[BackgroundSurvival] Returned to foreground');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [scheduleNext, heartbeat]);

  // Keep SW auth token fresh when session changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && user) {
        navigator.serviceWorker?.controller?.postMessage({
          type: 'UPDATE_AUTH',
          auth: {
            supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
            supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            accessToken: session.access_token,
            userId: user.id,
          },
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [user]);

  // Initial setup – run once
  useEffect(() => {
    acquireWebLock();
    registerPeriodicSync();
    ensurePresenceRow(); // Guarantee user appears online even without GPS
    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      askSWStopKeepAlive();
    };
  }, [scheduleNext, ensurePresenceRow]);
}
