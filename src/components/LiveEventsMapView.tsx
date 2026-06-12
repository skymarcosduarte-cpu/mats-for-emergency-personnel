// Live Events Map View — minimal version
// Only renders NASA FIRMS fire hotspots. Other layers (radar, clouds, USGS, SMN, SSN,
// cyclones) have been removed per product decision. User trips ("viajes de usuarios")
// continue to render via their own component on the map.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Loader2, Flame, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FireHotspot } from '@/hooks/useMexicoAlerts';

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

export const LiveEventsMapView: React.FC<LiveEventsMapViewProps> = ({
  map,
  isActive,
}) => {
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [showFires, setShowFires] = useState(true);
  const [events, setEvents] = useState<EventsState>({
    fires: [],
    loading: false,
    lastUpdate: null,
  });

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

  // Clear markers when view becomes inactive
  useEffect(() => {
    if (!isActive && map) {
      markersRef.current.forEach((marker) => map.removeLayer(marker));
      markersRef.current.clear();
    }
  }, [isActive, map]);

  // Update fire markers
  useEffect(() => {
    if (!map || !isActive) return;

    markersRef.current.forEach((marker) => map.removeLayer(marker));
    markersRef.current.clear();

    if (showFires) {
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
    }
  }, [map, isActive, events, showFires]);

  if (!isActive) return null;

  return (
    <>
      {events.loading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-background/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs font-medium">Cargando incendios...</span>
        </div>
      )}

      {/* FIRMS toggle */}
      {!events.loading && (
        <div className="absolute top-16 right-2 z-[1000] flex flex-col items-end gap-1">
          <button
            onClick={() => setShowFires(!showFires)}
            className={cn(
              'rounded-lg px-2.5 py-2 shadow-lg border transition-colors flex items-center gap-1.5',
              showFires
                ? 'bg-orange-600/90 text-white border-orange-500'
                : 'bg-background/90 text-muted-foreground border-border'
            )}
            title={showFires ? 'Ocultar incendios NASA FIRMS' : 'Mostrar incendios NASA FIRMS'}
          >
            <Flame className="w-4 h-4" />
            <span className="text-xs font-medium">🔥 NASA</span>
          </button>
        </div>
      )}

      {/* Stats bar */}
      {!events.loading && events.lastUpdate && (
        <div className="absolute bottom-20 left-2 right-2 z-[1000] flex items-center justify-between bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="flex items-center gap-1">
              <span className="text-orange-500">🔥</span>
              {events.fires.length} NASA FIRMS
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={fetchAllEvents}
            disabled={events.loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', events.loading && 'animate-spin')} />
          </Button>
        </div>
      )}
    </>
  );
};

export default LiveEventsMapView;
