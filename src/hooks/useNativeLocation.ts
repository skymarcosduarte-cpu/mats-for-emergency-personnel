// Native Background Location Hook for MATS
// Uses Capacitor plugins for true background location tracking

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation, type Position } from '@capacitor/geolocation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { GeoPosition } from '@/types';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

// Register the background geolocation plugin (only works on native)
const BackgroundGeolocation = Capacitor.isNativePlatform()
  ? registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
  : null;

interface NativeLocationState {
  isTracking: boolean;
  lastPosition: GeoPosition | null;
  error: string | null;
  isNative: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
}

// Minimum distance to trigger an update (in meters)
// Reduced from 15m to 5m for more responsive map updates and to detect small movements
const MIN_DISTANCE_METERS = 5;
// Minimum time between updates (in ms)
// Reduced from 10s to 3s for faster location updates
const MIN_UPDATE_INTERVAL_MS = 3000;

/**
 * Native location hook that uses Capacitor for native apps
 * Falls back to web Geolocation API for PWA
 */
export function useNativeLocation() {
  const { user } = useAuth();
  const isNative = Capacitor.isNativePlatform();
  
  const [state, setState] = useState<NativeLocationState>({
    isTracking: false,
    lastPosition: null,
    error: null,
    isNative,
    permissionStatus: 'unknown',
  });

  const watchIdRef = useRef<string | number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastPositionRef = useRef<GeoPosition | null>(null);

  // Calculate distance between two points (Haversine)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Calculate speed from position difference when GPS doesn't report it
  const calculateSpeedFromPositions = useCallback((
    currentLat: number,
    currentLng: number,
    lastLat: number,
    lastLng: number,
    timeDiffMs: number
  ): number | null => {
    if (timeDiffMs <= 0) return null;
    
    const distanceMeters = calculateDistance(lastLat, lastLng, currentLat, currentLng);
    const timeDiffSeconds = timeDiffMs / 1000;
    
    // Speed in m/s
    const speedMs = distanceMeters / timeDiffSeconds;
    
    // Filter out unrealistic speeds (> 200 km/h = 55.5 m/s)
    if (speedMs > 55.5) return null;
    
    // Filter out noise (< 0.1 m/s = 0.36 km/h, likely stationary)
    if (speedMs < 0.1) return 0;
    
    return speedMs;
  }, [calculateDistance]);

  // Sync position to database
  const syncPosition = useCallback(async (position: GeoPosition) => {
    if (!user) return;

    const now = Date.now();
    const lastPos = lastPositionRef.current;

    // Check if we should update (time and distance thresholds)
    if (lastPos) {
      const timeSinceLastUpdate = now - lastUpdateRef.current;
      const distance = calculateDistance(lastPos.lat, lastPos.lng, position.lat, position.lng);

      if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL_MS && distance < MIN_DISTANCE_METERS) {
        return; // Skip this update
      }
    }

    // Calculate speed from position difference if GPS doesn't report it or reports 0
    let effectiveSpeed = position.speed;
    if (lastPos && lastUpdateRef.current > 0) {
      const timeDiffMs = now - lastUpdateRef.current;
      const gpsSpeedInvalid = position.speed === null || position.speed === undefined || position.speed < 0.1;
      
      if (gpsSpeedInvalid && timeDiffMs > 0) {
        const calculatedSpeed = calculateSpeedFromPositions(
          position.lat,
          position.lng,
          lastPos.lat,
          lastPos.lng,
          timeDiffMs
        );
        
        if (calculatedSpeed !== null) {
          effectiveSpeed = calculatedSpeed;
          console.log(`[NativeLocation] Calculated speed from positions: ${(calculatedSpeed * 3.6).toFixed(1)} km/h`);
        }
      }
    }

    try {
      await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          heading: position.heading,
          speed: effectiveSpeed,
          is_online: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      lastUpdateRef.current = now;
      lastPositionRef.current = position;
      
      setState(prev => ({ ...prev, lastPosition: position, error: null }));
    } catch (error) {
      console.error('[NativeLocation] Sync failed:', error);
    }
  }, [user, calculateDistance, calculateSpeedFromPositions]);

  // Convert Capacitor Position to GeoPosition
  const convertPosition = useCallback((pos: Position): GeoPosition => ({
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    heading: pos.coords.heading,
    speed: pos.coords.speed,
    timestamp: pos.timestamp,
  }), []);

  // Check and request permissions
  const checkPermissions = useCallback(async () => {
    try {
      if (isNative) {
        const status = await Geolocation.checkPermissions();
        setState(prev => ({ ...prev, permissionStatus: status.location as any }));
        return status.location;
      } else {
        // Web fallback
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setState(prev => ({ ...prev, permissionStatus: result.state as any }));
        return result.state;
      }
    } catch (error) {
      console.error('[NativeLocation] Permission check failed:', error);
      return 'unknown';
    }
  }, [isNative]);

  const requestPermissions = useCallback(async () => {
    try {
      if (isNative) {
        const status = await Geolocation.requestPermissions();
        setState(prev => ({ ...prev, permissionStatus: status.location as any }));
        return status.location === 'granted';
      } else {
        // Web fallback - trigger permission prompt
        return new Promise<boolean>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setState(prev => ({ ...prev, permissionStatus: 'granted' }));
              resolve(true);
            },
            () => {
              setState(prev => ({ ...prev, permissionStatus: 'denied' }));
              resolve(false);
            }
          );
        });
      }
    } catch (error) {
      console.error('[NativeLocation] Permission request failed:', error);
      return false;
    }
  }, [isNative]);

  // Start foreground location tracking (works on all platforms)
  const startForegroundTracking = useCallback(async () => {
    if (watchIdRef.current !== null) return;

    setState(prev => ({ ...prev, isTracking: true, error: null }));

    try {
      if (isNative) {
        // Use Capacitor Geolocation for native
        watchIdRef.current = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 5000,
          },
          (position, error) => {
            if (error) {
              console.error('[NativeLocation] Watch error:', error);
              setState(prev => ({ ...prev, error: error.message }));
              return;
            }
            if (position) {
              const geoPos = convertPosition(position);
              syncPosition(geoPos);
            }
          }
        );
      } else {
        // Web fallback
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const geoPos: GeoPosition = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            };
            syncPosition(geoPos);
          },
          (err) => {
            console.error('[NativeLocation] Web watch error:', err);
            setState(prev => ({ ...prev, error: err.message }));
          },
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 5000,
          }
        );
      }

      console.log('[NativeLocation] Foreground tracking started');
    } catch (error) {
      console.error('[NativeLocation] Failed to start tracking:', error);
      setState(prev => ({ 
        ...prev, 
        isTracking: false,
        error: error instanceof Error ? error.message : 'Error al iniciar rastreo' 
      }));
    }
  }, [isNative, convertPosition, syncPosition]);

  // Start background location tracking (native only)
  const startBackgroundTracking = useCallback(async () => {
    if (!isNative || !BackgroundGeolocation) {
      console.log('[NativeLocation] Background tracking not available on this platform');
      // Fall back to foreground tracking
      return startForegroundTracking();
    }

    try {
      setState(prev => ({ ...prev, isTracking: true, error: null }));

      watchIdRef.current = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: 'MATS - Rastreo activo',
          backgroundMessage: 'Compartiendo ubicación con la comunidad',
          requestPermissions: true,
          stale: false,
          distanceFilter: MIN_DISTANCE_METERS,
        },
        (location: any, error: any) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              setState(prev => ({ 
                ...prev, 
                error: 'Permiso de ubicación en segundo plano denegado',
                permissionStatus: 'denied',
              }));
            }
            console.error('[NativeLocation] Background error:', error);
            return;
          }

          if (location) {
            const geoPos: GeoPosition = {
              lat: location.latitude,
              lng: location.longitude,
              accuracy: location.accuracy,
              heading: location.bearing,
              speed: location.speed,
              timestamp: location.time,
            };
            syncPosition(geoPos);
          }
        }
      );

      console.log('[NativeLocation] Background tracking started');
    } catch (error) {
      console.error('[NativeLocation] Failed to start background tracking:', error);
      // Fall back to foreground tracking
      return startForegroundTracking();
    }
  }, [isNative, syncPosition, startForegroundTracking]);

  // Stop all location tracking
  const stopTracking = useCallback(async () => {
    if (watchIdRef.current === null) return;

    try {
      if (isNative && BackgroundGeolocation && typeof watchIdRef.current === 'string') {
        await BackgroundGeolocation.removeWatcher({ id: watchIdRef.current });
      } else if (isNative) {
        await Geolocation.clearWatch({ id: watchIdRef.current as string });
      } else if (typeof watchIdRef.current === 'number') {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      watchIdRef.current = null;
      setState(prev => ({ ...prev, isTracking: false }));

      // Mark offline
      if (user) {
        try {
          await supabase
            .from('user_locations')
            .update({ is_online: false })
            .eq('user_id', user.id);
        } catch (e) {
          console.warn('[NativeLocation] Failed to mark offline:', e);
        }
      }

      console.log('[NativeLocation] Tracking stopped');
    } catch (error) {
      console.error('[NativeLocation] Failed to stop tracking:', error);
    }
  }, [isNative, user]);

  // Get current position once
  const getCurrentPosition = useCallback(async (): Promise<GeoPosition | null> => {
    try {
      if (isNative) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 5000,
        });
        const geoPos = convertPosition(position);
        syncPosition(geoPos);
        return geoPos;
      } else {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const geoPos: GeoPosition = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                heading: pos.coords.heading,
                speed: pos.coords.speed,
                timestamp: pos.timestamp,
              };
              syncPosition(geoPos);
              resolve(geoPos);
            },
            reject,
            {
              enableHighAccuracy: true,
              timeout: 30000,
              maximumAge: 5000,
            }
          );
        });
      }
    } catch (error) {
      console.error('[NativeLocation] Failed to get current position:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Error al obtener ubicación' 
      }));
      return null;
    }
  }, [isNative, convertPosition, syncPosition]);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        stopTracking();
      }
    };
  }, [stopTracking]);

  return {
    ...state,
    checkPermissions,
    requestPermissions,
    getCurrentPosition,
    startForegroundTracking,
    startBackgroundTracking,
    stopTracking,
  };
}
