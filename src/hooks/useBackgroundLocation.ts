// Background Location Tracking Hook for MATS
// Provides persistent location tracking with guidance for native app

import { useCallback, useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { upsertUserLocation } from '@/lib/locationSync';
import { useAuth } from './useAuth';
import type { GeoPosition } from '@/types';

interface BackgroundLocationState {
  isTracking: boolean;
  lastPosition: GeoPosition | null;
  error: string | null;
  isNativeCapable: boolean;
}

// Minimum distance to trigger an update (in meters)
// Reduced from 50m to 15m for more responsive updates on map
const MIN_DISTANCE_METERS = 15;
// Minimum time between updates (in ms)
// Reduced from 10s to 3s for faster location updates
const MIN_UPDATE_INTERVAL_MS = 3000;

/**
 * Hook for background location tracking
 * - Uses standard Geolocation API with aggressive settings
 * - Provides guidance for Capacitor native implementation
 * - Syncs position to database for community visibility
 */
export function useBackgroundLocation() {
  const { user } = useAuth();
  const [state, setState] = useState<BackgroundLocationState>({
    isTracking: false,
    lastPosition: null,
    error: null,
    isNativeCapable: false, // Will be true when using Capacitor
  });

  const watchIdRef = useRef<number | null>(null);
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

    try {
      await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          heading: position.heading,
          speed: position.speed,
          is_online: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      lastUpdateRef.current = now;
      lastPositionRef.current = position;
      
      setState(prev => ({ ...prev, lastPosition: position, error: null }));
    } catch (error) {
      console.error('[BackgroundLocation] Sync failed:', error);
    }
  }, [user, calculateDistance]);

  // Start background tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ ...prev, error: 'Geolocalización no soportada' }));
      return;
    }

    if (watchIdRef.current !== null) {
      return; // Already tracking
    }

    setState(prev => ({ ...prev, isTracking: true, error: null }));

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
        console.error('[BackgroundLocation] Watch error:', err);
        setState(prev => ({ 
          ...prev, 
          error: err.message || 'Error de ubicación' 
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 5000,
      }
    );

    console.log('[BackgroundLocation] Tracking started');
  }, [syncPosition]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
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
          console.warn('[BackgroundLocation] Failed to mark offline:', e);
        }
      }

      console.log('[BackgroundLocation] Tracking stopped');
    }
  }, [user]);

  // Handle visibility changes - pause/resume tracking
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && state.isTracking && watchIdRef.current === null) {
        // Resume tracking when coming back to foreground
        startTracking();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [state.isTracking, startTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
  };
}

/**
 * Capacitor Background Location Guide
 * 
 * For true background location tracking on mobile (screen off, app minimized),
 * you need to implement Capacitor with the @capacitor-community/background-geolocation plugin:
 * 
 * 1. Install dependencies:
 *    npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
 *    npm install @capacitor-community/background-geolocation
 * 
 * 2. Initialize Capacitor:
 *    npx cap init
 * 
 * 3. Add platforms:
 *    npx cap add ios
 *    npx cap add android
 * 
 * 4. Configure background location in native code:
 *    - iOS: Add location permissions to Info.plist
 *    - Android: Add background location permissions to AndroidManifest.xml
 * 
 * 5. Use the plugin:
 *    import { BackgroundGeolocation } from '@capacitor-community/background-geolocation';
 *    
 *    await BackgroundGeolocation.addWatcher({
 *      backgroundTitle: "MATS - Rastreo activo",
 *      backgroundMessage: "Compartiendo ubicación con la comunidad",
 *      requestPermissions: true,
 *      stale: false,
 *    }, (location, error) => {
 *      if (location) {
 *        // Sync to database
 *      }
 *    });
 * 
 * Note: Background location requires explicit user permission and may drain battery.
 */
