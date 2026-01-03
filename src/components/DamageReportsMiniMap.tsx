// Mini-map showing damage report locations for a specific earthquake
// Displays when there are multiple damage reports to visualize affected areas

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, MapPin, Maximize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuakeCheckinMap } from './QuakeCheckinMap';

interface DamageReport {
  id: string;
  lat: number;
  lng: number;
  created_at: string;
}

interface DamageReportsMiniMapProps {
  eventId: string;
  epicenterLat: number;
  epicenterLng: number;
  magnitude: number;
  damageCount: number;
  className?: string;
}

export const DamageReportsMiniMap: React.FC<DamageReportsMiniMapProps> = ({
  eventId,
  epicenterLat,
  epicenterLng,
  magnitude,
  damageCount,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const initializedRef = useRef(false);
  
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullMap, setShowFullMap] = useState(false);

  // Fetch damage reports for this earthquake
  useEffect(() => {
    const fetchDamageReports = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('quake_checkins')
          .select('id, lat, lng, created_at')
          .eq('usgs_event_id', eventId)
          .eq('damage_report', 'DAMAGE')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDamageReports(data || []);
      } catch (err) {
        console.error('Error fetching damage reports:', err);
      } finally {
        setLoading(false);
      }
    };

    if (damageCount >= 2) {
      fetchDamageReports();
    }
  }, [eventId, damageCount]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || initializedRef.current || loading || damageReports.length === 0) return;

    initializedRef.current = true;

    const map = L.map(mapContainerRef.current, {
      center: [epicenterLat, epicenterLng],
      zoom: 9,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    });

    mapRef.current = map;

    // Add tile layer - dark style for contrast
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Create markers layer group
    markersLayerRef.current = L.layerGroup().addTo(map);

    // Add epicenter marker (subtle)
    const epicenterIcon = L.divIcon({
      className: 'epicenter-mini-marker',
      html: `
        <div class="w-4 h-4 bg-warning/80 rounded-full border border-white/50 flex items-center justify-center">
          <span class="text-[8px] text-white font-bold">⭐</span>
        </div>
      `,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    L.marker([epicenterLat, epicenterLng], { icon: epicenterIcon }).addTo(map);

    // Add damage report markers
    const allPoints: [number, number][] = [[epicenterLat, epicenterLng]];

    damageReports.forEach((report) => {
      const icon = L.divIcon({
        className: 'damage-mini-marker',
        html: `
          <div class="relative">
            <div class="w-5 h-5 bg-destructive rounded-full flex items-center justify-center shadow-lg border border-white animate-pulse">
              <span class="text-white text-[10px] font-bold">⚠</span>
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      L.marker([report.lat, report.lng], { icon }).addTo(markersLayerRef.current!);
      allPoints.push([report.lat, report.lng]);
    });

    // Fit bounds to show all markers
    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Invalidate size after a small delay
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [damageReports, epicenterLat, epicenterLng, loading]);

  // Don't render if not enough damage reports
  if (damageCount < 2) return null;

  return (
    <>
      <div 
        className={cn(
          "relative rounded-lg overflow-hidden border-2 border-destructive/50 bg-destructive/5 cursor-pointer transition-all hover:border-destructive hover:shadow-lg hover:shadow-destructive/20",
          className
        )}
        onClick={() => setShowFullMap(true)}
      >
        {/* Header with alert */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-destructive/90 to-transparent p-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-white animate-pulse" />
          <span className="text-xs font-bold text-white">
            {damageCount} reportes de daños
          </span>
        </div>

        {/* Map container */}
        <div className="h-28 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center bg-muted">
              <Loader2 className="w-5 h-5 animate-spin text-destructive" />
            </div>
          ) : damageReports.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
              Cargando ubicaciones...
            </div>
          ) : (
            <div ref={mapContainerRef} className="h-full w-full" />
          )}
        </div>

        {/* Footer with expand hint */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-background/90 to-transparent p-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-destructive" />
            <span className="text-[10px] text-muted-foreground">
              Ver zonas afectadas
            </span>
          </div>
          <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Full map dialog */}
      <Dialog open={showFullMap} onOpenChange={setShowFullMap}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Reportes de Daños - M{magnitude.toFixed(1)}
            </DialogTitle>
          </DialogHeader>
          <QuakeCheckinMap
            eventId={eventId}
            epicenterLat={epicenterLat}
            epicenterLng={epicenterLng}
            magnitude={magnitude}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
