// NOAA Weather Alerts Hook for COMUNIDAD EX SOS
// Fetches hurricane, storm, and severe weather alerts within radius

import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateDistance } from '@/hooks/useLocation';
import type { GeoPosition } from '@/types';

// NOAA Weather API endpoints
const NOAA_ALERTS_API = 'https://api.weather.gov/alerts/active';

export interface NOAAAlert {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';
  certainty: 'Observed' | 'Likely' | 'Possible' | 'Unlikely' | 'Unknown';
  effective: string;
  expires: string;
  senderName: string;
  areaDesc: string;
  distanceMiles: number | null;
  coordinates: [number, number] | null; // [lat, lng]
}

// Severe weather event types to monitor
const SEVERE_EVENTS = [
  'Hurricane',
  'Tropical Storm',
  'Hurricane Warning',
  'Hurricane Watch',
  'Tropical Storm Warning',
  'Tropical Storm Watch',
  'Storm Surge Warning',
  'Storm Surge Watch',
  'Tornado Warning',
  'Tornado Watch',
  'Severe Thunderstorm Warning',
  'Severe Thunderstorm Watch',
  'Flash Flood Warning',
  'Flash Flood Watch',
  'Flood Warning',
  'Flood Watch',
  'Extreme Wind Warning',
  'High Wind Warning',
  'Tsunami Warning',
  'Tsunami Watch',
];

export function useWeatherAlerts(position: GeoPosition | null, radiusMiles: number = 100) {
  const [alerts, setAlerts] = useState<NOAAAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  
  // Use refs for values that change frequently to avoid recreating callbacks
  const positionRef = useRef(position);
  const radiusMilesRef = useRef(radiusMiles);
  
  useEffect(() => {
    positionRef.current = position;
    radiusMilesRef.current = radiusMiles;
  }, [position, radiusMiles]);

  // Parse NOAA alert response - stable callback using ref for radiusMiles
  const parseAlerts = useCallback((data: any, userPosition: GeoPosition): NOAAAlert[] => {
    if (!data?.features) return [];

    const radiusKm = radiusMilesRef.current * 1.60934;

    return data.features
      .map((feature: any) => {
        const props = feature.properties;
        
        // Try to get center point from geometry
        let coordinates: [number, number] | null = null;
        let distanceKm: number | null = null;
        
        if (feature.geometry?.coordinates) {
          // Polygon or MultiPolygon - calculate centroid
          const coords = feature.geometry.coordinates;
          if (feature.geometry.type === 'Polygon' && coords[0]?.length > 0) {
            const ring = coords[0];
            const sumLat = ring.reduce((sum: number, c: number[]) => sum + c[1], 0);
            const sumLng = ring.reduce((sum: number, c: number[]) => sum + c[0], 0);
            coordinates = [sumLat / ring.length, sumLng / ring.length];
          } else if (feature.geometry.type === 'Point') {
            coordinates = [coords[1], coords[0]];
          }
        }

        // Calculate distance if we have coordinates
        if (coordinates && userPosition) {
          distanceKm = calculateDistance(
            userPosition.lat,
            userPosition.lng,
            coordinates[0],
            coordinates[1]
          );
        }

        const alert: NOAAAlert = {
          id: props.id || feature.id,
          event: props.event,
          headline: props.headline,
          description: props.description,
          severity: props.severity,
          urgency: props.urgency,
          certainty: props.certainty,
          effective: props.effective,
          expires: props.expires,
          senderName: props.senderName,
          areaDesc: props.areaDesc,
          distanceMiles: distanceKm ? distanceKm / 1.60934 : null,
          coordinates,
        };

        return alert;
      })
      .filter((alert: NOAAAlert) => {
        // Filter by severe event types
        const isSevere = SEVERE_EVENTS.some(event => 
          alert.event?.toLowerCase().includes(event.toLowerCase())
        );
        
        // Filter by distance (if we have coordinates)
        const isWithinRadius = alert.distanceMiles === null || alert.distanceMiles <= radiusMilesRef.current;
        
        // Filter out expired alerts
        const isActive = new Date(alert.expires) > new Date();
        
        return isSevere && isWithinRadius && isActive;
      })
      .sort((a: NOAAAlert, b: NOAAAlert) => {
        // Sort by severity, then by distance
        const severityOrder = { 'Extreme': 0, 'Severe': 1, 'Moderate': 2, 'Minor': 3, 'Unknown': 4 };
        const aSev = severityOrder[a.severity] ?? 4;
        const bSev = severityOrder[b.severity] ?? 4;
        if (aSev !== bSev) return aSev - bSev;
        
        // Sort by distance
        if (a.distanceMiles !== null && b.distanceMiles !== null) {
          return a.distanceMiles - b.distanceMiles;
        }
        return 0;
      });
  }, []); // No dependencies - uses ref for radiusMiles

  // Fetch alerts from NOAA - stable callback using refs
  const fetchAlerts = useCallback(async () => {
    const currentPosition = positionRef.current;
    if (!currentPosition) return;

    setLoading(true);
    setError(null);

    try {
      // NOAA API allows filtering by point and radius
      const response = await fetch(
        `${NOAA_ALERTS_API}?point=${currentPosition.lat},${currentPosition.lng}&status=actual`,
        {
          headers: {
            'User-Agent': 'COMUNIDAD-EX-SOS-App',
            'Accept': 'application/geo+json',
          },
        }
      );

      if (!response.ok) {
        // Fallback to fetching all active alerts if point query fails
        const fallbackResponse = await fetch(NOAA_ALERTS_API, {
          headers: {
            'User-Agent': 'COMUNIDAD-EX-SOS-App',
            'Accept': 'application/geo+json',
          },
        });
        
        if (!fallbackResponse.ok) {
          throw new Error('Failed to fetch weather alerts');
        }
        
        const data = await fallbackResponse.json();
        const parsed = parseAlerts(data, currentPosition);
        setAlerts(parsed);
      } else {
        const data = await response.json();
        const parsed = parseAlerts(data, currentPosition);
        setAlerts(parsed);
      }

      setLastChecked(new Date());
    } catch (err) {
      console.error('Error fetching weather alerts:', err);
      setError('Error al obtener alertas meteorológicas');
    } finally {
      setLoading(false);
    }
  }, [parseAlerts]); // Only depends on parseAlerts which is stable

  // Initial fetch and refresh interval - runs only once
  useEffect(() => {
    // Initial fetch
    if (positionRef.current) {
      fetchAlerts();
    }
    
    // Refresh every 1 minute
    const interval = setInterval(() => {
      if (positionRef.current) {
        fetchAlerts();
      }
    }, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Get severity color
  const getSeverityColor = (severity: NOAAAlert['severity']) => {
    switch (severity) {
      case 'Extreme': return 'text-destructive bg-destructive/10';
      case 'Severe': return 'text-panic bg-panic/10';
      case 'Moderate': return 'text-warning bg-warning/10';
      case 'Minor': return 'text-muted-foreground bg-muted';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  // Get event icon
  const getEventIcon = (event: string) => {
    const lower = event.toLowerCase();
    if (lower.includes('hurricane') || lower.includes('tropical')) return '🌀';
    if (lower.includes('tornado')) return '🌪️';
    if (lower.includes('flood')) return '🌊';
    if (lower.includes('thunder')) return '⛈️';
    if (lower.includes('wind')) return '💨';
    if (lower.includes('tsunami')) return '🌊';
    return '⚠️';
  };

  return {
    alerts,
    loading,
    error,
    lastChecked,
    refresh: fetchAlerts,
    getSeverityColor,
    getEventIcon,
  };
}
