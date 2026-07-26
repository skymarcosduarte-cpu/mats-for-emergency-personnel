// Live Events Map View — weather + hazards overlay for the Community Map.
// Layers (always-on, free / no zoom paywall):
//   1. NASA FIRMS fire hotspots (server-cached)
//   2. OpenWeatherMap point query — tap map to see local weather + official alerts
//   3. NHC active tropical cyclones (Atlantic + Eastern Pacific)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';
import type { FireHotspot } from '@/hooks/useMexicoAlerts';
import { useWeatherAlerts } from '@/hooks/useWeatherAlerts';

interface LiveEventsMapViewProps {
  map: L.Map | null;
  isActive: boolean;
  userPosition?: { lat: number; lng: number } | null;
}

interface EventsState {
  fires: FireHotspot[];
  loading: boolean;
  lastUpdate: Date | null;
}

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

const createCycloneIcon = (label: string, severity: string) => {
  const color = severity === 'Extreme' ? '#dc2626' : severity === 'Severe' ? '#f97316' : '#eab308';
  return L.divIcon({
    className: 'cyclone-event-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="
          width: 40px; height: 40px; border-radius: 50%;
          background: ${color}; border: 2px solid #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; box-shadow: 0 0 14px ${color}aa, 0 2px 6px rgba(0,0,0,.4);
          animation: cyclone-spin 6s linear infinite;
        ">🌀</div>
        <div style="
          margin-top: 2px; background: rgba(0,0,0,.8); color: #fff;
          font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
          white-space: nowrap;
        ">${label}</div>
      </div>
      <style>@keyframes cyclone-spin { to { transform: rotate(360deg); } }</style>
    `,
    iconSize: [40, 56],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

export const LiveEventsMapView: React.FC<LiveEventsMapViewProps> = ({
  map,
  isActive,
}) => {
  const fireMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const cycloneMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const owmClickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);

  const [events, setEvents] = useState<EventsState>({
    fires: [],
    loading: false,
    lastUpdate: null,
  });

  const { alerts: weatherAlerts } = useWeatherAlerts(null);

  // Cyclones: only NHC entries with coordinates
  const cyclones = React.useMemo(
    () => weatherAlerts.filter(a =>
      a.source === 'NHC' && a.coordinates &&
      /hurricane|tropical|cyclone|subtropical/i.test(a.event)
    ),
    [weatherAlerts]
  );

  // Fetch fire hotspots via edge function
  const fetchFires = useCallback(async (): Promise<FireHotspot[]> => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('fetch-fires');
      if (error) {
        console.warn('[LiveEvents] Error calling fetch-fires:', error);
        return [];
      }
      if (!data?.success || !data?.fires) return [];
      return data.fires as FireHotspot[];
    } catch (error) {
      console.warn('[LiveEvents] Error fetching fires:', error);
      return [];
    }
  }, []);

  const fetchAllEvents = useCallback(async () => {
    if (!isActive) return;
    setEvents(prev => ({ ...prev, loading: true }));
    try {
      const fires = await fetchFires();
      setEvents({ fires, loading: false, lastUpdate: new Date() });
    } catch (error) {
      console.error('[LiveEvents] Error fetching events:', error);
      setEvents(prev => ({ ...prev, loading: false }));
    }
  }, [isActive, fetchFires]);

  // Fetch when view becomes active
  useEffect(() => {
    if (isActive && !events.lastUpdate) fetchAllEvents();
  }, [isActive, events.lastUpdate, fetchAllEvents]);

  // Clear everything when view becomes inactive
  useEffect(() => {
    if (!isActive && map) {
      fireMarkersRef.current.forEach((m) => map.removeLayer(m));
      fireMarkersRef.current.clear();
      cycloneMarkersRef.current.forEach((m) => map.removeLayer(m));
      cycloneMarkersRef.current.clear();
    }
  }, [isActive, map]);

  // Update fire markers
  useEffect(() => {
    if (!map || !isActive) return;

    fireMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    fireMarkersRef.current.clear();

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
      fireMarkersRef.current.set(key, marker);
    });
  }, [map, isActive, events]);

  // Cyclone markers
  useEffect(() => {
    if (!map || !isActive) return;
    cycloneMarkersRef.current.forEach((m) => map.removeLayer(m));
    cycloneMarkersRef.current.clear();
    cyclones.forEach((c) => {
      if (!c.coordinates) return;
      const label = (c.event.split(' ').find(w => /[A-Z]/.test(w[0])) || c.event).slice(0, 14);
      const marker = L.marker(c.coordinates, {
        icon: createCycloneIcon(label, c.severity),
        zIndexOffset: 200,
      })
        .addTo(map)
        .bindPopup(`
          <div style="max-width: 240px;">
            <div style="font-size: 14px; font-weight: bold;">🌀 ${c.event}</div>
            <div style="font-size: 11px; color: #666; margin-top: 2px;">${c.senderName}</div>
            <div style="font-size: 12px; margin-top: 6px;">${c.headline.slice(0, 220)}</div>
          </div>
        `);
      cycloneMarkersRef.current.set(c.id, marker);
    });
  }, [map, isActive, cyclones]);

  // OpenWeatherMap point query — tap map
  useEffect(() => {
    if (!map || !isActive) return;

    const detach = () => {
      if (owmClickHandlerRef.current) {
        map.off('click', owmClickHandlerRef.current);
        owmClickHandlerRef.current = null;
      }
      map.getContainer().style.cursor = '';
    };

    map.getContainer().style.cursor = 'crosshair';

    const handler = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const loadingPopup = L.popup({ closeOnClick: true })
        .setLatLng(e.latlng)
        .setContent('<div style="font-size:12px;">⏳ Consultando clima…</div>')
        .openOn(map);
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('fetch-owm-weather', {
          body: { lat, lon: lng },
        });
        if (error || !data || data.error) {
          loadingPopup.setContent('<div style="font-size:12px; color:#dc2626;">Sin datos de clima</div>');
          return;
        }
        const temp = Math.round(data.main?.temp ?? 0);
        const feels = Math.round(data.main?.feels_like ?? 0);
        const desc = data.weather?.[0]?.description ?? '';
        const icon = data.weather?.[0]?.icon;
        const humidity = data.main?.humidity;
        const wind = data.wind?.speed ? Math.round(data.wind.speed * 3.6) : null;
        const city = data.name || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        const iconHtml = icon ? `<img src="https://openweathermap.org/img/wn/${icon}@2x.png" width="48" height="48" style="vertical-align:middle;" />` : '';
        loadingPopup.setContent(`
          <div style="min-width: 180px; font-family: system-ui;">
            <div style="font-weight:700; font-size:13px;">📍 ${city}</div>
            <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
              ${iconHtml}
              <div>
                <div style="font-size:22px; font-weight:700; line-height:1;">${temp}°C</div>
                <div style="font-size:11px; color:#666; text-transform:capitalize;">${desc}</div>
              </div>
            </div>
            <div style="font-size:11px; color:#666; margin-top:6px;">
              Sensación ${feels}°C · Humedad ${humidity}%${wind !== null ? ` · Viento ${wind} km/h` : ''}
            </div>
          </div>
        `);
      } catch (err) {
        console.warn('[LiveEvents] OWM error:', err);
        loadingPopup.setContent('<div style="font-size:12px; color:#dc2626;">Error al consultar clima</div>');
      }
    };

    owmClickHandlerRef.current = handler;
    map.on('click', handler);
    return detach;
  }, [map, isActive]);

  if (!isActive) return null;

  return (
    <>
      {events.loading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-background/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs font-medium">Cargando incendios...</span>
        </div>
      )}

    </>
  );
};

export default LiveEventsMapView;
