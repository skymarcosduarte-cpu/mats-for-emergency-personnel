// Wake Lock Hook for MATS
// Prevents screen from sleeping during critical operations

import { useState, useCallback, useEffect, useRef } from 'react';

interface WakeLockState {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
}

/**
 * Hook to manage Screen Wake Lock API
 * Keeps screen awake during navigation, emergencies, etc.
 */
export function useWakeLock() {
  const [state, setState] = useState<WakeLockState>({
    isSupported: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
    isActive: false,
    error: null,
  });

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Request wake lock
  const requestWakeLock = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Wake Lock no soportado' }));
      return false;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      
      wakeLockRef.current.addEventListener('release', () => {
        setState(prev => ({ ...prev, isActive: false }));
      });

      setState(prev => ({ ...prev, isActive: true, error: null }));
      console.log('[WakeLock] Screen wake lock activated');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al activar wake lock';
      setState(prev => ({ ...prev, error: message, isActive: false }));
      console.warn('[WakeLock] Failed to activate:', err);
      return false;
    }
  }, [state.isSupported]);

  // Release wake lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setState(prev => ({ ...prev, isActive: false }));
        console.log('[WakeLock] Screen wake lock released');
      } catch (err) {
        console.warn('[WakeLock] Error releasing:', err);
      }
    }
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && state.isActive && !wakeLockRef.current) {
        // Page is visible again, re-acquire wake lock
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isActive, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, []);

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
