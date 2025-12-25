// Mexico Federal Alerts Hook for COMUNIDAD EX SOS
// Integrates NHC tropical cyclones (Atlantic/Pacific) and NASA FIRMS fire hotspots

import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateDistance } from '@/hooks/useLocation';
import type { GeoPosition } from '@/types';

// NHC RSS Feed URLs for tropical cyclones affecting Mexico
const NHC_ATLANTIC_FEED = 'https://www.nhc.noaa.gov/index-at.xml';
const NHC_PACIFIC_FEED = 'https://www.nhc.noaa.gov/index-ep.xml';

// NASA FIRMS API for fire hotspots (free, no API key required for low volume)
const NASA_FIRMS_URL = 'https://firms.modaps.eosdis.nasa.gov/api/country/csv/VIIRS_SNPP_NRT/MEX/1';

export interface TropicalCycloneAlert {
  id: string;
  type: 'hurricane' | 'tropical_storm' | 'tropical_depression' | 'disturbance';
  name: string;
  headline: string;
  description: string;
  basin: 'atlantic' | 'pacific';
  category?: number;
  windSpeed?: number;
  movement?: string;
  pressure?: number;
  coordinates?: [number, number]; // [lat, lng]
  distanceKm?: number;
  pubDate: string;
  link: string;
}

export interface FireHotspot {
  id: string;
  lat: number;
  lng: number;
  brightness: number;
  confidence: 'low' | 'nominal' | 'high';
  frp: number; // Fire Radiative Power
  satellite: string;
  acqDate: string;
  acqTime: string;
  distanceKm?: number;
}

export interface MexicoAlertsState {
  cyclones: TropicalCycloneAlert[];
  fires: FireHotspot[];
  loading: boolean;
  error: string | null;
  lastChecked: Date | null;
}

// Parse NHC RSS feed
async function parseNHCFeed(feedUrl: string, basin: 'atlantic' | 'pacific'): Promise<TropicalCycloneAlert[]> {
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) return [];
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    const items = xml.querySelectorAll('item');
    const alerts: TropicalCycloneAlert[] = [];
    
    items.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      
      // Parse storm type from title
      let type: TropicalCycloneAlert['type'] = 'disturbance';
      let category: number | undefined;
      
      const titleLower = title.toLowerCase();
      if (titleLower.includes('hurricane')) {
        type = 'hurricane';
        // Try to extract category
        const catMatch = title.match(/category\s*(\d)/i);
        if (catMatch) category = parseInt(catMatch[1]);
      } else if (titleLower.includes('tropical storm')) {
        type = 'tropical_storm';
      } else if (titleLower.includes('tropical depression')) {
        type = 'tropical_depression';
      }
      
      // Extract storm name
      const nameMatch = title.match(/(?:Hurricane|Tropical Storm|Tropical Depression)\s+([A-Za-z]+)/i);
      const name = nameMatch ? nameMatch[1] : title.split(' ')[0];
      
      // Try to extract coordinates from description
      let coordinates: [number, number] | undefined;
      const coordMatch = description.match(/(\d+\.?\d*)\s*([NS])\s+(\d+\.?\d*)\s*([EW])/i);
      if (coordMatch) {
        let lat = parseFloat(coordMatch[1]);
        let lng = parseFloat(coordMatch[3]);
        if (coordMatch[2].toUpperCase() === 'S') lat = -lat;
        if (coordMatch[4].toUpperCase() === 'W') lng = -lng;
        coordinates = [lat, lng];
      }
      
      // Extract wind speed
      const windMatch = description.match(/(\d+)\s*mph/i);
      const windSpeed = windMatch ? parseInt(windMatch[1]) : undefined;
      
      alerts.push({
        id: `nhc-${basin}-${index}-${Date.now()}`,
        type,
        name,
        headline: title,
        description: description.replace(/<[^>]*>/g, '').trim(),
        basin,
        category,
        windSpeed,
        coordinates,
        pubDate,
        link,
      });
    });
    
    return alerts;
  } catch (error) {
    console.error(`Error fetching NHC ${basin} feed:`, error);
    return [];
  }
}

// Parse NASA FIRMS fire data
async function parseFireData(): Promise<FireHotspot[]> {
  try {
    // NASA FIRMS provides CSV data for Mexico's fire hotspots in the last 24 hours
    const response = await fetch(NASA_FIRMS_URL);
    if (!response.ok) return [];
    
    const text = await response.text();
    const lines = text.trim().split('\n');
    
    if (lines.length <= 1) return []; // Only header or empty
    
    const hotspots: FireHotspot[] = [];
    
    // Skip header line
    for (let i = 1; i < lines.length && i <= 100; i++) { // Limit to 100 hotspots
      const cols = lines[i].split(',');
      if (cols.length < 10) continue;
      
      const lat = parseFloat(cols[0]);
      const lng = parseFloat(cols[1]);
      const brightness = parseFloat(cols[2]);
      const acqDate = cols[5];
      const acqTime = cols[6];
      const satellite = cols[7];
      const confidence = cols[8]?.toLowerCase() as 'low' | 'nominal' | 'high' || 'nominal';
      const frp = parseFloat(cols[11]) || 0;
      
      if (isNaN(lat) || isNaN(lng)) continue;
      
      hotspots.push({
        id: `fire-${i}-${lat}-${lng}`,
        lat,
        lng,
        brightness,
        confidence,
        frp,
        satellite,
        acqDate,
        acqTime,
      });
    }
    
    return hotspots;
  } catch (error) {
    console.error('Error fetching fire data:', error);
    return [];
  }
}

interface UseMexicoAlertsOptions {
  onNewCyclone?: (cyclone: TropicalCycloneAlert) => void;
  onNewFires?: (fires: FireHotspot[], nearestDistance: number) => void;
}

export function useMexicoAlerts(
  position: GeoPosition | null, 
  radiusKm: number = 500,
  options: UseMexicoAlertsOptions = {}
) {
  const [state, setState] = useState<MexicoAlertsState>({
    cyclones: [],
    fires: [],
    loading: false,
    error: null,
    lastChecked: null,
  });

  // Track previously seen alert IDs to detect new ones
  const seenCycloneIds = useRef<Set<string>>(new Set());
  const seenFireIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  const fetchAlerts = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch tropical cyclones from both basins
      const [atlanticCyclones, pacificCyclones, fires] = await Promise.all([
        parseNHCFeed(NHC_ATLANTIC_FEED, 'atlantic'),
        parseNHCFeed(NHC_PACIFIC_FEED, 'pacific'),
        parseFireData(),
      ]);

      // Combine cyclones
      let allCyclones = [...atlanticCyclones, ...pacificCyclones];

      // Calculate distances if we have user position
      if (position) {
        allCyclones = allCyclones.map(cyclone => {
          if (cyclone.coordinates) {
            const distanceKm = calculateDistance(
              position.lat,
              position.lng,
              cyclone.coordinates[0],
              cyclone.coordinates[1]
            );
            return { ...cyclone, distanceKm };
          }
          return cyclone;
        });

        // Filter by radius
        allCyclones = allCyclones.filter(c => !c.distanceKm || c.distanceKm <= radiusKm);
      }

      // Process fire hotspots with distance
      let processedFires = fires;
      if (position) {
        processedFires = fires.map(fire => ({
          ...fire,
          distanceKm: calculateDistance(position.lat, position.lng, fire.lat, fire.lng),
        }));

        // Filter by radius (100km for fires - they're more localized)
        processedFires = processedFires.filter(f => !f.distanceKm || f.distanceKm <= 100);
        
        // Sort by distance
        processedFires.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
      }

      // Sort cyclones by type severity then distance
      const typeOrder = { hurricane: 0, tropical_storm: 1, tropical_depression: 2, disturbance: 3 };
      allCyclones.sort((a, b) => {
        const typeCompare = typeOrder[a.type] - typeOrder[b.type];
        if (typeCompare !== 0) return typeCompare;
        return (a.distanceKm || Infinity) - (b.distanceKm || Infinity);
      });

      const limitedFires = processedFires.slice(0, 20);

      // Check for new alerts (skip on first load to avoid notification spam)
      if (!isFirstLoad.current) {
        // Check for new cyclones
        for (const cyclone of allCyclones) {
          // Use a stable ID based on name and basin
          const stableId = `${cyclone.basin}-${cyclone.name.toLowerCase()}`;
          if (!seenCycloneIds.current.has(stableId)) {
            seenCycloneIds.current.add(stableId);
            options.onNewCyclone?.(cyclone);
          }
        }

        // Check for new nearby fires
        const newFires = limitedFires.filter(fire => !seenFireIds.current.has(fire.id));
        if (newFires.length > 0) {
          const nearestDistance = Math.min(...newFires.map(f => f.distanceKm || Infinity));
          if (nearestDistance < 100) { // Only notify for fires within 100km
            options.onNewFires?.(newFires, nearestDistance);
          }
        }
      }

      // Update seen IDs
      allCyclones.forEach(c => {
        const stableId = `${c.basin}-${c.name.toLowerCase()}`;
        seenCycloneIds.current.add(stableId);
      });
      limitedFires.forEach(f => seenFireIds.current.add(f.id));
      isFirstLoad.current = false;

      setState({
        cyclones: allCyclones,
        fires: limitedFires,
        loading: false,
        error: null,
        lastChecked: new Date(),
      });
    } catch (error) {
      console.error('Error fetching Mexico alerts:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Error al obtener alertas de México',
      }));
    }
  }, [position, radiusKm, options]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchAlerts();

    // Refresh every 1 minute
    const interval = setInterval(fetchAlerts, 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Helper functions
  const getCycloneIcon = (type: TropicalCycloneAlert['type']) => {
    switch (type) {
      case 'hurricane': return '🌀';
      case 'tropical_storm': return '🌀';
      case 'tropical_depression': return '🌧️';
      default: return '⚠️';
    }
  };

  const getCycloneSeverityColor = (type: TropicalCycloneAlert['type'], category?: number) => {
    if (type === 'hurricane') {
      if (category && category >= 3) return 'text-destructive bg-destructive/10';
      return 'text-panic bg-panic/10';
    }
    if (type === 'tropical_storm') return 'text-warning bg-warning/10';
    return 'text-muted-foreground bg-muted';
  };

  const getFireConfidenceColor = (confidence: FireHotspot['confidence']) => {
    switch (confidence) {
      case 'high': return 'text-destructive bg-destructive/10';
      case 'nominal': return 'text-warning bg-warning/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return {
    ...state,
    refresh: fetchAlerts,
    getCycloneIcon,
    getCycloneSeverityColor,
    getFireConfidenceColor,
  };
}
