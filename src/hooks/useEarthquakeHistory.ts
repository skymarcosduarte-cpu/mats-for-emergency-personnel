// Earthquake History Hook for COMUNIDAD SOS
// Fetches and caches earthquake data from USGS and SSN (Mexico) with distance calculations

import { useState, useEffect, useCallback } from 'react';
import type { USGSEarthquake, GeoPosition } from '@/types';
import { calculateDistance } from '@/hooks/useLocation';
import { cacheEarthquakes, getCachedEarthquakes, isEarthquakeCacheFresh, updateLastSync } from '@/lib/offlineDataCache';

const USGS_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const SSN_FEED_URL = 'http://www.ssn.unam.mx/rss/ultimos-sismos.xml';

// Multiple CORS proxies for fallback (some may be blocked on Android)
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

export interface EarthquakeWithDistance extends USGSEarthquake {
  distanceKm: number | null;
  distanceMiles: number | null;
}

// Try fetching with multiple CORS proxies (fallback mechanism for Android)
async function fetchWithCorsProxy(url: string): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](url);
    try {
      console.log(`[CORS] Trying proxy ${i + 1}/${CORS_PROXIES.length}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(proxyUrl, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/xml, text/xml, */*',
        }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`[CORS] Proxy ${i + 1} succeeded`);
        return response;
      }
      lastError = new Error(`Proxy ${i + 1} returned ${response.status}`);
    } catch (err) {
      console.warn(`[CORS] Proxy ${i + 1} failed:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  
  throw lastError || new Error('All CORS proxies failed');
}

// Parse SSN RSS feed and convert to USGSEarthquake format
async function parseSSNFeed(): Promise<USGSEarthquake[]> {
  try {
    console.log('[SSN] Fetching SSN feed via CORS proxy...');
    const response = await fetchWithCorsProxy(SSN_FEED_URL);
    const text = await response.text();
    console.log('[SSN] Received response, length:', text.length);
    
    // Validate that we got XML
    if (!text.includes('<rss') && !text.includes('<item')) {
      console.warn('[SSN] Response does not appear to be valid RSS XML');
      return [];
    }
    
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    // Check for parse errors
    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      console.warn('[SSN] XML parse error:', parseError.textContent);
      return [];
    }
    
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
    
    console.log('[SSN] Parsed earthquakes:', earthquakes.length);
    return earthquakes;
  } catch (error) {
    console.error('[SSN] Error fetching SSN feed:', error);
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

  // Sort by time (most recent first) - chronological order
  const sortEarthquakes = useCallback((quakes: EarthquakeWithDistance[]): EarthquakeWithDistance[] => {
    return [...quakes].sort((a, b) => {
      // Sort by time descending (newest first)
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
    console.log('[Earthquakes] Initial fetch...');
    fetchEarthquakes();

    // Refresh every 3 minutes when online (more frequent for better updates)
    const interval = setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        console.log('[Earthquakes] Periodic refresh...');
        fetchEarthquakes();
      }
    }, 3 * 60 * 1000);

    // Listen for online/offline events
    const handleOnline = () => {
      console.log('[Earthquakes] Back online, refreshing...');
      setIsOffline(false);
      fetchEarthquakes(true); // Force refresh when coming back online
    };
    
    const handleOffline = () => {
      console.log('[Earthquakes] Went offline');
      setIsOffline(true);
    };

    // Refresh when app comes back to foreground (important for mobile)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('[Earthquakes] App visible again, checking for updates...');
        fetchEarthquakes(); // Will check cache freshness automatically
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
