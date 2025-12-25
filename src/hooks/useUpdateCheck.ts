// Global update availability hook
import { useState, useEffect, useCallback } from 'react';

// Global state for update availability (shared across components)
let globalUpdateAvailable = false;
const listeners = new Set<(available: boolean) => void>();

const notifyListeners = (available: boolean) => {
  globalUpdateAvailable = available;
  listeners.forEach(listener => listener(available));
};

export function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(globalUpdateAvailable);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Subscribe to global state changes
  useEffect(() => {
    const listener = (available: boolean) => setUpdateAvailable(available);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Initialize and check for updates
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then(async (reg) => {
      setRegistration(reg);
      
      // Check for updates on mount
      setIsChecking(true);
      try {
        await reg.update();
        if (reg.waiting) {
          notifyListeners(true);
        }
      } catch (error) {
        console.log("Update check error:", error);
      } finally {
        setIsChecking(false);
      }
      
      // Periodic checks every 2 minutes
      const interval = setInterval(async () => {
        try {
          await reg.update();
          if (reg.waiting) {
            notifyListeners(true);
          }
        } catch {
          // Ignore
        }
      }, 2 * 60 * 1000);
      
      // Listen for new service worker
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              notifyListeners(true);
            }
          });
        }
      });

      return () => clearInterval(interval);
    });

    // Listen for controller change
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  }, [registration]);

  const dismissUpdate = useCallback(() => {
    notifyListeners(false);
    sessionStorage.setItem("update-dismissed", "true");
  }, []);

  return {
    updateAvailable,
    isChecking,
    applyUpdate,
    dismissUpdate,
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
