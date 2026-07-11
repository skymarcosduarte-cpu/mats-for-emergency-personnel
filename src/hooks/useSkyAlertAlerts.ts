// SkyAlert Alerts Hook
// Monitors SkyAlert every 10 seconds for active seismic alerts

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  playSkyAlertSevereAlert, 
  stopSkyAlertAlert 
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
const SEEN_STORAGE_KEY = 'mats-skyalert-seen-v2';
const LAST_SOUND_STORAGE_KEY = 'mats-skyalert-last-sound';
const SOUND_ALERT_EVENT = 'mats-skyalert-sound-alert';
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds

interface UseSkyAlertAlertsOptions {
  soundNotifications?: boolean;
}

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

// Function to get initial seen IDs from localStorage synchronously
function getInitialSeenIds(): Set<string> {
  const set = new Set<string>();
  try {
    const persistedIds = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || '[]');
    if (Array.isArray(persistedIds)) persistedIds.forEach((id) => set.add(String(id)));
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const { alerts: cachedAlerts } = JSON.parse(cached);
      if (Array.isArray(cachedAlerts)) {
        cachedAlerts.forEach((a: any) => {
          if (a.id) set.add(a.id);
        });
      }
    }
  } catch (e) {
    console.warn('[SkyAlert] Error seeding seen IDs:', e);
  }
  return set;
}

// Module-level set to persist across component remounts in the same session
const sessionSeenIds = new Set<string>();

function rememberSeenId(id: string): void {
  sessionSeenIds.add(id);
  try {
    const persistedIds = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || '[]');
    const nextIds = new Set<string>(Array.isArray(persistedIds) ? persistedIds.map(String) : []);
    nextIds.add(id);
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(nextIds).slice(-100)));
  } catch {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([id]));
  }
}

function publishSoundAlert(alert: SkyAlert): void {
  localStorage.setItem(LAST_SOUND_STORAGE_KEY, JSON.stringify(alert));
  window.dispatchEvent(new CustomEvent<SkyAlert>(SOUND_ALERT_EVENT, { detail: alert }));
}

export function useSkyAlertAlerts({ soundNotifications = false }: UseSkyAlertAlertsOptions = {}) {
  const [alerts, setAlerts] = useState<SkyAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [lastSoundAlert, setLastSoundAlert] = useState<SkyAlert | null>(() => {
    try {
      const stored = localStorage.getItem(LAST_SOUND_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  
  // Use a Ref initialized from session and localStorage
  const seenAlertIds = useRef<Set<string>>(new Set(sessionSeenIds));
  const isInitialized = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef<number>(0);

  // Synchronous initialization
  if (!isInitialized.current) {
    const fromStorage = getInitialSeenIds();
    fromStorage.forEach(id => seenAlertIds.current.add(id));
    isInitialized.current = true;
  }

  // Load from cache on mount (to update the 'alerts' state)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { alerts: cachedAlerts, timestamp } = JSON.parse(cached);
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

  // Keep every mounted view synchronized with the single global sound monitor.
  useEffect(() => {
    const handleSoundAlert = (event: Event) => {
      setLastSoundAlert((event as CustomEvent<SkyAlert>).detail);
    };
    window.addEventListener(SOUND_ALERT_EVENT, handleSoundAlert);
    return () => window.removeEventListener(SOUND_ALERT_EVENT, handleSoundAlert);
  }, []);

  // Fetch alerts from edge function
  const fetchAlerts = useCallback(async (force = false) => {
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
      
      setAlerts(response.alerts);
      setLastChecked(new Date(response.lastChecked));
      setIsActive(response.isActive);

      // Save to cache
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        alerts: response.alerts,
        timestamp: Date.now(),
      }));

      // Only the app-level monitor owns deduplication and audio. The Sismos view
      // is read-only, so opening it cannot create a second notification sound.
      if (soundNotifications) {
        const soundsEnabled = areSkyAlertSoundsEnabled();

        for (const alert of response.alerts) {
          if (!seenAlertIds.current.has(alert.id) && !sessionSeenIds.has(alert.id)) {
            seenAlertIds.current.add(alert.id);
            rememberSeenId(alert.id);

            const isViolent = alert.level === 'violenta' || alert.level === 'violento';
            const isSevere = alert.level === 'severa' || alert.level === 'severo';

            if (isViolent || isSevere) {
              // Ignore alerts older than 2 minutes to prevent replays on app load.
              const alertTime = new Date(alert.timestamp).getTime();
              const alertAge = now - alertTime;

              if (alertAge >= 0 && alertAge < 120000) {
                // Publish the explanatory detail before starting the sound.
                setLastSoundAlert(alert);
                publishSoundAlert(alert);
                toast.error(
                  `${isViolent ? '💥' : '🚨'} ALERTA SÍSMICA ${alert.level.toUpperCase()} — ${alert.region}`,
                  {
                    id: `skyalert-${alert.id}`,
                    description: `${alert.source} · ${alert.magnitude ? `Magnitud ${alert.magnitude.toFixed(1)} · ` : ''}${alert.message}`,
                    duration: Infinity,
                    closeButton: true,
                  }
                );
                if (soundsEnabled) {
                  window.setTimeout(() => void playSkyAlertSevereAlert(), 250);
                }
              } else {
                console.log('[SkyAlert] Skipping audio for stale alert:', alert.id);
              }
            }
          }
        }

        const hasActiveAlert = response.alerts.some(a =>
          a.level === 'severa' || a.level === 'severo' ||
          a.level === 'violenta' || a.level === 'violento'
        );
        if (!hasActiveAlert) {
          stopSkyAlertAlert();
        }
      }

    } catch (e) {
      console.error('[SkyAlert] Fetch error:', e);
      setError(e instanceof Error ? e.message : 'Error fetching alerts');
    } finally {
      setLoading(false);
    }
  }, [soundNotifications]);

  const refresh = useCallback(() => {
    fetchAlerts(true);
  }, [fetchAlerts]);

  useEffect(() => {
    if (!isMonitoring) return;
    fetchAlerts();
    pollIntervalRef.current = setInterval(() => {
      fetchAlerts();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isMonitoring, fetchAlerts]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAlerts(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAlerts]);

  useEffect(() => {
    return () => {
      if (soundNotifications) stopSkyAlertAlert();
    };
  }, [soundNotifications]);

  return {
    alerts,
    loading,
    error,
    isMonitoring,
    setIsMonitoring,
    lastChecked,
    isActive,
    lastSoundAlert,
    refresh,
  };
}
