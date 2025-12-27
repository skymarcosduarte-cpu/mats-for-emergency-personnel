// Earthquake History Hook for COMUNIDAD SOS
// Fetches and caches earthquake data from USGS and SSN (Mexico) with distance calculations

import { useState, useEffect, useCallback } from 'react';
import type { USGSEarthquake, GeoPosition } from '@/types';
import { calculateDistance } from '@/hooks/useLocation';
import { cacheEarthquakes, getCachedEarthquakes, isEarthquakeCacheFresh, updateLastSync } from '@/lib/offlineDataCache';

const USGS_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const SSN_FEED_URL = 'http://www.ssn.unam.mx/rss/ultimos-sismos.xml';

export interface EarthquakeWithDistance extends USGSEarthquake {
  distanceKm: number | null;
  distanceMiles: number | null;
}

// Parse SSN RSS feed and convert to USGSEarthquake format
async function parseSSNFeed(): Promise<USGSEarthquake[]> {
  try {
    const response = await fetch(SSN_FEED_URL);
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    const items = xml.querySelectorAll('item');
    const earthquakes: USGSEarthquake[] = [];
    
    items.forEach((item, index) => {
      try {
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const lat = parseFloat(item.getElementsByTagNameNS('http://www.w3.org/2003/01/geo/wgs84_pos#', 'lat')[0]?.textContent || '0');
        const lng = parseFloat(item.getElementsByTagNameNS('http://www.w3.org/2003/01/geo/wgs84_pos#', 'long')[0]?.textContent || '0');
        
        // Parse magnitude from title (e.g., "3.1, 14 km al SUROESTE de ZIHUATANEJO, GRO")
        const magMatch = title.match(/^([\d.]+)/);
        const mag = magMatch ? parseFloat(magMatch[1]) : 0;
        
        // Parse date and depth from description
        // Format: "Fecha:2025-12-26 15:47:43 (Hora de México)<br>Lat/Lon: 17.527/-101.59<br>Profundidad: 19.9 km"
        const dateMatch = description.match(/Fecha:(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
        const depthMatch = description.match(/Profundidad:\s*([\d.]+)\s*km/);
        
        let timestamp = Date.now();
        if (dateMatch) {
          // SSN uses Mexico City time (UTC-6)
          const mexicoTime = new Date(dateMatch[1].replace(' ', 'T') + '-06:00');
          timestamp = mexicoTime.getTime();
        }
        
        const depth = depthMatch ? parseFloat(depthMatch[1]) : 10;
        
        // Clean up place name
        const placeMatch = title.match(/,\s*(.+)/);
        const place = placeMatch ? placeMatch[1].trim() : title;
        
        earthquakes.push({
          id: `ssn-${timestamp}-${index}`,
          source: 'SSN',
          properties: {
            mag,
            place,
            time: timestamp,
            updated: timestamp,
            url: 'http://www.ssn.unam.mx/',
            title: `M ${mag} - ${place}`,
            alert: null,
            tsunami: 0,
            depth,
          },
          geometry: {
            coordinates: [lng, lat, depth],
          },
        });
      } catch (e) {
        console.warn('Error parsing SSN earthquake item:', e);
      }
    });
    
    return earthquakes;
  } catch (error) {
    console.error('Error fetching SSN feed:', error);
    return [];
  }
}

export function useEarthquakeHistory(userPosition: GeoPosition | null) {
  const [earthquakes, setEarthquakes] = useState<EarthquakeWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rawEarthquakes, setRawEarthquakes] = useState<USGSEarthquake[]>([]);

  // Calculate distance for each earthquake
  const addDistances = useCallback((quakes: USGSEarthquake[], pos: GeoPosition | null): EarthquakeWithDistance[] => {
    return quakes.map(quake => {
      let distanceKm: number | null = null;
      let distanceMiles: number | null = null;

      if (pos) {
        const [lng, lat] = quake.geometry.coordinates;
        distanceKm = calculateDistance(pos.lat, pos.lng, lat, lng);
        distanceMiles = distanceKm / 1.60934;
      }

      return {
        ...quake,
        distanceKm,
        distanceMiles,
      };
    });
  }, []);

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
  const fetchFromUSGS = useCallback(async (): Promise<USGSEarthquake[]> => {
    const response = await fetch(USGS_FEED_URL);
    if (!response.ok) throw new Error('Failed to fetch USGS earthquakes');
    const data = await response.json();
    return (data.features || []).map((q: USGSEarthquake) => ({ ...q, source: 'USGS' as const }));
  }, []);

  // Main fetch function - fetches from both USGS and SSN
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
          // Fetch fresh data from both sources in parallel
          const [usgsQuakes, ssnQuakes] = await Promise.all([
            fetchFromUSGS().catch(err => {
              console.warn('Error fetching USGS:', err);
              return [] as USGSEarthquake[];
            }),
            parseSSNFeed().catch(err => {
              console.warn('Error fetching SSN:', err);
              return [] as USGSEarthquake[];
            }),
          ]);
          
          // Merge and deduplicate (SSN quakes are prioritized for Mexico region)
          quakes = [...usgsQuakes, ...ssnQuakes];
          
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

      // Store raw earthquakes, distances will be calculated separately
      setRawEarthquakes(quakes);
    } catch (err) {
      console.error('Error fetching earthquakes:', err);
      
      // Try to use cache as fallback
      try {
        const cached = await getCachedEarthquakes();
        if (cached.data.length > 0) {
          setRawEarthquakes(cached.data);
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
  }, [fetchFromUSGS]);

  // Initial fetch and set up refresh interval (only runs once)
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

  // Re-calculate distances when user position or raw earthquakes change
  useEffect(() => {
    if (rawEarthquakes.length > 0) {
      const withDistances = addDistances(rawEarthquakes, userPosition);
      const sorted = sortEarthquakes(withDistances);
      setEarthquakes(sorted);
    }
  }, [userPosition, rawEarthquakes, addDistances, sortEarthquakes]);

  return {
    earthquakes,
    loading,
    error,
    isOffline,
    lastUpdated,
    refresh: () => fetchEarthquakes(true),
  };
}
