// Earthquake Detection Hook for COMUNIDAD EX SOS
// Monitors USGS feed and alerts user when earthquake is detected near their location

import { useState, useEffect, useCallback, useRef } from 'react';
import type { USGSEarthquake, GeoPosition } from '@/types';
import { calculateDistance } from '@/hooks/useLocation';
import { getEarthquakeRadiusKm } from '@/hooks/useAlertSettings';

const USGS_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute

// Storage key for persisting acknowledged earthquakes
const ACKNOWLEDGED_QUAKES_KEY = 'acknowledged_earthquakes';

// Helper to get acknowledged quakes from localStorage
function getAcknowledgedQuakes(): Set<string> {
  try {
    const stored = localStorage.getItem(ACKNOWLEDGED_QUAKES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Filter out old entries (older than 7 days)
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const filtered = Object.entries(parsed)
        .filter(([_, timestamp]) => now - (timestamp as number) < sevenDaysMs)
        .map(([id]) => id);
      return new Set(filtered);
    }
  } catch {
    console.warn('[EarthquakeDetection] Error reading acknowledged quakes from storage');
  }
  return new Set();
}

// Helper to save acknowledged quakes to localStorage
function saveAcknowledgedQuake(quakeId: string) {
  try {
    const stored = localStorage.getItem(ACKNOWLEDGED_QUAKES_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[quakeId] = Date.now();
    // Clean old entries while saving
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const cleaned = Object.fromEntries(
      Object.entries(parsed).filter(([_, timestamp]) => now - (timestamp as number) < sevenDaysMs)
    );
    localStorage.setItem(ACKNOWLEDGED_QUAKES_KEY, JSON.stringify(cleaned));
  } catch {
    console.warn('[EarthquakeDetection] Error saving acknowledged quake to storage');
  }
}

interface EarthquakeDetectionState {
  nearbyQuake: USGSEarthquake | null;
  distanceKm: number | null;
  loading: boolean;
  lastChecked: Date | null;
}

interface NearbyEarthquake {
  earthquake: USGSEarthquake;
  distanceKm: number;
}

// Callback type for push notifications
type NotifyCallback = (earthquake: USGSEarthquake, distanceKm: number) => void;

export function useEarthquakeDetection(
  position: GeoPosition | null,
  onEarthquakeDetected?: NotifyCallback
) {
  const [state, setState] = useState<EarthquakeDetectionState>({
    nearbyQuake: null,
    distanceKm: null,
    loading: false,
    lastChecked: null,
  });
  
  // Track which earthquakes we've already alerted about - load from storage on init
  const alertedQuakesRef = useRef<Set<string>>(getAcknowledgedQuakes());
  // Store dismissed quakes for the session (also persist)
  const dismissedQuakesRef = useRef<Set<string>>(getAcknowledgedQuakes());
  // Store callback ref to avoid stale closures
  const notifyCallbackRef = useRef<NotifyCallback | undefined>(onEarthquakeDetected);

  // Update callback ref when it changes
  useEffect(() => {
    notifyCallbackRef.current = onEarthquakeDetected;
  }, [onEarthquakeDetected]);

  const checkForNearbyQuakes = useCallback(async (): Promise<NearbyEarthquake | null> => {
    if (!position) return null;

    // Get current radius setting
    const alertRadiusKm = getEarthquakeRadiusKm();

    try {
      const response = await fetch(USGS_FEED_URL);
      const data = await response.json();
      const earthquakes: USGSEarthquake[] = data.features || [];

      // Find earthquakes within radius that we haven't alerted about
      for (const quake of earthquakes) {
        // Skip if already alerted or dismissed
        if (alertedQuakesRef.current.has(quake.id) || dismissedQuakesRef.current.has(quake.id)) {
          continue;
        }

        const [lng, lat] = quake.geometry.coordinates;
        const distanceKm = calculateDistance(position.lat, position.lng, lat, lng);

        if (distanceKm <= alertRadiusKm) {
          // Found a nearby earthquake
          return { earthquake: quake, distanceKm };
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching earthquake data:', error);
      return null;
    }
  }, [position]);

  const checkAndAlert = useCallback(async () => {
    if (!position) return;

    setState(prev => ({ ...prev, loading: true }));

    const nearby = await checkForNearbyQuakes();

    if (nearby) {
      // Mark as alerted so we don't show again - persist to storage
      alertedQuakesRef.current.add(nearby.earthquake.id);
      saveAcknowledgedQuake(nearby.earthquake.id);
      
      // Trigger push notification callback
      if (notifyCallbackRef.current) {
        notifyCallbackRef.current(nearby.earthquake, nearby.distanceKm);
      }
      
      setState({
        nearbyQuake: nearby.earthquake,
        distanceKm: nearby.distanceKm,
        loading: false,
        lastChecked: new Date(),
      });
    } else {
      setState(prev => ({
        ...prev,
        loading: false,
        lastChecked: new Date(),
      }));
    }
  }, [position, checkForNearbyQuakes]);

  // Dismiss current alert - persist to storage so it won't show again
  const dismissAlert = useCallback(() => {
    if (state.nearbyQuake) {
      dismissedQuakesRef.current.add(state.nearbyQuake.id);
      saveAcknowledgedQuake(state.nearbyQuake.id);
      console.log(`[EarthquakeDetection] Dismissed and persisted: ${state.nearbyQuake.id}`);
    }
    setState(prev => ({
      ...prev,
      nearbyQuake: null,
      distanceKm: null,
    }));
  }, [state.nearbyQuake]);

  // Mark as reported (also dismisses)
  const markAsReported = useCallback(() => {
    dismissAlert();
  }, [dismissAlert]);

  // Initial check and periodic monitoring
  useEffect(() => {
    if (!position) return;

    // Initial check
    checkAndAlert();

    // Periodic check
    const interval = setInterval(checkAndAlert, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [position, checkAndAlert]);

  // Force refresh
  const refresh = useCallback(() => {
    checkAndAlert();
  }, [checkAndAlert]);

  return {
    ...state,
    dismissAlert,
    markAsReported,
    refresh,
    alertRadiusKm: getEarthquakeRadiusKm(),
  };
}
