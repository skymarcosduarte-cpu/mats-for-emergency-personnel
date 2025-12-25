// Earthquake History Hook for COMUNIDAD EX SOS
// Fetches and caches earthquake data with distance calculations

import { useState, useEffect, useCallback } from 'react';
import type { USGSEarthquake, GeoPosition } from '@/types';
import { calculateDistance } from '@/hooks/useLocation';
import { cacheEarthquakes, getCachedEarthquakes, isEarthquakeCacheFresh, updateLastSync } from '@/lib/offlineDataCache';

const USGS_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

export interface EarthquakeWithDistance extends USGSEarthquake {
  distanceKm: number | null;
  distanceMiles: number | null;
}

export function useEarthquakeHistory(userPosition: GeoPosition | null) {
  const [earthquakes, setEarthquakes] = useState<EarthquakeWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Calculate distance for each earthquake
  const addDistances = useCallback((quakes: USGSEarthquake[]): EarthquakeWithDistance[] => {
    return quakes.map(quake => {
      let distanceKm: number | null = null;
      let distanceMiles: number | null = null;

      if (userPosition) {
        const [lng, lat] = quake.geometry.coordinates;
        distanceKm = calculateDistance(userPosition.lat, userPosition.lng, lat, lng);
        distanceMiles = distanceKm / 1.60934;
      }

      return {
        ...quake,
        distanceKm,
        distanceMiles,
      };
    });
  }, [userPosition]);

  // Sort by distance (nearest first) or by time if no position
  const sortEarthquakes = useCallback((quakes: EarthquakeWithDistance[]): EarthquakeWithDistance[] => {
    return [...quakes].sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      // Sort by time if no distance available
      return b.properties.time - a.properties.time;
    });
  }, []);

  // Fetch from USGS API
  const fetchFromApi = useCallback(async (): Promise<USGSEarthquake[]> => {
    const response = await fetch(USGS_FEED_URL);
    if (!response.ok) throw new Error('Failed to fetch earthquakes');
    const data = await response.json();
    return data.features;
  }, []);

  // Main fetch function
  const fetchEarthquakes = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      let quakes: USGSEarthquake[] = [];
      
      // Check if online and cache is fresh
      if (navigator.onLine) {
        const isFresh = await isEarthquakeCacheFresh();
        
        if (!forceRefresh && isFresh) {
          // Use cached data
          const cached = await getCachedEarthquakes();
          quakes = cached.data;
          if (cached.cachedAt) {
            setLastUpdated(new Date(cached.cachedAt));
          }
        } else {
          // Fetch fresh data
          quakes = await fetchFromApi();
          await cacheEarthquakes(quakes);
          await updateLastSync();
          setLastUpdated(new Date());
        }
        setIsOffline(false);
      } else {
        // Offline - use cache
        const cached = await getCachedEarthquakes();
        quakes = cached.data;
        setIsOffline(true);
        if (cached.cachedAt) {
          setLastUpdated(new Date(cached.cachedAt));
        }
      }

      const withDistances = addDistances(quakes);
      const sorted = sortEarthquakes(withDistances);
      setEarthquakes(sorted);
    } catch (err) {
      console.error('Error fetching earthquakes:', err);
      
      // Try to use cache as fallback
      try {
        const cached = await getCachedEarthquakes();
        if (cached.data.length > 0) {
          const withDistances = addDistances(cached.data);
          const sorted = sortEarthquakes(withDistances);
          setEarthquakes(sorted);
          setIsOffline(true);
          if (cached.cachedAt) {
            setLastUpdated(new Date(cached.cachedAt));
          }
        } else {
          setError('No se pudieron cargar los datos de sismos');
        }
      } catch {
        setError('No se pudieron cargar los datos de sismos');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFromApi, addDistances, sortEarthquakes]);

  // Initial fetch and set up refresh interval
  useEffect(() => {
    fetchEarthquakes();

    // Refresh every 5 minutes when online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        fetchEarthquakes();
      }
    }, 5 * 60 * 1000);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOffline(false);
      fetchEarthquakes();
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchEarthquakes]);

  // Re-calculate distances when user position changes
  useEffect(() => {
    if (earthquakes.length > 0) {
      const withDistances = addDistances(earthquakes);
      const sorted = sortEarthquakes(withDistances);
      setEarthquakes(sorted);
    }
  }, [userPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    earthquakes,
    loading,
    error,
    isOffline,
    lastUpdated,
    refresh: () => fetchEarthquakes(true),
  };
}
