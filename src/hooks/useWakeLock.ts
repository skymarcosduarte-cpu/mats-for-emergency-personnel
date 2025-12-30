// Wake Lock Hook for MATS
// Prevents screen from sleeping during critical operations
// - Web: Screen Wake Lock API
// - iOS/Android (native): Capacitor KeepAwake plugin

import { useState, useCallback, useEffect, useRef } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from '@/lib/capacitor';

interface WakeLockState {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
}

/**
 * Hook to manage keeping the screen awake.
 * Note: iOS cannot keep the screen on while the app is truly in background.
 */
export function useWakeLock() {
  const native = isNative();

  // “Desired” keeps track of whether the app *wants* the screen to stay awake,
  // even if the OS releases it and we need to re-acquire.
  const desiredRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const [state, setState] = useState<WakeLockState>({
    isSupported: native || (typeof navigator !== 'undefined' && 'wakeLock' in navigator),
    isActive: false,
    error: null,
  });

  // Native support check (plugin may not be available on all platforms)
  useEffect(() => {
    if (!native) return;

    let cancelled = false;
    (async () => {
      try {
        const { isSupported } = await KeepAwake.isSupported();
        if (!cancelled) {
          setState(prev => ({ ...prev, isSupported }));
        }
      } catch (err) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            isSupported: false,
            error: 'KeepAwake no disponible en este dispositivo',
          }));
        }
        console.warn('[WakeLock] KeepAwake.isSupported failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [native]);

  // Request wake lock / keep awake
  const requestWakeLock = useCallback(async () => {
    desiredRef.current = true;

    // Native (iOS/Android)
    if (native) {
      if (!state.isSupported) {
        setState(prev => ({ ...prev, error: 'Mantener pantalla activa no soportado' }));
        return false;
      }

      try {
        await KeepAwake.keepAwake();
        setState(prev => ({ ...prev, isActive: true, error: null }));
        console.log('[WakeLock] KeepAwake activated (native)');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al activar KeepAwake';
        setState(prev => ({ ...prev, error: message, isActive: false }));
        console.warn('[WakeLock] KeepAwake.keepAwake failed:', err);
        return false;
      }
    }

    // Web
    const webSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    if (!webSupported) {
      setState(prev => ({ ...prev, error: 'Wake Lock no soportado' }));
      return false;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');

      wakeLockRef.current.addEventListener('release', () => {
        // OS released it (e.g. tab hidden). Auto re-acquire is handled by useAutoWakeLock
        // and by the visibilitychange listener below.
        setState(prev => ({ ...prev, isActive: false }));
      });

      setState(prev => ({ ...prev, isActive: true, error: null }));
      console.log('[WakeLock] Screen wake lock activated (web)');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al activar wake lock';
      setState(prev => ({ ...prev, error: message, isActive: false }));
      console.warn('[WakeLock] Failed to activate (web):', err);
      return false;
    }
  }, [native, state.isSupported]);

  // Release wake lock
  const releaseWakeLock = useCallback(async () => {
    desiredRef.current = false;

    if (native) {
      try {
        await KeepAwake.allowSleep();
        setState(prev => ({ ...prev, isActive: false }));
        console.log('[WakeLock] KeepAwake released (native)');
      } catch (err) {
        console.warn('[WakeLock] KeepAwake.allowSleep failed:', err);
      }
      return;
    }

    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setState(prev => ({ ...prev, isActive: false }));
        console.log('[WakeLock] Screen wake lock released (web)');
      } catch (err) {
        console.warn('[WakeLock] Error releasing (web):', err);
      }
    }
  }, [native]);

  // Re-acquire when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!desiredRef.current) return;

      if (native) {
        try {
          await KeepAwake.keepAwake();
          setState(prev => ({ ...prev, isActive: true, error: null }));
        } catch {
          // ignore
        }
        return;
      }

      // Web
      if (!wakeLockRef.current) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [native, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      desiredRef.current = false;

      if (native) {
        KeepAwake.allowSleep().catch(() => {});
        return;
      }

      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, [native]);

  return {
    ...state,
    requestWakeLock,
    releaseWakeLock,
  };
}

/**
 * Hook that automatically manages wake lock for a component
 * @param shouldLock - Whether to keep wake lock active
 */
export function useAutoWakeLock(shouldLock: boolean) {
  const { isSupported, isActive, requestWakeLock, releaseWakeLock } = useWakeLock();

  useEffect(() => {
    if (shouldLock && isSupported) {
      requestWakeLock();
    } else if (!shouldLock && isActive) {
      releaseWakeLock();
    }
  }, [shouldLock, isSupported, isActive, requestWakeLock, releaseWakeLock]);

  return { isSupported, isActive };
}
