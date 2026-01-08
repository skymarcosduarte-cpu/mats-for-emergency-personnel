// Live Events Map View for COMUNIDAD EX SOS
// Shows real-time events: earthquakes, fires, cyclones, global alerts
// Designed for lazy loading - only fetches data when view is active

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Loader2, AlertTriangle, Flame, CloudLightning, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { USGSEarthquake } from '@/types';
import type { TropicalCycloneAlert, FireHotspot } from '@/hooks/useMexicoAlerts';
import type { GDACSAlert } from '@/hooks/useGDACSAlerts';

// USGS feed for earthquakes
const USGS_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

// CORS proxies for external feeds
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

interface LiveEventsMapViewProps {
  map: L.Map | null;
  isActive: boolean;
  userPosition?: { lat: number; lng: number } | null;
}

interface EventsState {
  earthquakes: USGSEarthquake[];
  cyclones: TropicalCycloneAlert[];
  fires: FireHotspot[];
  gdacsAlerts: GDACSAlert[];
  loading: boolean;
  lastUpdate: Date | null;
}

// Create earthquake marker icon
const createEarthquakeIcon = (magnitude: number) => {
  const size = Math.max(20, Math.min(50, magnitude * 8));
  const color = magnitude >= 6 ? '#dc2626' : magnitude >= 4.5 ? '#f97316' : '#eab308';
  
  return L.divIcon({
    className: 'earthquake-event-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          background: ${color}40;
          border-radius: 50%;
          animation: pulseEvent 2s infinite;
        "></div>
        <div style="
          width: ${size * 0.7}px;
          height: ${size * 0.7}px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${Math.max(10, size * 0.35)}px;
          font-weight: bold;
          color: white;
          z-index: 1;
          box-shadow: 0 2px 8px ${color}80;
        ">${magnitude.toFixed(1)}</div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// Create fire hotspot marker
const createFireIcon = (confidence: 'low' | 'nominal' | 'high') => {
  const size = confidence === 'high' ? 24 : confidence === 'nominal' ? 20 : 16;
  const opacity = confidence === 'high' ? 1 : confidence === 'nominal' ? 0.8 : 0.6;
  
  return L.divIcon({
    className: 'fire-event-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size - 4}px;
        opacity: ${opacity};
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
      ">🔥</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// Create cyclone marker
const createCycloneIcon = (type: TropicalCycloneAlert['type']) => {
  const size = type === 'hurricane' ? 40 : type === 'tropical_storm' ? 32 : 24;
  const emoji = type === 'hurricane' ? '🌀' : type === 'tropical_storm' ? '🌪️' : '☁️';
  
  return L.divIcon({
    className: 'cyclone-event-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size - 8}px;
        animation: rotateCyclone 3s linear infinite;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">${emoji}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// Create GDACS alert marker
const createGDACSIcon = (category: GDACSAlert['category'], alertLevel?: GDACSAlert['alertLevel']) => {
  const color = alertLevel === 'red' ? '#dc2626' : alertLevel === 'orange' ? '#f97316' : '#22c55e';
  const emoji = category === 'earthquake' ? '🔴' 
    : category === 'cyclone' ? '🌀'
    : category === 'flood' ? '🌊'
    : category === 'volcano' ? '🌋'
    : category === 'wildfire' ? '🔥'
    : '⚠️';
  
  return L.divIcon({
    className: 'gdacs-event-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        box-shadow: 0 2px 8px ${color}80;
      ">${emoji}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

export const LiveEventsMapView: React.FC<LiveEventsMapViewProps> = ({
  map,
  isActive,
  userPosition,
}) => {
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [events, setEvents] = useState<EventsState>({
    earthquakes: [],
    cyclones: [],
    fires: [],
    gdacsAlerts: [],
    loading: false,
    lastUpdate: null,
  });

  // Fetch earthquakes from USGS
  const fetchEarthquakes = useCallback(async (): Promise<USGSEarthquake[]> => {
    try {
      const response = await fetch(USGS_FEED_URL);
      if (!response.ok) return [];
      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.warn('[LiveEvents] Error fetching earthquakes:', error);
      return [];
    }
  }, []);

  // Fetch cyclones from NHC
  const fetchCyclones = useCallback(async (): Promise<TropicalCycloneAlert[]> => {
    try {
      const feeds = [
        'https://www.nhc.noaa.gov/index-at.xml',
        'https://www.nhc.noaa.gov/index-ep.xml',
      ];
      const cyclones: TropicalCycloneAlert[] = [];
      
      for (const feedUrl of feeds) {
        try {
          const proxyUrl = `${CORS_PROXIES[0]}${encodeURIComponent(feedUrl)}`;
          const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) continue;
          
          const text = await response.text();
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, 'text/xml');
          const items = xml.querySelectorAll('item');
          
          items.forEach((item, index) => {
            const title = item.querySelector('title')?.textContent || '';
            const description = item.querySelector('description')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            
            // Only add if it looks like a storm
            if (title.toLowerCase().includes('hurricane') || 
                title.toLowerCase().includes('tropical') ||
                title.toLowerCase().includes('storm')) {
              
              let type: TropicalCycloneAlert['type'] = 'disturbance';
              if (title.toLowerCase().includes('hurricane')) type = 'hurricane';
              else if (title.toLowerCase().includes('tropical storm')) type = 'tropical_storm';
              else if (title.toLowerCase().includes('depression')) type = 'tropical_depression';
              
              // Extract coordinates if available
              let coordinates: [number, number] | undefined;
              const coordMatch = description.match(/(\d+\.?\d*)\s*([NS])\s+(\d+\.?\d*)\s*([EW])/i);
              if (coordMatch) {
                let lat = parseFloat(coordMatch[1]);
                let lng = parseFloat(coordMatch[3]);
                if (coordMatch[2].toUpperCase() === 'S') lat = -lat;
                if (coordMatch[4].toUpperCase() === 'W') lng = -lng;
                coordinates = [lat, lng];
              }
              
              if (coordinates) {
                cyclones.push({
                  id: `nhc-${feedUrl.includes('at') ? 'atl' : 'pac'}-${index}`,
                  type,
                  name: title.split(' ').slice(0, 3).join(' '),
                  headline: title,
                  description: description.substring(0, 200),
                  basin: feedUrl.includes('at') ? 'atlantic' : 'pacific',
                  coordinates,
                  pubDate: new Date().toISOString(),
                  link,
                });
              }
            }
          });
        } catch (e) {
          console.warn('[LiveEvents] Error fetching NHC feed:', e);
        }
      }
      
      return cyclones;
    } catch (error) {
      console.warn('[LiveEvents] Error fetching cyclones:', error);
      return [];
    }
  }, []);

  // Fetch fire hotspots (Mexico)
  const fetchFires = useCallback(async (): Promise<FireHotspot[]> => {
    try {
      const response = await fetch(
        'https://firms.modaps.eosdis.nasa.gov/api/country/csv/VIIRS_SNPP_NRT/MEX/1',
        { signal: AbortSignal.timeout(10000) }
      );
      if (!response.ok) return [];
      
      const text = await response.text();
      const lines = text.trim().split('\n');
      if (lines.length <= 1) return [];
      
      const fires: FireHotspot[] = [];
      for (let i = 1; i < Math.min(lines.length, 200); i++) { // Limit to 200 fires
        const parts = lines[i].split(',');
        if (parts.length < 10) continue;
        
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        const brightness = parseFloat(parts[2]);
        const confidence = parts[8]?.toLowerCase() as 'low' | 'nominal' | 'high';
        
        if (!isNaN(lat) && !isNaN(lng)) {
          fires.push({
            id: `fire-${i}-${lat.toFixed(3)}-${lng.toFixed(3)}`,
            lat,
            lng,
            brightness,
            confidence: confidence || 'nominal',
            frp: parseFloat(parts[12]) || 0,
            satellite: 'VIIRS',
            acqDate: parts[5] || '',
            acqTime: parts[6] || '',
          });
        }
      }
      
      return fires;
    } catch (error) {
      console.warn('[LiveEvents] Error fetching fires:', error);
      return [];
    }
  }, []);

  // Fetch all events
  const fetchAllEvents = useCallback(async () => {
    if (!isActive) return;
    
    setEvents(prev => ({ ...prev, loading: true }));
    
    try {
      // Fetch all in parallel for speed
      const [earthquakes, cyclones, fires] = await Promise.all([
        fetchEarthquakes(),
        fetchCyclones(),
        fetchFires(),
      ]);
      
      setEvents({
        earthquakes,
        cyclones,
        fires,
        gdacsAlerts: [], // Can add later if needed
        loading: false,
        lastUpdate: new Date(),
      });
    } catch (error) {
      console.error('[LiveEvents] Error fetching events:', error);
      setEvents(prev => ({ ...prev, loading: false }));
    }
  }, [isActive, fetchEarthquakes, fetchCyclones, fetchFires]);

  // Fetch events when view becomes active
  useEffect(() => {
    if (isActive && !events.lastUpdate) {
      fetchAllEvents();
    }
  }, [isActive, events.lastUpdate, fetchAllEvents]);

  // Clear markers when view becomes inactive
  useEffect(() => {
    if (!isActive && map) {
      markersRef.current.forEach((marker) => {
        map.removeLayer(marker);
      });
      markersRef.current.clear();
    }
  }, [isActive, map]);

  // Update markers when events change
  useEffect(() => {
    if (!map || !isActive) return;

    // Clear old markers
    markersRef.current.forEach((marker) => {
      map.removeLayer(marker);
    });
    markersRef.current.clear();

    // Add earthquake markers
    events.earthquakes.forEach((quake) => {
      const [lng, lat] = quake.geometry.coordinates;
      const key = `quake-${quake.id}`;
      
      const marker = L.marker([lat, lng], {
        icon: createEarthquakeIcon(quake.properties.mag),
        zIndexOffset: Math.round(quake.properties.mag * 100),
      })
        .addTo(map)
        .bindPopup(`
          <div style="text-align: center; min-width: 150px;">
            <div style="font-size: 16px; font-weight: bold; color: #dc2626;">
              M${quake.properties.mag.toFixed(1)}
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              ${quake.properties.place}
            </div>
            <div style="font-size: 11px; color: #999; margin-top: 4px;">
              ${new Date(quake.properties.time).toLocaleString()}
            </div>
            <a href="${quake.properties.url}" target="_blank" 
               style="display: block; margin-top: 8px; font-size: 11px; color: #3b82f6;">
              Ver detalles USGS →
            </a>
          </div>
        `);
      
      markersRef.current.set(key, marker);
    });

    // Add fire markers (cluster nearby fires for performance)
    events.fires.slice(0, 100).forEach((fire) => {
      const key = `fire-${fire.id}`;
      
      const marker = L.marker([fire.lat, fire.lng], {
        icon: createFireIcon(fire.confidence),
        zIndexOffset: 50,
      })
        .addTo(map)
        .bindPopup(`
          <div style="text-align: center;">
            <div style="font-size: 14px; font-weight: bold;">🔥 Incendio</div>
            <div style="font-size: 11px; color: #666;">
              Confianza: ${fire.confidence === 'high' ? 'Alta' : fire.confidence === 'nominal' ? 'Media' : 'Baja'}
            </div>
            <div style="font-size: 11px; color: #999;">
              ${fire.acqDate} ${fire.acqTime}
            </div>
          </div>
        `);
      
      markersRef.current.set(key, marker);
    });

    // Add cyclone markers
    events.cyclones.forEach((cyclone) => {
      if (!cyclone.coordinates) return;
      const [lat, lng] = cyclone.coordinates;
      const key = `cyclone-${cyclone.id}`;
      
      const marker = L.marker([lat, lng], {
        icon: createCycloneIcon(cyclone.type),
        zIndexOffset: 200,
      })
        .addTo(map)
        .bindPopup(`
          <div style="text-align: center; min-width: 150px;">
            <div style="font-size: 16px; font-weight: bold;">
              ${cyclone.type === 'hurricane' ? '🌀' : '🌪️'} ${cyclone.name}
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              ${cyclone.headline}
            </div>
            ${cyclone.windSpeed ? `<div style="font-size: 11px;">Viento: ${cyclone.windSpeed} mph</div>` : ''}
            <a href="${cyclone.link}" target="_blank" 
               style="display: block; margin-top: 8px; font-size: 11px; color: #3b82f6;">
              Ver detalles NHC →
            </a>
          </div>
        `);
      
      markersRef.current.set(key, marker);
    });

  }, [map, isActive, events]);

  // Don't render anything if not active (keeps it lightweight)
  if (!isActive) return null;

  return (
    <>
      {/* Loading indicator - compact for mobile */}
      {events.loading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-background/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs font-medium">Cargando eventos...</span>
        </div>
      )}

      {/* Stats bar - only show when loaded */}
      {!events.loading && events.lastUpdate && (
        <div className="absolute bottom-20 left-2 right-2 z-[1000] flex items-center justify-between bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning" />
              {events.earthquakes.length} sismos
            </span>
            <span className="flex items-center gap-1">
              <span className="text-orange-500">🔥</span>
              {events.fires.length} incendios
            </span>
            {events.cyclones.length > 0 && (
              <span className="flex items-center gap-1">
                <span>🌀</span>
                {events.cyclones.length} ciclones
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={fetchAllEvents}
            disabled={events.loading}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", events.loading && "animate-spin")} />
          </Button>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes pulseEvent {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 0.2; }
        }
        @keyframes rotateCyclone {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default LiveEventsMapView;
