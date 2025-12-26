// Global update availability hook with Android-safe timeouts
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

// Global state for update availability (shared across components)
let globalUpdateAvailable = false;
const listeners = new Set<(available: boolean) => void>();

const notifyListeners = (available: boolean) => {
  globalUpdateAvailable = available;
  listeners.forEach(listener => listener(available));
};

// Helper to create a timeout promise
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// Timeout constants
const SW_READY_TIMEOUT = 5000; // 5 seconds to get service worker ready
const UPDATE_CHECK_TIMEOUT = 8000; // 8 seconds for update check

export function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(globalUpdateAvailable);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Subscribe to global state changes
  useEffect(() => {
    const listener = (available: boolean) => setUpdateAvailable(available);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Safe update check with timeout - stable reference
  const performUpdateCheck = useCallback(async (reg: ServiceWorkerRegistration, showToastOnError = false) => {
    if (!isMountedRef.current) return;
    
    try {
      await withTimeout(
        reg.update(),
        UPDATE_CHECK_TIMEOUT,
        'Update check timed out'
      );
      
      if (isMountedRef.current && reg.waiting) {
        notifyListeners(true);
      }
      setCheckFailed(false);
    } catch (error) {
      console.log('Update check error:', error);
      if (isMountedRef.current) {
        setCheckFailed(true);
        if (showToastOnError) {
          toast.error('No se pudo verificar actualizaciones', {
            description: 'Verifica tu conexión a internet',
            duration: 3000,
          });
        }
      }
    }
  }, []); // Empty deps - relies only on refs and external functions

  // Initialize and check for updates with safe timeout
  useEffect(() => {
    isMountedRef.current = true;

    if (!('serviceWorker' in navigator)) {
      setIsChecking(false);
      return;
    }

    const initServiceWorker = async () => {
      setIsChecking(true);

      try {
        // Wrap serviceWorker.ready in a timeout to prevent hanging
        const reg = await withTimeout(
          navigator.serviceWorker.ready,
          SW_READY_TIMEOUT,
          'Service worker ready timed out'
        );

        if (!isMountedRef.current) return;
        setRegistration(reg);
        registrationRef.current = reg;

        // Check for updates on mount with timeout
        await performUpdateCheck(reg, false);

        if (!isMountedRef.current) return;

        // Periodic checks every 2 minutes with built-in timeout
        intervalRef.current = window.setInterval(() => {
          if (isMountedRef.current && reg) {
            performUpdateCheck(reg, false);
          }
        }, 2 * 60 * 1000);

        // Listen for new service worker
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                notifyListeners(true);
              }
            });
          }
        });
      } catch (error) {
        console.log('Service worker init error:', error);
        if (isMountedRef.current) {
          setCheckFailed(true);
          // Don't show toast on initial load - just log it
        }
      } finally {
        if (isMountedRef.current) {
          setIsChecking(false);
        }
      }
    };

    initServiceWorker();

    // Listen for controller change
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []); // Empty deps - only run once on mount

  const applyUpdate = useCallback(() => {
    // Always reload after attempting to activate the waiting worker.
    // Some environments (iframes/strict browsers) can ignore controllerchange.
    if (registration?.waiting) {
      try {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch {
        // ignore
      }
    }

    // Hard reload fallback
    setTimeout(() => {
      try {
        window.location.reload();
      } catch {
        window.location.href = window.location.href;
      }
    }, 300);
  }, [registration]);

  const dismissUpdate = useCallback(() => {
    notifyListeners(false);
    sessionStorage.setItem('update-dismissed', 'true');
  }, []);

  // Manual refresh/retry for when check failed
  const retryCheck = useCallback(async () => {
    if (!registration) {
      // Try to get registration again
      if ('serviceWorker' in navigator) {
        setIsChecking(true);
        try {
          const reg = await withTimeout(
            navigator.serviceWorker.ready,
            SW_READY_TIMEOUT,
            'Service worker ready timed out'
          );
          setRegistration(reg);
          await performUpdateCheck(reg, true);
        } catch (error) {
          console.log('Retry failed:', error);
          toast.error('No se pudo verificar actualizaciones');
        } finally {
          setIsChecking(false);
        }
      }
      return;
    }

    setIsChecking(true);
    await performUpdateCheck(registration, true);
    setIsChecking(false);
  }, [registration, performUpdateCheck]);

  return {
    updateAvailable,
    isChecking,
    checkFailed,
    applyUpdate,
    dismissUpdate,
    retryCheck,
  };
}

// Simple hook just to check if update is available (for badge display)
export function useUpdateAvailable() {
  const [updateAvailable, setUpdateAvailable] = useState(globalUpdateAvailable);

  useEffect(() => {
    const listener = (available: boolean) => setUpdateAvailable(available);
    listeners.add(listener);
    // Sync with current state
    setUpdateAvailable(globalUpdateAvailable);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return updateAvailable;
}
