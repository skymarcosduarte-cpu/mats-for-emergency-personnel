// Hook to fetch Points of Interest from OpenStreetMap Overpass API
// Includes hospitals, gas stations, pharmacies, police, and fire stations

import { useState, useCallback, useRef } from 'react';

export interface POI {
  id: number;
  type: 'hospital' | 'gas_station' | 'pharmacy' | 'police' | 'fire_station';
  name: string;
  lat: number;
  lng: number;
  isPrivate?: boolean; // For hospitals
  tags?: Record<string, string>;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// Cache to avoid refetching same area
const poiCache = new Map<string, POI[]>();

export function usePOIs() {
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastBoundsRef = useRef<string>('');

  const fetchPOIs = useCallback(async (
    bounds: { south: number; west: number; north: number; east: number }
  ) => {
    // Create a cache key based on rounded bounds (to avoid too many requests)
    const roundedBounds = {
      south: Math.floor(bounds.south * 100) / 100,
      west: Math.floor(bounds.west * 100) / 100,
      north: Math.ceil(bounds.north * 100) / 100,
      east: Math.ceil(bounds.east * 100) / 100,
    };
    const cacheKey = `${roundedBounds.south},${roundedBounds.west},${roundedBounds.north},${roundedBounds.east}`;

    // Skip if same bounds
    if (cacheKey === lastBoundsRef.current) return;
    lastBoundsRef.current = cacheKey;

    // Check cache
    if (poiCache.has(cacheKey)) {
      setPois(poiCache.get(cacheKey)!);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Overpass QL query for POIs
      const bbox = `${roundedBounds.south},${roundedBounds.west},${roundedBounds.north},${roundedBounds.east}`;
      
      const query = `
        [out:json][timeout:25];
        (
          // Hospitals
          node["amenity"="hospital"](${bbox});
          way["amenity"="hospital"](${bbox});
          node["amenity"="clinic"](${bbox});
          way["amenity"="clinic"](${bbox});
          
          // Gas stations
          node["amenity"="fuel"](${bbox});
          way["amenity"="fuel"](${bbox});
          
          // Pharmacies
          node["amenity"="pharmacy"](${bbox});
          way["amenity"="pharmacy"](${bbox});
          
          // Police stations
          node["amenity"="police"](${bbox});
          way["amenity"="police"](${bbox});
          
          // Fire stations
          node["amenity"="fire_station"](${bbox});
          way["amenity"="fire_station"](${bbox});
        );
        out center;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error('Error fetching POIs');
      }

      const data = await response.json();
      const elements: OverpassElement[] = data.elements || [];

      const parsedPOIs: POI[] = elements
        .filter(el => el.lat || el.center)
        .map(el => {
          const lat = el.lat ?? el.center?.lat ?? 0;
          const lng = el.lon ?? el.center?.lon ?? 0;
          const tags = el.tags || {};
          const amenity = tags.amenity;
          
          let type: POI['type'];
          let isPrivate = false;

          switch (amenity) {
            case 'hospital':
            case 'clinic':
              type = 'hospital';
              // Check if private (operator or access tags)
              isPrivate = tags.operator?.toLowerCase().includes('privad') ||
                         tags.access === 'private' ||
                         tags['healthcare:speciality'] !== undefined ||
                         tags.operator_type === 'private';
              break;
            case 'fuel':
              type = 'gas_station';
              break;
            case 'pharmacy':
              type = 'pharmacy';
              break;
            case 'police':
              type = 'police';
              break;
            case 'fire_station':
              type = 'fire_station';
              break;
            default:
              return null;
          }

          return {
            id: el.id,
            type,
            name: tags.name || getDefaultName(type, isPrivate),
            lat,
            lng,
            isPrivate,
            tags,
          };
        })
        .filter(Boolean) as POI[];

      // Cache the results
      poiCache.set(cacheKey, parsedPOIs);
      setPois(parsedPOIs);
    } catch (err) {
      console.error('[usePOIs] Error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearPOIs = useCallback(() => {
    setPois([]);
    lastBoundsRef.current = '';
  }, []);

  return { pois, loading, error, fetchPOIs, clearPOIs };
}

function getDefaultName(type: POI['type'], isPrivate?: boolean): string {
  switch (type) {
    case 'hospital':
      return isPrivate ? 'Hospital Privado' : 'Hospital';
    case 'gas_station':
      return 'Gasolinera';
    case 'pharmacy':
      return 'Farmacia';
    case 'police':
      return 'Estación de Policía';
    case 'fire_station':
      return 'Estación de Bomberos';
    default:
      return 'Punto de Interés';
  }
}
