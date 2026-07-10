// SkyAlert Alerts Hook
// Monitors SkyAlert every 10 seconds for active seismic alerts

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  playSkyAlertSevereAlert, 
  stopSkyAlertAlert, 
  playSkyAlertNotification 
} from '@/lib/alertSound';

export interface SkyAlert {
  id: string;
  level: 'preventiva' | 'moderada' | 'severa' | 'violenta' | 'severo' | 'violento';
  magnitude?: number;
  region: string;
  message: string;
  timestamp: string;
  source: string;
  epicenterLat?: number;
  epicenterLng?: number;
}

interface SkyAlertResponse {
  alerts: SkyAlert[];
  lastChecked: string;
  isActive: boolean;
}

const STORAGE_KEY = 'mats-skyalert-cache';
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds

// Get SkyAlert settings from alert settings
function areSkyAlertSoundsEnabled(): boolean {
  try {
    const stored = localStorage.getItem('mats-alert-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.skyAlertSounds ?? true;
    }
  } catch {
    // Ignore errors
  }
  return true;
}

export function useSkyAlertAlerts() {
  const [alerts, setAlerts] = useState<SkyAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(false);
  
  const seenAlertIds = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef<number>(0);

  // Load from cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { alerts: cachedAlerts, timestamp } = JSON.parse(cached);
        // Always seed seen IDs from cache to prevent re-alerting on reload
        if (Array.isArray(cachedAlerts)) {
          cachedAlerts.forEach((a: SkyAlert) => seenAlertIds.current.add(a.id));
        }
        const age = Date.now() - timestamp;
        if (age < CACHE_TTL_MS) {
          setAlerts(cachedAlerts);
          setLastChecked(new Date(timestamp));
        }
      }
    } catch (e) {
      console.warn('[SkyAlert] Cache load error:', e);
    }
  }, []);

  // Fetch alerts from edge function
  const fetchAlerts = useCallback(async (force = false) => {
    // Throttle requests
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 5000) {
      return;
    }
    lastFetchRef.current = now;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-skyalert');
      
      if (fnError) {
        throw fnError;
      }

      const response = data as SkyAlertResponse;
      
      // Update state
      setAlerts(response.alerts);
      setLastChecked(new Date(response.lastChecked));
      setIsActive(response.isActive);

      // Save to cache
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        alerts: response.alerts,
        timestamp: Date.now(),
      }));

      // Check for new alerts and notify
      const soundsEnabled = areSkyAlertSoundsEnabled();
      
      for (const alert of response.alerts) {
        if (!seenAlertIds.current.has(alert.id)) {
          seenAlertIds.current.add(alert.id);
          
          // Show toast and play sound only for severe/violent alerts
          const isViolent = alert.level === 'violenta' || alert.level === 'violento';
          const isSevere = alert.level === 'severa' || alert.level === 'severo';
          
          if (isViolent) {
            toast.error(
              `💥 ALERTA SÍSMICA VIOLENTA — ${alert.region}`,
              {
                description: `Fuente: ${alert.source}\n${alert.magnitude ? `Magnitud ${alert.magnitude.toFixed(1)} · ` : ''}${alert.message}`,
                duration: Infinity,
                closeButton: true,
              }
            );
            if (soundsEnabled) {
              playSkyAlertSevereAlert();
            }
          } else if (isSevere) {
            toast.error(
              `🚨 ALERTA SÍSMICA SEVERA — ${alert.region}`,
              {
                description: `Fuente: ${alert.source}\n${alert.magnitude ? `Magnitud ${alert.magnitude.toFixed(1)} · ` : ''}${alert.message}`,
                duration: Infinity,
                closeButton: true,
              }
            );
            if (soundsEnabled) {
              playSkyAlertSevereAlert();
            }
          }
          // Moderada and Preventiva alerts are silently logged, no toast/sound
        }
      }

      // Stop severe alert sound if no more severe/violent alerts
      const hasActiveAlert = response.alerts.some(a => 
        a.level === 'severa' || a.level === 'severo' || 
        a.level === 'violenta' || a.level === 'violento'
      );
      if (!hasActiveAlert) {
        stopSkyAlertAlert();
      }

    } catch (e) {
      console.error('[SkyAlert] Fetch error:', e);
      setError(e instanceof Error ? e.message : 'Error fetching alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchAlerts(true);
  }, [fetchAlerts]);

  // Start polling
  useEffect(() => {
    if (!isMonitoring) return;

    // Initial fetch
    fetchAlerts();

    // Poll every 10 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchAlerts();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isMonitoring, fetchAlerts]);

  // Handle visibility change - refresh when app comes back to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[SkyAlert] App visible, refreshing...');
        fetchAlerts(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAlerts]);

  // Register periodic sync with Service Worker
  useEffect(() => {
    const registerPeriodicSync = async () => {
      if ('serviceWorker' in navigator && 'periodicSync' in (navigator as any).serviceWorker) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if ('periodicSync' in registration) {
            await (registration as any).periodicSync.register('skyalert-check', {
              minInterval: 60 * 1000, // 1 minute minimum
            });
            console.log('[SkyAlert] Periodic sync registered');
          }
        } catch (e) {
          console.warn('[SkyAlert] Periodic sync registration failed:', e);
        }
      }
    };

    registerPeriodicSync();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSkyAlertAlert();
    };
  }, []);

  return {
    alerts,
    loading,
    error,
    isMonitoring,
    setIsMonitoring,
    lastChecked,
    isActive,
    refresh,
  };
}
