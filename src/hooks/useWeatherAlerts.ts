// NOAA Weather Alerts Hook for COMUNIDAD EX SOS
// Fetches hurricane, storm, and severe weather alerts from multiple NOAA sources

import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateDistance } from '@/hooks/useLocation';
import type { GeoPosition } from '@/types';

// NOAA Weather API endpoints
const NOAA_ALERTS_API = 'https://api.weather.gov/alerts/active';

// NHC RSS feeds
const NHC_FEEDS = [
  { url: 'https://www.nhc.noaa.gov/index-at.xml', basin: 'Atlantic' },
  { url: 'https://www.nhc.noaa.gov/index-ep.xml', basin: 'Eastern Pacific' },
  { url: 'https://www.nhc.noaa.gov/nhc_at_rss.xml', basin: 'Atlantic RSS' },
  { url: 'https://www.nhc.noaa.gov/nhc_ep_rss.xml', basin: 'Eastern Pacific RSS' },
];

// Mexico weather alerts
const MEXICO_ALERTS_URL = 'https://alerts.weather.gov/cap/mx.php?x=0';

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
  distanceKm: number | null;
  coordinates: [number, number] | null; // [lat, lng]
  source: 'NOAA' | 'NHC' | 'Mexico';
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
  'Tropical Depression',
  'Post-Tropical Cyclone',
  'Potential Tropical Cyclone',
  'Subtropical Storm',
  'Subtropical Depression',
];

// Parse NHC RSS feed
async function parseNHCFeed(feedUrl: string, basin: string): Promise<NOAAAlert[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'Accept': 'application/xml, text/xml, */*',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch NHC feed ${basin}:`, response.status);
      return [];
    }
    
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    
    const items = doc.querySelectorAll('item');
    const alerts: NOAAAlert[] = [];
    
    items.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const guid = item.querySelector('guid')?.textContent || `nhc-${basin}-${index}`;
      
      // Skip non-storm items
      const isStormRelated = SEVERE_EVENTS.some(event => 
        title.toLowerCase().includes(event.toLowerCase()) ||
        description.toLowerCase().includes(event.toLowerCase())
      );
      
      // Also include items with common storm keywords
      const hasStormKeywords = /hurricane|tropical|storm|cyclone|warning|watch|advisory/i.test(title + description);
      
      if (!isStormRelated && !hasStormKeywords) return;
      
      // Determine severity based on content
      let severity: NOAAAlert['severity'] = 'Moderate';
      if (/category\s*[45]|major hurricane|extreme/i.test(title + description)) {
        severity = 'Extreme';
      } else if (/category\s*[23]|hurricane warning|severe/i.test(title + description)) {
        severity = 'Severe';
      } else if (/watch|advisory/i.test(title + description)) {
        severity = 'Minor';
      }
      
      // Try to extract coordinates from description (NHC often includes lat/lon)
      let coordinates: [number, number] | null = null;
      const coordMatch = description.match(/(\d+\.?\d*)\s*N[,\s]+(\d+\.?\d*)\s*W/i);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = -parseFloat(coordMatch[2]); // West longitude is negative
        coordinates = [lat, lng];
      }
      
      alerts.push({
        id: guid,
        event: title.split(' - ')[0] || title,
        headline: title,
        description: description.replace(/<[^>]*>/g, ''), // Strip HTML tags
        severity,
        urgency: 'Expected',
        certainty: 'Likely',
        effective: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        senderName: `NHC - ${basin}`,
        areaDesc: basin,
        distanceKm: null,
        coordinates,
        source: 'NHC',
      });
    });
    
    return alerts;
  } catch (error) {
    console.warn(`Error parsing NHC feed ${basin}:`, error);
    return [];
  }
}

// Parse Mexico CAP alerts
async function parseMexicoAlerts(): Promise<NOAAAlert[]> {
  try {
    const response = await fetch(MEXICO_ALERTS_URL, {
      headers: {
        'Accept': 'application/xml, text/xml, */*',
      },
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch Mexico alerts:', response.status);
      return [];
    }
    
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    
    const entries = doc.querySelectorAll('entry, alert');
    const alerts: NOAAAlert[] = [];
    
    entries.forEach((entry, index) => {
      const title = entry.querySelector('title, headline')?.textContent || '';
      const summary = entry.querySelector('summary, description')?.textContent || '';
      const updated = entry.querySelector('updated, sent')?.textContent || '';
      const expires = entry.querySelector('expires')?.textContent || '';
      const id = entry.querySelector('id')?.textContent || `mx-${index}`;
      const severity = entry.querySelector('severity')?.textContent as NOAAAlert['severity'] || 'Moderate';
      const urgency = entry.querySelector('urgency')?.textContent as NOAAAlert['urgency'] || 'Expected';
      const certainty = entry.querySelector('certainty')?.textContent as NOAAAlert['certainty'] || 'Likely';
      const areaDesc = entry.querySelector('areaDesc')?.textContent || 'México';
      
      // Skip if no meaningful content
      if (!title && !summary) return;
      
      alerts.push({
        id,
        event: title,
        headline: title,
        description: summary,
        severity: severity || 'Moderate',
        urgency: urgency || 'Expected',
        certainty: certainty || 'Likely',
        effective: updated ? new Date(updated).toISOString() : new Date().toISOString(),
        expires: expires ? new Date(expires).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        senderName: 'SMN México',
        areaDesc,
        distanceKm: null,
        coordinates: null,
        source: 'Mexico',
      });
    });
    
    return alerts;
  } catch (error) {
    console.warn('Error parsing Mexico alerts:', error);
    return [];
  }
}

export function useWeatherAlerts(position: GeoPosition | null, radiusKm: number = 160) {
  const [alerts, setAlerts] = useState<NOAAAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  
  // Use refs for values that change frequently to avoid recreating callbacks
  const positionRef = useRef(position);
  const radiusKmRef = useRef(radiusKm);
  
  useEffect(() => {
    positionRef.current = position;
    radiusKmRef.current = radiusKm;
  }, [position, radiusKm]);

  // Parse NOAA alert response - stable callback using ref for radiusKm
  const parseNOAAAlerts = useCallback((data: any, userPosition: GeoPosition): NOAAAlert[] => {
    if (!data?.features) return [];

    const radiusKm = radiusKmRef.current;

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
          distanceKm: distanceKm ?? null,
          coordinates,
          source: 'NOAA',
        };

        return alert;
      })
      .filter((alert: NOAAAlert) => {
        // Filter by severe event types
        const isSevere = SEVERE_EVENTS.some(event => 
          alert.event?.toLowerCase().includes(event.toLowerCase())
        );
        
        // Filter by distance (if we have coordinates)
        const isWithinRadius = alert.distanceKm === null || alert.distanceKm <= radiusKmRef.current;
        
        // Filter out expired alerts
        const isActive = new Date(alert.expires) > new Date();
        
        return isSevere && isWithinRadius && isActive;
      });
  }, []); // No dependencies - uses ref for radiusKm

  // Calculate distance for alerts that have coordinates
  const addDistanceToAlerts = useCallback((alertsList: NOAAAlert[], userPosition: GeoPosition): NOAAAlert[] => {
    return alertsList.map(alert => {
      if (alert.coordinates && userPosition) {
        const distanceKm = calculateDistance(
          userPosition.lat,
          userPosition.lng,
          alert.coordinates[0],
          alert.coordinates[1]
        );
        return {
          ...alert,
          distanceKm,
        };
      }
      return alert;
    });
  }, []);

  // Fetch alerts from all sources - stable callback using refs
  const fetchAlerts = useCallback(async () => {
    const currentPosition = positionRef.current;
    
    setLoading(true);
    setError(null);

    try {
      const allAlerts: NOAAAlert[] = [];

      // Fetch NOAA alerts (only if we have position)
      if (currentPosition) {
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

          if (response.ok) {
            const data = await response.json();
            const parsed = parseNOAAAlerts(data, currentPosition);
            allAlerts.push(...parsed);
          } else {
            // Fallback to fetching all active alerts if point query fails
            const fallbackResponse = await fetch(NOAA_ALERTS_API, {
              headers: {
                'User-Agent': 'COMUNIDAD-EX-SOS-App',
                'Accept': 'application/geo+json',
              },
            });
            
            if (fallbackResponse.ok) {
              const data = await fallbackResponse.json();
              const parsed = parseNOAAAlerts(data, currentPosition);
              allAlerts.push(...parsed);
            }
          }
        } catch (noaaError) {
          console.warn('Error fetching NOAA alerts:', noaaError);
        }
      }

      // Fetch NHC feeds in parallel
      const nhcPromises = NHC_FEEDS.map(feed => parseNHCFeed(feed.url, feed.basin));
      const nhcResults = await Promise.allSettled(nhcPromises);
      
      nhcResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          let nhcAlerts = result.value;
          // Add distance if we have position
          if (currentPosition) {
            nhcAlerts = addDistanceToAlerts(nhcAlerts, currentPosition);
          }
          allAlerts.push(...nhcAlerts);
        }
      });

      // Fetch Mexico alerts
      try {
        let mexicoAlerts = await parseMexicoAlerts();
        if (currentPosition && mexicoAlerts.length > 0) {
          mexicoAlerts = addDistanceToAlerts(mexicoAlerts, currentPosition);
        }
        allAlerts.push(...mexicoAlerts);
      } catch (mxError) {
        console.warn('Error fetching Mexico alerts:', mxError);
      }

      // Deduplicate by ID and sort
      const uniqueAlerts = Array.from(
        new Map(allAlerts.map(a => [a.id, a])).values()
      );

      // Sort by severity, then by distance
      const sortedAlerts = uniqueAlerts.sort((a, b) => {
        const severityOrder = { 'Extreme': 0, 'Severe': 1, 'Moderate': 2, 'Minor': 3, 'Unknown': 4 };
        const aSev = severityOrder[a.severity] ?? 4;
        const bSev = severityOrder[b.severity] ?? 4;
        if (aSev !== bSev) return aSev - bSev;
        
        // Sort by distance
        if (a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        return 0;
      });

      setAlerts(sortedAlerts);
      setLastChecked(new Date());
    } catch (err) {
      console.error('Error fetching weather alerts:', err);
      setError('Error al obtener alertas meteorológicas');
    } finally {
      setLoading(false);
    }
  }, [parseNOAAAlerts, addDistanceToAlerts]);

  // Initial fetch and refresh interval - runs only once
  useEffect(() => {
    // Initial fetch (don't require position - NHC and Mexico feeds work globally)
    fetchAlerts();
    
    // Refresh every 1 minute
    const interval = setInterval(() => {
      fetchAlerts();
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

  // Get source badge color
  const getSourceColor = (source: NOAAAlert['source']) => {
    switch (source) {
      case 'NOAA': return 'bg-primary/10 text-primary';
      case 'NHC': return 'bg-warning/10 text-warning';
      case 'Mexico': return 'bg-success/10 text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return {
    alerts,
    loading,
    error,
    lastChecked,
    refresh: fetchAlerts,
    getSeverityColor,
    getEventIcon,
    getSourceColor,
  };
}
