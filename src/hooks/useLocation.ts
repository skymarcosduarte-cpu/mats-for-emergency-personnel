// Geolocation Hook for COMUNIDAD EX SOS

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GeoPosition } from '@/types';

interface LocationState {
  position: GeoPosition | null;
  loading: boolean;
  error: string | null;
  watching: boolean;
}

interface UseLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoWatch?: boolean;
}

const DEFAULT_OPTIONS: UseLocationOptions = {
  enableHighAccuracy: true,
  timeout: 30000,
  maximumAge: 0,
  autoWatch: true,
};

export function useLocation(options: UseLocationOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<LocationState>({
    position: null,
    loading: true,
    error: null,
    watching: false,
  });

  const watchIdRef = useRef<number | null>(null);

  // Convert GeolocationPosition to our GeoPosition type
  const convertPosition = (pos: GeolocationPosition): GeoPosition => ({
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    heading: pos.coords.heading,
    speed: pos.coords.speed,
    timestamp: pos.timestamp,
  });

  // Sync position to database for other users to see
  const syncPositionToDb = useCallback(async (pos: GeoPosition) => {
    try {
      let { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Session may have expired — try refreshing before giving up
        console.warn('[useLocation] No user from getUser, refreshing session...');
        const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr || !refreshData.user) {
          console.error('[useLocation] Session refresh failed, cannot sync location');
          return;
        }
        user = refreshData.user;
        console.log('[useLocation] Session recovered after refresh');
      }

      const payload = {
        user_id: user.id,
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        heading: pos.heading,
        speed: pos.speed,
        is_online: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_locations')
        .upsert(payload, { onConflict: 'user_id' });

      // If RLS error, try refreshing session and retry once
      if (error && (error.code === '42501' || error.message?.includes('row-level security'))) {
        console.warn('[useLocation] RLS error, refreshing session and retrying...');
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          const { error: retryError } = await supabase
            .from('user_locations')
            .upsert(payload, { onConflict: 'user_id' });
          if (retryError) {
            console.error('[useLocation] Retry after refresh failed:', retryError.message);
          } else {
            console.log('[useLocation] Location synced after session refresh');
          }
        } else {
          console.error('[useLocation] Session refresh failed:', refreshError.message);
        }
      } else if (error) {
        console.error('Error syncing location to DB:', error.message);
      }
    } catch (error) {
      console.error('Error syncing location to DB:', error);
    }
  }, []);

  // Handle position update
  const handlePosition = useCallback((pos: GeolocationPosition) => {
    const geoPos = convertPosition(pos);
    setState(prev => ({
      ...prev,
      position: geoPos,
      loading: false,
      error: null,
    }));
    // Sync to database so other users can see
    syncPositionToDb(geoPos);
  }, [syncPositionToDb]);

  // Handle error with automatic retry for timeout
  const handleError = useCallback((err: GeolocationPositionError) => {
    // Spec-defined codes: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
    // iOS Safari doesn't reliably expose the PERMISSION_DENIED constants on the error instance.
    let errorMessage: string;

    switch (err.code) {
      case 1:
        errorMessage = 'Permiso de ubicación denegado. Por favor, habilita el acceso a la ubicación.';
        break;
      case 2:
        errorMessage = 'No se pudo obtener la ubicación. Verifica tu conexión GPS.';
        break;
      case 3:
        // For timeout, don't show error - just log and the watcher will retry
        console.warn('[useLocation] GPS timeout - watcher will continue trying');
        // Don't update error state for timeouts to avoid alarming the user
        return;
      default:
        errorMessage = 'Error al obtener la ubicación.';
    }

    console.warn('[useLocation] Geolocation error', {
      code: err.code,
      message: (err as any)?.message,
    });

    setState(prev => ({
      ...prev,
      loading: false,
      error: errorMessage,
    }));
  }, []);

  // Get current position once
  const getCurrentPosition = useCallback((): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPos = convertPosition(pos);
          handlePosition(pos);
          resolve(geoPos);
        },
        (err) => {
          // iOS can be picky with high accuracy + fresh fix; retry once with relaxed settings.
          const code = (err as any)?.code;
          if (code === 3 && opts.enableHighAccuracy) {
            navigator.geolocation.getCurrentPosition(
              (pos2) => {
                const geoPos2 = convertPosition(pos2);
                handlePosition(pos2);
                resolve(geoPos2);
              },
              (err2) => {
                handleError(err2);
                reject(err2);
              },
              {
                enableHighAccuracy: false,
                timeout: Math.max(15000, opts.timeout ?? 0),
                maximumAge: Math.max(60000, opts.maximumAge ?? 0),
              }
            );
            return;
          }

          handleError(err);
          reject(err);
        },
        {
          enableHighAccuracy: opts.enableHighAccuracy,
          timeout: opts.timeout,
          maximumAge: opts.maximumAge,
        }
      );
    });
  }, [opts.enableHighAccuracy, opts.timeout, opts.maximumAge, handlePosition, handleError]);

  // Start watching position
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocalización no soportada',
        loading: false,
      }));
      return;
    }

    if (watchIdRef.current !== null) {
      return; // Already watching
    }

    setState(prev => ({ ...prev, watching: true }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        // Use at least 2000ms maximumAge to get more frequent updates
        maximumAge: Math.min(opts.maximumAge ?? 0, 2000),
      }
    );
  }, [opts.enableHighAccuracy, opts.timeout, opts.maximumAge, handlePosition, handleError]);

  // Mark user as offline in database
  const markOffline = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('user_locations')
        .update({ is_online: false })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error marking offline:', error);
    }
  }, []);

  // Stop watching position
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setState(prev => ({ ...prev, watching: false }));
      markOffline();
    }
  }, [markOffline]);

  // Auto-watch on mount with periodic forced refresh
  useEffect(() => {
    if (opts.autoWatch) {
      startWatching();
    }

    // Force a getCurrentPosition every 5 seconds as backup
    // This helps when watchPosition stops working (common on iOS)
    // and provides more real-time location updates
    const forceRefreshInterval = setInterval(() => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          handlePosition,
          () => {}, // Silently ignore errors for backup refresh
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 2000,
          }
        );
      }
    }, 5000);

    // Mark offline when page unloads
    const handleUnload = () => {
      markOffline();
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      stopWatching();
      clearInterval(forceRefreshInterval);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [opts.autoWatch, startWatching, stopWatching, markOffline, handlePosition]);

  // Request permission (for UI purposes)
  const requestPermission = useCallback(async () => {
    try {
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state;
      }
      return 'prompt';
    } catch {
      return 'unknown';
    }
  }, []);

  return {
    ...state,
    getCurrentPosition,
    startWatching,
    stopWatching,
    requestPermission,
  };
}

// Format coordinates for display
export function formatCoordinates(lat: number, lng: number, precision = 6): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

// Format coordinates for WhatsApp message
export function formatCoordinatesForWhatsApp(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

// Generate Google Maps link
export function getGoogleMapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Format distance for display
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}
