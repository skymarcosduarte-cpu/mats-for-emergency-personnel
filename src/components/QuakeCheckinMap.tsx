// Quake Checkin Map - Shows intensity reports on a map
// Colors markers by intensity level for quick visual analysis

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuakeCheckins, QuakeCheckin, QuakeCheckinStats } from '@/hooks/useQuakeCheckins';
import { Loader2, Users, AlertTriangle, CheckCircle, HelpCircle, RefreshCw, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface QuakeCheckinMapProps {
  eventId: string;
  epicenterLat: number;
  epicenterLng: number;
  magnitude: number;
  className?: string;
}

// Get color based on damage status only
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'OK': return '#22c55e'; // green - all good
    case 'UNSURE': return '#eab308'; // yellow - uncertain
    case 'DAMAGE': return '#ef4444'; // red - damage reported
    default: return '#6b7280';
  }
};

export const QuakeCheckinMap: React.FC<QuakeCheckinMapProps> = ({
  eventId,
  epicenterLat,
  epicenterLng,
  magnitude,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [selectedCheckin, setSelectedCheckin] = useState<QuakeCheckin | null>(null);

  const { checkins, stats, loading, error, refresh } = useQuakeCheckins(eventId);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [epicenterLat, epicenterLng],
      zoom: 8,
      zoomControl: true,
      attributionControl: false,
    });

    mapRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Create markers layer group
    markersLayerRef.current = L.layerGroup().addTo(map);

    // Add epicenter marker
    const epicenterIcon = L.divIcon({
      className: 'epicenter-marker',
      html: `
        <div class="relative animate-pulse">
          <div class="w-10 h-10 bg-destructive/80 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <span class="text-white font-bold text-sm">M${magnitude.toFixed(1)}</span>
          </div>
          <div class="absolute inset-0 w-10 h-10 bg-destructive/30 rounded-full animate-ping"></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker([epicenterLat, epicenterLng], { icon: epicenterIcon })
      .addTo(map)
      .bindTooltip('Epicentro', { permanent: false, direction: 'top' });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [epicenterLat, epicenterLng, magnitude]);

  // Update markers when checkins change
  useEffect(() => {
    if (!markersLayerRef.current || !mapRef.current) return;

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    // Add checkin markers
    checkins.forEach((checkin) => {
      const statusColor = getStatusColor(checkin.damage_report);
      const statusIcon = checkin.damage_report === 'OK' ? '✓' : 
                         checkin.damage_report === 'UNSURE' ? '?' : '⚠';
      
      const icon = L.divIcon({
        className: 'checkin-marker',
        html: `
          <div class="relative group cursor-pointer">
            <div 
              class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-transform hover:scale-110"
              style="background-color: ${statusColor};"
            >
              <span class="text-white font-bold text-sm">${statusIcon}</span>
            </div>
            ${checkin.damage_report === 'DAMAGE' ? `
              <div class="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full border border-white animate-pulse"></div>
            ` : ''}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([checkin.lat, checkin.lng], { icon })
        .addTo(markersLayerRef.current!);

      marker.on('click', () => {
        setSelectedCheckin(checkin);
      });

      // Tooltip with info
      const timeAgo = formatDistanceToNow(new Date(checkin.created_at), { 
        addSuffix: true, 
        locale: es 
      });
      marker.bindTooltip(`
        Estado: ${checkin.damage_report === 'OK' ? 'Todo bien' : checkin.damage_report === 'UNSURE' ? 'No seguro' : 'Reporta daños'}<br/>
        ${timeAgo}
      `, { direction: 'top' });
    });

    // Fit bounds if we have checkins
    if (checkins.length > 0) {
      const allPoints: [number, number][] = [
        [epicenterLat, epicenterLng],
        ...checkins.map(c => [c.lat, c.lng] as [number, number]),
      ];
      const bounds = L.latLngBounds(allPoints);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [checkins, epicenterLat, epicenterLng]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Stats bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {stats ? `${stats.total} reportes` : 'Sin reportes'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Status breakdown */}
      {stats && (
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-safe" />
            <span>{stats.byStatus.OK} bien</span>
          </div>
          <div className="flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-warning" />
            <span>{stats.byStatus.UNSURE} no seguro</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-destructive" />
            <span>{stats.byStatus.DAMAGE} daños</span>
          </div>
        </div>
      )}

      {/* Map container */}
      <div className="relative w-full h-64 rounded-lg overflow-hidden border border-border">
        {loading && checkins.length === 0 && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
        <div ref={mapContainerRef} className="absolute inset-0" />
      </div>

      {/* Status legend */}
      <div className="flex items-center gap-3 py-1">
        <span className="text-xs text-muted-foreground shrink-0">Estado:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-safe flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">✓</span>
          </div>
          <span className="text-xs">Bien</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-warning flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">?</span>
          </div>
          <span className="text-xs">No seguro</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">⚠</span>
          </div>
          <span className="text-xs">Daños</span>
        </div>
      </div>

      {/* Selected checkin details */}
      {selectedCheckin && (
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <div className="flex items-start justify-between mb-2">
            <Badge
              variant={
                selectedCheckin.damage_report === 'OK' ? 'default' :
                selectedCheckin.damage_report === 'UNSURE' ? 'secondary' : 'destructive'
              }
            >
              {selectedCheckin.damage_report === 'OK' ? 'Todo bien' :
               selectedCheckin.damage_report === 'UNSURE' ? 'No estoy seguro' : 'Reporta daños'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSelectedCheckin(null)}
            >
              ×
            </Button>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xs">
              {formatDistanceToNow(new Date(selectedCheckin.created_at), { 
                addSuffix: true, 
                locale: es 
              })}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{selectedCheckin.lat.toFixed(4)}, {selectedCheckin.lng.toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
