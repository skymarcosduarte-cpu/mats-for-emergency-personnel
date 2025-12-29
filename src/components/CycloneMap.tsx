// Cyclone Map component - shows active tropical cyclones from NHC
// Uses Leaflet to display cyclone positions with custom markers

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Expand, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { NOAAAlert } from '@/hooks/useWeatherAlerts';

interface CycloneMapProps {
  alerts: NOAAAlert[];
  userLat?: number;
  userLng?: number;
  className?: string;
}

// Get cyclone category color
const getCycloneColor = (severity: NOAAAlert['severity']) => {
  switch (severity) {
    case 'Extreme': return '#dc2626'; // red
    case 'Severe': return '#f97316'; // orange
    case 'Moderate': return '#eab308'; // yellow
    default: return '#6b7280'; // gray
  }
};

// Create cyclone marker icon
const createCycloneIcon = (severity: NOAAAlert['severity'], label: string) => {
  const color = getCycloneColor(severity);
  return L.divIcon({
    className: 'cyclone-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse" style="background-color: ${color}">
          <span class="text-lg">🌀</span>
        </div>
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-semibold">
          ${label}
        </div>
      </div>
    `,
    iconSize: [40, 60],
    iconAnchor: [20, 20],
  });
};

// Create user location marker
const createUserIcon = () => {
  return L.divIcon({
    className: 'user-marker',
    html: `
      <div class="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg">
        <div class="absolute inset-0 bg-primary rounded-full animate-ping opacity-50"></div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

export const CycloneMap: React.FC<CycloneMapProps> = ({
  alerts,
  userLat,
  userLng,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fullMapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const fullMapRef = useRef<L.Map | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<NOAAAlert | null>(null);

  // Filter alerts that have coordinates
  const alertsWithCoords = useMemo(() => 
    alerts.filter(a => a.coordinates !== null),
    [alerts]
  );

  // Calculate map center and bounds
  const mapConfig = useMemo(() => {
    if (alertsWithCoords.length === 0) {
      // Default to Gulf of Mexico / Caribbean region
      return {
        center: [23, -90] as [number, number],
        zoom: 4,
      };
    }

    // Calculate center from all cyclone positions
    const lats = alertsWithCoords.map(a => a.coordinates![0]);
    const lngs = alertsWithCoords.map(a => a.coordinates![1]);
    const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    return {
      center: [centerLat, centerLng] as [number, number],
      zoom: 4,
    };
  }, [alertsWithCoords]);

  // Initialize mini map
  useEffect(() => {
    if (!mapContainerRef.current || isExpanded) return;

    const map = L.map(mapContainerRef.current, {
      center: mapConfig.center,
      zoom: mapConfig.zoom,
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false,
    });

    mapRef.current = map;

    // Add dark tile layer for better cyclone visibility
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Add cyclone markers
    alertsWithCoords.forEach((alert) => {
      if (!alert.coordinates) return;
      
      const label = alert.event.split(' ')[0] || '🌀';
      const icon = createCycloneIcon(alert.severity, label);
      
      L.marker([alert.coordinates[0], alert.coordinates[1]], { icon })
        .addTo(map);
    });

    // Add user location if available
    if (userLat && userLng) {
      L.marker([userLat, userLng], { icon: createUserIcon() }).addTo(map);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapConfig, alertsWithCoords, userLat, userLng, isExpanded]);

  // Initialize fullscreen map
  useEffect(() => {
    if (!fullMapContainerRef.current || !isExpanded) return;

    const map = L.map(fullMapContainerRef.current, {
      center: mapConfig.center,
      zoom: mapConfig.zoom,
      zoomControl: true,
      attributionControl: false,
    });

    fullMapRef.current = map;

    // Add dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Add cyclone markers with click handlers
    alertsWithCoords.forEach((alert) => {
      if (!alert.coordinates) return;
      
      const label = alert.event.split(' ')[0] || '🌀';
      const icon = createCycloneIcon(alert.severity, label);
      
      const marker = L.marker([alert.coordinates[0], alert.coordinates[1]], { icon })
        .addTo(map);
      
      marker.on('click', () => {
        setSelectedAlert(alert);
      });

      // Add popup
      marker.bindPopup(`
        <div class="text-sm">
          <strong>${alert.event}</strong><br/>
          <span class="text-xs">${alert.senderName}</span>
        </div>
      `);
    });

    // Add user location if available
    if (userLat && userLng) {
      const userMarker = L.marker([userLat, userLng], { icon: createUserIcon() }).addTo(map);
      userMarker.bindPopup('<strong>Tu ubicación</strong>');
    }

    // Fit bounds to show all markers
    if (alertsWithCoords.length > 0) {
      const bounds = L.latLngBounds(
        alertsWithCoords.map(a => [a.coordinates![0], a.coordinates![1]] as [number, number])
      );
      if (userLat && userLng) {
        bounds.extend([userLat, userLng]);
      }
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      if (fullMapRef.current) {
        fullMapRef.current.remove();
        fullMapRef.current = null;
      }
    };
  }, [mapConfig, alertsWithCoords, userLat, userLng, isExpanded]);

  if (alertsWithCoords.length === 0) {
    return null;
  }

  return (
    <>
      {/* Mini map preview */}
      <div 
        className={`relative w-full h-40 rounded-lg overflow-hidden cursor-pointer group border border-border ${className}`}
        onClick={() => setIsExpanded(true)}
      >
        <div ref={mapContainerRef} className="absolute inset-0" />
        
        {/* Cyclone count badge */}
        <div className="absolute top-2 left-2 bg-card/90 backdrop-blur-sm rounded-md px-2 py-1 flex items-center gap-1.5">
          <span className="text-lg">🌀</span>
          <span className="text-xs font-semibold text-foreground">
            {alertsWithCoords.length} ciclón{alertsWithCoords.length !== 1 ? 'es' : ''} activo{alertsWithCoords.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Expand overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="bg-card/90 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            <Expand className="w-5 h-5 text-foreground" />
          </div>
        </div>
        
        {/* Tap hint */}
        <div className="absolute bottom-2 right-2 bg-card/90 backdrop-blur-sm rounded-md px-2 py-1 text-xs text-muted-foreground flex items-center gap-1">
          <Expand className="w-3 h-3" />
          Ampliar
        </div>
      </div>

      {/* Fullscreen map dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 bg-card border-border">
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-card to-transparent p-4">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <span className="text-xl">🌀</span>
              Ciclones Tropicales Activos - NHC
            </DialogTitle>
          </DialogHeader>
          
          <div ref={fullMapContainerRef} className="w-full h-full rounded-lg" />
          
          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border">
            <p className="text-xs font-semibold text-foreground mb-2">Severidad</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-xs text-muted-foreground">Extremo (Cat 4-5)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-panic" />
                <span className="text-xs text-muted-foreground">Severo (Cat 2-3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-xs text-muted-foreground">Moderado (Cat 1 / TS)</span>
              </div>
            </div>
          </div>

          {/* Selected alert info */}
          {selectedAlert && (
            <div className="absolute bottom-4 right-4 max-w-xs bg-card/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-border">
              <button
                onClick={() => setSelectedAlert(null)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="font-semibold text-foreground pr-6">{selectedAlert.event}</h3>
              <p className="text-xs text-muted-foreground mt-1">{selectedAlert.senderName}</p>
              <p className="text-sm text-foreground mt-2 line-clamp-4">{selectedAlert.headline}</p>
              {selectedAlert.distanceKm !== null && (
                <Badge variant="outline" className="mt-2">
                  {selectedAlert.distanceKm.toFixed(0)} km de ti
                </Badge>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
