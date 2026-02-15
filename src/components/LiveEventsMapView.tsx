// Live Events Map View for COMUNIDAD EX SOS
// Shows real-time events: earthquakes, fires, cyclones, global alerts, weather radar, lightning
// Designed for lazy loading - only fetches data when view is active

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';
import { Loader2, AlertTriangle, Flame, CloudLightning, Radio, RefreshCw, CloudRain, Zap, Wind, ThermometerSun, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
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

// RainViewer API for precipitation radar (free, no API key)
const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

// SMN/CONAGUA Doppler Radar stations in Mexico
const SMN_RADAR_STATIONS = [
  { name: 'Guasave', estado: 'Sinaloa', lat: 25.5731, lng: -108.4658 },
  { name: 'San Fernando', estado: 'Tamaulipas', lat: 24.8389, lng: -98.1553 },
  { name: 'Valle de México', estado: 'CDMX', lat: 19.4326, lng: -99.1332 },
  { name: 'El Mozotal', estado: 'Veracruz', lat: 19.2000, lng: -96.1500, dualPol: true },
  { name: 'Sabancuy', estado: 'Campeche', lat: 18.9667, lng: -91.1833, dualPol: true },
  { name: 'Puerto Ángel', estado: 'Oaxaca', lat: 15.6667, lng: -96.4833 },
  { name: 'Acapulco', estado: 'Guerrero', lat: 16.8531, lng: -99.8237 },
  { name: 'Manzanillo', estado: 'Colima', lat: 19.0519, lng: -104.3190 },
];

// SSN Earthquake interface
interface SSNEarthquake {
  id: string;
  magnitude: number;
  lat: number;
  lng: number;
  depth: number;
  location: string;
  date: string;
  time: string;
  timestamp: Date;
}

// SMN Weather Alert interface
interface SMNAlert {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category: string;
}

interface LiveEventsMapViewProps {
  map: L.Map | null;
  isActive: boolean;
  userPosition?: { lat: number; lng: number } | null;
}

interface EventsState {
  earthquakes: USGSEarthquake[];
  ssnEarthquakes: SSNEarthquake[];
  cyclones: TropicalCycloneAlert[];
  fires: FireHotspot[];
  gdacsAlerts: GDACSAlert[];
  smnAlerts: SMNAlert[];
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

// Create SSN (Mexico) earthquake marker
const createSSNEarthquakeIcon = (magnitude: number) => {
  const size = Math.max(22, Math.min(50, magnitude * 9));
  const color = magnitude >= 5 ? '#059669' : magnitude >= 4 ? '#10b981' : '#34d399';
  
  return L.divIcon({
    className: 'ssn-earthquake-marker',
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
          animation: pulseEvent 1.5s infinite;
        "></div>
        <div style="
          width: ${size * 0.75}px;
          height: ${size * 0.75}px;
          background: ${color};
          border: 2px solid #fff;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1;
          box-shadow: 0 2px 8px ${color}80;
        ">
          <span style="font-size: ${Math.max(9, size * 0.28)}px; font-weight: bold; color: white; line-height: 1;">${magnitude.toFixed(1)}</span>
          <span style="font-size: 7px; color: rgba(255,255,255,0.9); font-weight: 600; line-height: 1;">SSN</span>
        </div>
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

// Create SMN weather alert marker
const createSMNAlertIcon = () => {
  return L.divIcon({
    className: 'smn-alert-marker',
    html: `
      <div style="
        width: 30px;
        height: 30px;
        background: linear-gradient(135deg, #0ea5e9, #6366f1);
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(14,165,233,0.5);
        animation: pulseEvent 2s infinite;
      ">⛈️</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

export const LiveEventsMapView: React.FC<LiveEventsMapViewProps> = ({
  map,
  isActive,
  userPosition,
}) => {
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const nowcastLayerRef = useRef<L.TileLayer | null>(null);
  const owmLayerRef = useRef<L.TileLayer | null>(null);
  const owmKeyRef = useRef<string | null>(null);
  const radarTimestampRef = useRef<string | null>(null);
  const satelliteTimestampRef = useRef<string | null>(null);
  const nowcastTimestampRef = useRef<string | null>(null);
  const radarStationMarkersRef = useRef<L.Marker[]>([]);
  const radarCoverageCirclesRef = useRef<L.Circle[]>([]);
  const [radarActive, setRadarActive] = useState(true);
  const [owmActive, setOwmActive] = useState(true);
  const [showRadarStations, setShowRadarStations] = useState(true);

  // Radar animation state
  const radarFramesRef = useRef<{ path: string; time: number }[]>([]);
  const [radarAnimPlaying, setRadarAnimPlaying] = useState(false);
  const [radarAnimFrame, setRadarAnimFrame] = useState(-1); // -1 = latest (live)
  const radarAnimIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [events, setEvents] = useState<EventsState>({
    earthquakes: [],
    ssnEarthquakes: [],
    cyclones: [],
    fires: [],
    gdacsAlerts: [],
    smnAlerts: [],
    loading: false,
    lastUpdate: null,
  });

  // Show a specific radar frame on the map
  const showRadarFrame = useCallback((framePath: string) => {
    if (!map) return;
    if (radarLayerRef.current && map.hasLayer(radarLayerRef.current)) {
      map.removeLayer(radarLayerRef.current);
    }
    const layer = L.tileLayer(
      `https://tilecache.rainviewer.com${framePath}/256/{z}/{x}/{y}/2/1_1.png`,
      { opacity: 0.85, zIndex: 5, attribution: '<a href="https://www.rainviewer.com/" target="_blank">RainViewer</a>' }
    );
    layer.addTo(map);
    radarLayerRef.current = layer;
  }, [map]);

  // Fetch RainViewer radar + satellite layers
  const setupRadarLayer = useCallback(async () => {
    if (!map) return;
    
    try {
      const response = await fetch(RAINVIEWER_API);
      if (!response.ok) return;
      const data = await response.json();
      
      // --- Store all radar frames for animation ---
      const radarFrames: { path: string; time: number }[] = (data?.radar?.past || []).map((f: any) => ({ path: f.path, time: f.time }));
      // Add nowcast frames too
      const nowcastFrames: { path: string; time: number }[] = (data?.radar?.nowcast || []).map((f: any) => ({ path: f.path, time: f.time }));
      const allFrames = [...radarFrames, ...nowcastFrames];
      radarFramesRef.current = allFrames;

      // Show latest radar frame (only if not animating)
      if (!radarAnimPlaying && radarAnimFrame === -1 && radarFrames.length > 0) {
        const latestFrame = radarFrames[radarFrames.length - 1];
        if (radarTimestampRef.current !== latestFrame.path) {
          radarTimestampRef.current = latestFrame.path;
          showRadarFrame(latestFrame.path);
          console.log('[LiveEvents] Radar layer added:', latestFrame.path);
        }
      }
      
      // --- Satellite infrared (global coverage including Mexico) ---
      const satelliteFrames = data?.satellite?.infrared || [];
      if (satelliteFrames.length > 0) {
        const latestSat = satelliteFrames[satelliteFrames.length - 1];
        const satPath = latestSat.path;
        
        if (satelliteTimestampRef.current !== satPath) {
          satelliteTimestampRef.current = satPath;
          
          if (satelliteLayerRef.current && map.hasLayer(satelliteLayerRef.current)) {
            map.removeLayer(satelliteLayerRef.current);
          }
          
          const satLayer = L.tileLayer(
            `https://tilecache.rainviewer.com${satPath}/256/{z}/{x}/{y}/0/0_1.png`,
            { opacity: 0.7, zIndex: 4, attribution: '<a href="https://www.rainviewer.com/" target="_blank">RainViewer Sat</a>' }
          );
          
          satLayer.addTo(map);
          satelliteLayerRef.current = satLayer;
          console.log('[LiveEvents] Satellite IR layer added:', satPath);
        }
      }

      // --- Nowcast layer (only when NOT animating — animation includes nowcast frames) ---
      if (!radarAnimPlaying && nowcastFrames.length > 0) {
        const latestNow = nowcastFrames[nowcastFrames.length - 1];
        const nowPath = latestNow.path;

        if (nowcastTimestampRef.current !== nowPath) {
          nowcastTimestampRef.current = nowPath;

          if (nowcastLayerRef.current && map.hasLayer(nowcastLayerRef.current)) {
            map.removeLayer(nowcastLayerRef.current);
          }

          const nowLayer = L.tileLayer(
            `https://tilecache.rainviewer.com${nowPath}/256/{z}/{x}/{y}/2/1_1.png`,
            { opacity: 0.5, zIndex: 6, attribution: 'RainViewer Nowcast' }
          );

          nowLayer.addTo(map);
          nowcastLayerRef.current = nowLayer;
          console.log('[LiveEvents] Nowcast layer added:', nowPath);
        }
      }

      // --- OpenWeatherMap precipitation layer (better Mexico coverage) ---
      if (!owmLayerRef.current) {
        try {
          let apiKey = owmKeyRef.current;
          if (!apiKey) {
            const { data } = await supabase.functions.invoke('get-owm-key');
            if (data?.key) {
              apiKey = data.key;
              owmKeyRef.current = apiKey;
            }
          }
          if (apiKey) {
            const owmLayer = L.tileLayer(
              `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`,
              { opacity: 0.6, zIndex: 3, attribution: '© OpenWeatherMap' }
            );
            owmLayer.addTo(map);
            owmLayerRef.current = owmLayer;
            console.log('[LiveEvents] OWM precipitation layer added');
          }
        } catch (err) {
          console.warn('[LiveEvents] OWM layer error:', err);
        }
      }

      // --- SMN Radar station markers with coverage circles ---
      if (showRadarStations && radarStationMarkersRef.current.length === 0) {
        SMN_RADAR_STATIONS.forEach((station) => {
          const coverageCircle = L.circle([station.lat, station.lng], {
            radius: 250000,
            color: '#0ea5e9',
            weight: 1,
            opacity: 0.4,
            fillColor: '#0ea5e9',
            fillOpacity: 0.06,
            dashArray: '6 4',
            interactive: false,
          });
          coverageCircle.addTo(map);
          radarCoverageCirclesRef.current.push(coverageCircle);

          const icon = L.divIcon({
            className: 'smn-radar-station',
            html: `
              <div style="
                width: 28px; height: 28px;
                position: relative;
                display: flex; align-items: center; justify-content: center;
              ">
                <div style="
                  position: absolute;
                  width: 28px; height: 28px;
                  border: 2px solid #0ea5e9;
                  border-radius: 50%;
                  animation: radarSweep 3s linear infinite;
                  opacity: 0.6;
                "></div>
                <div style="
                  width: 16px; height: 16px;
                  background: radial-gradient(circle, #0ea5e9 40%, rgba(14,165,233,0.3) 100%);
                  border: 2px solid white;
                  border-radius: 50%;
                  z-index: 1;
                  box-shadow: 0 0 8px rgba(14,165,233,0.6);
                "></div>
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -16],
          });

          const m = L.marker([station.lat, station.lng], { icon, zIndexOffset: -100 })
            .addTo(map)
            .bindPopup(`
              <div style="text-align:center;min-width:140px;">
                <div style="font-size:12px;font-weight:bold;color:#0ea5e9;">📡 Radar Doppler EN VIVO</div>
                <div style="font-size:12px;font-weight:600;margin-top:3px;">${station.name}</div>
                <div style="font-size:10px;color:#666;">${station.estado}</div>
                <div style="font-size:9px;color:#0ea5e9;margin-top:3px;">Cobertura: ~250 km</div>
                ${station.dualPol ? '<div style="font-size:9px;color:#059669;margin-top:2px;">✓ Doble polaridad</div>' : ''}
                <div style="font-size:9px;color:#999;margin-top:4px;">SMN / CONAGUA</div>
              </div>
            `);
          radarStationMarkersRef.current.push(m);
        });
      }
    } catch (error) {
      console.warn('[LiveEvents] Error setting up radar:', error);
    }
  }, [map, showRadarStations, radarAnimPlaying, radarAnimFrame, showRadarFrame]);

  // Radar animation: play/pause logic
  useEffect(() => {
    if (radarAnimPlaying && radarFramesRef.current.length > 0) {
      // Hide nowcast layer during animation
      if (nowcastLayerRef.current && map && map.hasLayer(nowcastLayerRef.current)) {
        map.removeLayer(nowcastLayerRef.current);
      }

      const frames = radarFramesRef.current;
      let idx = radarAnimFrame >= 0 ? radarAnimFrame : 0;

      radarAnimIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % frames.length;
        setRadarAnimFrame(idx);
        showRadarFrame(frames[idx].path);
      }, 700);

      return () => {
        if (radarAnimIntervalRef.current) clearInterval(radarAnimIntervalRef.current);
      };
    } else {
      if (radarAnimIntervalRef.current) {
        clearInterval(radarAnimIntervalRef.current);
        radarAnimIntervalRef.current = null;
      }
    }
  }, [radarAnimPlaying, map, showRadarFrame]);

  // When animation stops, restore live frame
  const stopAnimation = useCallback(() => {
    setRadarAnimPlaying(false);
    setRadarAnimFrame(-1);
    // Restore latest radar frame
    const frames = radarFramesRef.current;
    const pastFrames = frames.filter(f => f.time <= Date.now() / 1000);
    if (pastFrames.length > 0) {
      showRadarFrame(pastFrames[pastFrames.length - 1].path);
    }
    // Restore nowcast
    if (nowcastLayerRef.current && map && !map.hasLayer(nowcastLayerRef.current)) {
      nowcastLayerRef.current.addTo(map);
    }
  }, [map, showRadarFrame]);

  // Toggle radar + satellite + nowcast visibility (excludes OWM)
  useEffect(() => {
    if (!map) return;
    if (radarActive) {
      if (radarLayerRef.current && !map.hasLayer(radarLayerRef.current)) {
        radarLayerRef.current.addTo(map);
      }
      if (satelliteLayerRef.current && !map.hasLayer(satelliteLayerRef.current)) {
        satelliteLayerRef.current.addTo(map);
      }
      if (nowcastLayerRef.current && !map.hasLayer(nowcastLayerRef.current)) {
        nowcastLayerRef.current.addTo(map);
      }
      // Show station markers + coverage circles
      radarStationMarkersRef.current.forEach(m => {
        if (!map.hasLayer(m)) m.addTo(map);
      });
      radarCoverageCirclesRef.current.forEach(c => {
        if (!map.hasLayer(c)) c.addTo(map);
      });
    } else {
      if (radarLayerRef.current && map.hasLayer(radarLayerRef.current)) {
        map.removeLayer(radarLayerRef.current);
      }
      if (satelliteLayerRef.current && map.hasLayer(satelliteLayerRef.current)) {
        map.removeLayer(satelliteLayerRef.current);
      }
      if (nowcastLayerRef.current && map.hasLayer(nowcastLayerRef.current)) {
        map.removeLayer(nowcastLayerRef.current);
      }
      // Hide station markers + coverage circles
      radarStationMarkersRef.current.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
      });
      radarCoverageCirclesRef.current.forEach(c => {
        if (map.hasLayer(c)) map.removeLayer(c);
      });
    }
  }, [map, radarActive]);

  // Toggle OWM layer independently
  useEffect(() => {
    if (!map) return;
    if (owmActive) {
      if (owmLayerRef.current && !map.hasLayer(owmLayerRef.current)) {
        owmLayerRef.current.addTo(map);
      }
    } else {
      if (owmLayerRef.current && map.hasLayer(owmLayerRef.current)) {
        map.removeLayer(owmLayerRef.current);
      }
    }
  }, [map, owmActive]);

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
            
            if (title.toLowerCase().includes('hurricane') || 
                title.toLowerCase().includes('tropical') ||
                title.toLowerCase().includes('storm')) {
              
              let type: TropicalCycloneAlert['type'] = 'disturbance';
              if (title.toLowerCase().includes('hurricane')) type = 'hurricane';
              else if (title.toLowerCase().includes('tropical storm')) type = 'tropical_storm';
              else if (title.toLowerCase().includes('depression')) type = 'tropical_depression';
              
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

  // Fetch fire hotspots via edge function
  const fetchFires = useCallback(async (): Promise<FireHotspot[]> => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('fetch-fires');
      
      if (error) {
        console.warn('[LiveEvents] Error calling fetch-fires:', error);
        return [];
      }
      
      if (!data?.success || !data?.fires) {
        console.warn('[LiveEvents] No fire data returned');
        return [];
      }
      
      return data.fires as FireHotspot[];
    } catch (error) {
      console.warn('[LiveEvents] Error fetching fires:', error);
      return [];
    }
  }, []);

  // Fetch SSN earthquakes
  const fetchSSNEarthquakes = useCallback(async (): Promise<SSNEarthquake[]> => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('fetch-ssn');

      if (error) {
        console.warn('[LiveEvents] Error calling fetch-ssn:', error);
        return [];
      }

      if (!data?.success || typeof data?.html !== 'string') {
        console.warn('[LiveEvents] Invalid SSN response');
        return [];
      }

      const html = data.html as string;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const rows = doc.querySelectorAll('table tr');
      const earthquakes: SSNEarthquake[] = [];
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      rows.forEach((row, index) => {
        try {
          const cells = row.querySelectorAll('td');
          if (cells.length < 4) return;
          
          const magText = cells[0]?.textContent?.trim() || '';
          const magnitude = parseFloat(magText);
          if (isNaN(magnitude)) return;
          
          const dateTimeCell = cells[1]?.textContent?.replace(/\s+/g, ' ').trim() || '';
          const dateMatch = dateTimeCell.match(/(\d{4}-\d{2}-\d{2})/);
          const timeMatch = dateTimeCell.match(/(\d{2}:\d{2}:\d{2})/);
          const date = dateMatch ? dateMatch[1] : '';
          const time = timeMatch ? timeMatch[1] : '';

          const locationCell = cells[2]?.textContent?.replace(/\s+/g, ' ').trim() || '';
          if (!locationCell) return;

          const location = (locationCell.split(':')[0] || 'México').trim();

          const coordMatch = locationCell.match(/:\s*(-?[\d.]+)\s*(?:Â?°)?\s*,\s*(-?[\d.]+)\s*(?:Â?°)?/);
          if (!coordMatch) return;

          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          const depthText = cells[3]?.textContent?.trim() || '';
          const depth = Number.isFinite(parseFloat(depthText)) ? parseFloat(depthText) : 0;

          if (date && time) {
            const timestamp = new Date(`${date}T${time}`);
            if (timestamp < twentyFourHoursAgo) return;

            earthquakes.push({
              id: `ssn-${index}-${date}-${time}`,
              magnitude,
              lat,
              lng,
              depth,
              location,
              date,
              time,
              timestamp,
            });
          }
        } catch (e) {
          // Skip malformed rows
        }
      });
      
      console.log(`[LiveEvents] SSN: Found ${earthquakes.length} earthquakes in last 24 hours`);
      return earthquakes;
    } catch (error) {
      console.warn('[LiveEvents] Error fetching SSN earthquakes:', error);
      return [];
    }
  }, []);

  // Fetch SMN/CONAGUA weather alerts via edge function
  const fetchSMNAlerts = useCallback(async (): Promise<SMNAlert[]> => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('fetch-smn-alerts');

      if (error || !data?.success || !data?.xml) {
        console.warn('[LiveEvents] Error fetching SMN alerts:', error);
        return [];
      }

      const parser = new DOMParser();
      const xml = parser.parseFromString(data.xml, 'text/xml');
      const items = xml.querySelectorAll('item');
      const alerts: SMNAlert[] = [];

      items.forEach((item, index) => {
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const category = item.querySelector('category')?.textContent || 'Alerta Meteorológica';

        if (title) {
          alerts.push({
            id: `smn-${index}-${Date.now()}`,
            title,
            description: description.replace(/<[^>]*>/g, '').trim(),
            link,
            pubDate,
            category,
          });
        }
      });

      console.log(`[LiveEvents] SMN: Found ${alerts.length} weather alerts`);
      return alerts;
    } catch (error) {
      console.warn('[LiveEvents] Error fetching SMN alerts:', error);
      return [];
    }
  }, []);

  // Fetch all events
  const fetchAllEvents = useCallback(async () => {
    if (!isActive) return;
    
    setEvents(prev => ({ ...prev, loading: true }));
    
    try {
      // Fetch all in parallel for speed
      const [earthquakes, ssnEarthquakes, cyclones, fires, smnAlerts] = await Promise.all([
        fetchEarthquakes(),
        fetchSSNEarthquakes(),
        fetchCyclones(),
        fetchFires(),
        fetchSMNAlerts(),
      ]);
      
      setEvents({
        earthquakes,
        ssnEarthquakes,
        cyclones,
        fires,
        gdacsAlerts: [],
        smnAlerts,
        loading: false,
        lastUpdate: new Date(),
      });
    } catch (error) {
      console.error('[LiveEvents] Error fetching events:', error);
      setEvents(prev => ({ ...prev, loading: false }));
    }
  }, [isActive, fetchEarthquakes, fetchSSNEarthquakes, fetchCyclones, fetchFires, fetchSMNAlerts]);

  // Fetch events and setup radar when view becomes active
  useEffect(() => {
    if (isActive && !events.lastUpdate) {
      fetchAllEvents();
    }
  }, [isActive, events.lastUpdate, fetchAllEvents]);

  // Setup radar layer when active
  useEffect(() => {
    if (isActive && map) {
      setupRadarLayer();
      // Refresh radar every 5 minutes
      const radarInterval = setInterval(setupRadarLayer, 5 * 60 * 1000);
      return () => clearInterval(radarInterval);
    }
  }, [isActive, map, setupRadarLayer]);

  // Auto-center map on Mexico when SSN earthquakes are found
  useEffect(() => {
    if (!map || !isActive || events.ssnEarthquakes.length === 0) return;
    
    const bounds = L.latLngBounds(
      events.ssnEarthquakes.map(eq => [eq.lat, eq.lng] as [number, number])
    );
    
    map.fitBounds(bounds, { 
      padding: [50, 50],
      maxZoom: 8,
      animate: true,
      duration: 0.5
    });
  }, [map, isActive, events.ssnEarthquakes]);

  // Clear markers and radar when view becomes inactive
  useEffect(() => {
    if (!isActive && map) {
      // Stop radar animation
      setRadarAnimPlaying(false);
      setRadarAnimFrame(-1);
      if (radarAnimIntervalRef.current) {
        clearInterval(radarAnimIntervalRef.current);
        radarAnimIntervalRef.current = null;
      }

      markersRef.current.forEach((marker) => {
        map.removeLayer(marker);
      });
      markersRef.current.clear();
      
      // Remove radar, satellite, nowcast layers
      if (radarLayerRef.current && map.hasLayer(radarLayerRef.current)) {
        map.removeLayer(radarLayerRef.current);
      }
      if (satelliteLayerRef.current && map.hasLayer(satelliteLayerRef.current)) {
        map.removeLayer(satelliteLayerRef.current);
      }
      if (nowcastLayerRef.current && map.hasLayer(nowcastLayerRef.current)) {
        map.removeLayer(nowcastLayerRef.current);
      }
      if (owmLayerRef.current && map.hasLayer(owmLayerRef.current)) {
        map.removeLayer(owmLayerRef.current);
        owmLayerRef.current = null;
      }
      // Remove radar station markers + coverage circles
      radarStationMarkersRef.current.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
      });
      radarStationMarkersRef.current = [];
      radarCoverageCirclesRef.current.forEach(c => {
        if (map.hasLayer(c)) map.removeLayer(c);
      });
      radarCoverageCirclesRef.current = [];
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

    // Add fire markers
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

    // Add SSN earthquake markers (Mexico, last 24 hours)
    events.ssnEarthquakes.forEach((quake) => {
      const key = `ssn-${quake.id}`;
      
      const marker = L.marker([quake.lat, quake.lng], {
        icon: createSSNEarthquakeIcon(quake.magnitude),
        zIndexOffset: Math.round(quake.magnitude * 150),
      })
        .addTo(map)
        .bindPopup(`
          <div style="text-align: center; min-width: 160px;">
            <div style="font-size: 10px; color: #059669; font-weight: 600; margin-bottom: 2px;">
              🇲🇽 SSN México (Últimas 24h)
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #059669;">
              M${quake.magnitude.toFixed(1)}
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              ${quake.location}
            </div>
            <div style="font-size: 11px; color: #999; margin-top: 4px;">
              ${quake.date} ${quake.time}
            </div>
            <a href="http://www.ssn.unam.mx/sismicidad/ultimos/" target="_blank" 
               style="display: block; margin-top: 8px; font-size: 11px; color: #059669;">
              Ver en SSN →
            </a>
          </div>
        `);
      
      markersRef.current.set(key, marker);
    });

    // Add SMN weather alert markers (centered on Mexico, as SMN doesn't provide coordinates)
    // Show as an info panel rather than map markers since they're country-level alerts
    // We'll show them in the stats bar below

  }, [map, isActive, events]);

  // Don't render anything if not active
  if (!isActive) return null;

  return (
    <>
      {/* Loading indicator */}
      {events.loading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-background/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs font-medium">Cargando eventos...</span>
        </div>
      )}

      {/* Radar toggle button + legend */}
      {!events.loading && (
        <div className="absolute top-16 right-2 z-[1000] flex flex-col items-end gap-1">
          <button
            onClick={() => setRadarActive(!radarActive)}
            className={cn(
              "rounded-lg px-2.5 py-2 shadow-lg border transition-colors flex items-center gap-1.5",
              radarActive 
                ? "bg-sky-500/90 text-white border-sky-400" 
                : "bg-background/90 text-muted-foreground border-border"
            )}
            title={radarActive ? 'Desactivar radar RainViewer' : 'Activar radar RainViewer'}
          >
            <CloudRain className="w-4 h-4" />
            <span className="text-xs font-medium">Radar</span>
          </button>
          <button
            onClick={() => setOwmActive(!owmActive)}
            className={cn(
              "rounded-lg px-2.5 py-2 shadow-lg border transition-colors flex items-center gap-1.5",
              owmActive 
                ? "bg-orange-500/90 text-white border-orange-400" 
                : "bg-background/90 text-muted-foreground border-border"
            )}
            title={owmActive ? 'Desactivar capa OpenWeather' : 'Activar capa OpenWeather (mejor cobertura MX)'}
          >
            <ThermometerSun className="w-4 h-4" />
            <span className="text-xs font-medium">OWM</span>
          </button>
          {(radarActive || owmActive) && (
            <div className="bg-background/90 backdrop-blur-sm rounded-lg shadow border border-border px-2 py-1.5 text-[10px] text-muted-foreground max-w-[140px] leading-tight">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Lluvia ligera</span>
              </div>
              <div className="flex items-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>Moderada</span>
              </div>
              <div className="flex items-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Fuerte / tormenta</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-purple-600" />
                <span>Torrencial</span>
              </div>
              {radarActive && <div className="mt-1 text-[9px] opacity-70">☁️ Nubes IR siempre visibles</div>}
              {radarActive && <div className="text-[9px] opacity-70">🌧️ RainViewer</div>}
              {owmActive && <div className="text-[9px] opacity-70">🌤️ OpenWeather MX</div>}
            </div>
          )}
        </div>
      )}

      {/* Radar Animation Player */}
      {radarActive && radarFramesRef.current.length > 0 && (
        <div className="absolute top-16 left-2 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border border-border p-2 flex items-center gap-2">
          <button
            onClick={() => {
              if (radarAnimPlaying) {
                stopAnimation();
              } else {
                setRadarAnimPlaying(true);
              }
            }}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
              radarAnimPlaying
                ? 'bg-warning/20 text-warning'
                : 'bg-primary/20 text-primary'
            )}
            title={radarAnimPlaying ? 'Pausar animación' : 'Reproducir últimos frames de radar'}
          >
            {radarAnimPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {radarAnimPlaying && radarAnimFrame >= 0 && (
            <>
              {/* Frame progress */}
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="flex gap-[2px]">
                  {radarFramesRef.current.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1.5 rounded-full transition-colors',
                        i <= radarAnimFrame ? 'bg-primary' : 'bg-muted',
                        radarFramesRef.current.length > 15 ? 'w-1' : 'w-1.5'
                      )}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {(() => {
                    const frame = radarFramesRef.current[radarAnimFrame];
                    if (!frame) return '';
                    const d = new Date(frame.time * 1000);
                    const isFuture = frame.time > Date.now() / 1000;
                    return `${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}${isFuture ? ' ⟶' : ''}`;
                  })()}
                </span>
              </div>

              <button
                onClick={stopAnimation}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
                title="Volver a EN VIVO"
              >
                EN VIVO
              </button>
            </>
          )}
        </div>
      )}

      {/* SMN Weather Alerts panel */}
      {events.smnAlerts.length > 0 && (
        <div className="absolute top-28 right-2 z-[1000] max-w-[200px] bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border border-sky-500/30 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-500/10 border-b border-sky-500/20">
            <CloudLightning className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-xs font-semibold text-sky-600">SMN / CONAGUA</span>
          </div>
          <div className="max-h-[150px] overflow-y-auto">
            {events.smnAlerts.slice(0, 5).map((alert) => (
              <a
                key={alert.id}
                href={alert.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-2.5 py-1.5 text-xs hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0"
              >
                <div className="font-medium text-foreground line-clamp-2">{alert.title}</div>
                {alert.pubDate && (
                  <div className="text-muted-foreground text-[10px] mt-0.5">
                    {new Date(alert.pubDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Stats bar */}
      {!events.loading && events.lastUpdate && (
        <div className="absolute bottom-20 left-2 right-2 z-[1000] flex items-center justify-between bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {radarActive && (
              <span className="flex items-center gap-1 text-sky-500 font-medium">
                <CloudRain className="w-3 h-3" />
                Radar+Sat+FC
              </span>
            )}
            {radarActive && (
              <span className="flex items-center gap-1 text-sky-400 font-medium">
                📡 {SMN_RADAR_STATIONS.length} Radares
              </span>
            )}
            {events.smnAlerts.length > 0 && (
              <span className="flex items-center gap-1 text-sky-600 font-medium">
                <CloudLightning className="w-3 h-3" />
                {events.smnAlerts.length} SMN
              </span>
            )}
            {events.ssnEarthquakes.length > 0 && (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {events.ssnEarthquakes.length} SSN
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning" />
              {events.earthquakes.length} USGS
            </span>
            <span className="flex items-center gap-1">
              <span className="text-orange-500">🔥</span>
              {events.fires.length}
            </span>
            {events.cyclones.length > 0 && (
              <span className="flex items-center gap-1">
                <span>🌀</span>
                {events.cyclones.length}
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
        @keyframes radarSweep {
          0% { transform: scale(1); opacity: 0.6; box-shadow: 0 0 4px rgba(14,165,233,0.4); }
          50% { transform: scale(1.6); opacity: 0; box-shadow: 0 0 12px rgba(14,165,233,0); }
          51% { transform: scale(1); opacity: 0; }
          100% { transform: scale(1); opacity: 0.6; box-shadow: 0 0 4px rgba(14,165,233,0.4); }
        }
      `}</style>
    </>
  );
};

export default LiveEventsMapView;
