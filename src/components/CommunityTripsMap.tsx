// Real-time map displaying all active community trips with current speed

import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Car, Plane, Navigation, Clock, Gauge, MapPin, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type ActiveTrip } from '@/hooks/useActiveTrips';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface CommunityTripsMapProps {
  trips: ActiveTrip[];
  loading?: boolean;
  onRefresh?: () => void;
}

// Create custom marker for each traveler
function createTravelerMarker(trip: ActiveTrip): L.DivIcon {
  const nickname = trip.nickname || 'Viajero';
  const initial = nickname.charAt(0).toUpperCase();
  const emoji = trip.transit_type === 'FLIGHT' ? '✈️' : '🚗';
  
  // Check if location is stale (older than 5 minutes)
  let isLocationStale = false;
  let staleMinutes = 0;
  if (trip.location_updated_at) {
    const updatedDate = new Date(trip.location_updated_at);
    const now = new Date();
    const diffMs = now.getTime() - updatedDate.getTime();
    staleMinutes = Math.floor(diffMs / (1000 * 60));
    isLocationStale = staleMinutes >= 5;
  }
  
  // Only show speed if location is fresh
  const rawSpeedKmh = trip.current_speed ? Math.round(trip.current_speed * 3.6) : 0;
  const speedKmh = isLocationStale ? 0 : rawSpeedKmh;
  const isMoving = !isLocationStale && speedKmh > 5;
  
  // Color: green if moving, amber if stopped/stale, orange if very stale
  let bgColor = isMoving ? '#22c55e' : '#f59e0b';
  if (isLocationStale && staleMinutes >= 30) {
    bgColor = '#f97316'; // Orange for very stale
  }
  
  // Speed badge content - show warning if stale
  const speedBadgeContent = isLocationStale 
    ? `⚠️ ${staleMinutes >= 60 ? `${Math.floor(staleMinutes / 60)}h` : `${staleMinutes}m`}` 
    : `${speedKmh} km/h`;
  
  return L.divIcon({
    className: 'custom-traveler-marker',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
      ">
        <div style="
          background: ${bgColor};
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          margin-bottom: 4px;
        ">
          ${speedBadgeContent}
        </div>
        <div style="
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8));
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          ${isLocationStale ? 'opacity: 0.7;' : ''}
        ">
          ${emoji}
        </div>
        <div style="
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 600;
          margin-top: 2px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">
          ${nickname}
        </div>
      </div>
    `,
    iconSize: [80, 80],
    iconAnchor: [40, 80],
  });
}

// Create destination marker
function createDestinationMarker(): L.DivIcon {
  return L.divIcon({
    className: 'custom-destination-marker',
    html: `
      <div style="
        width: 16px;
        height: 16px;
        background: hsl(var(--destructive));
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export const CommunityTripsMap: React.FC<CommunityTripsMapProps> = ({
  trips,
  loading = false,
  onRefresh,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const linesRef = useRef<Map<string, L.Polyline>>(new Map());

  // Filter trips that have current location
  const tripsWithLocation = useMemo(() => {
    return trips.filter(t => t.current_lat && t.current_lng);
  }, [trips]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center on Mexico by default
    const defaultCenter: L.LatLngExpression = [23.6345, -102.5528];
    
    mapRef.current = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 5,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(mapRef.current);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when trips change
  useEffect(() => {
    if (!mapRef.current) return;

    const currentTripIds = new Set(tripsWithLocation.map(t => t.id));
    
    // Remove markers for trips that are no longer active
    markersRef.current.forEach((marker, tripId) => {
      if (!currentTripIds.has(tripId)) {
        marker.remove();
        markersRef.current.delete(tripId);
      }
    });

    // Remove lines for trips that are no longer active
    linesRef.current.forEach((line, tripId) => {
      if (!currentTripIds.has(tripId)) {
        line.remove();
        linesRef.current.delete(tripId);
      }
    });

    // Add or update markers for each trip
    tripsWithLocation.forEach(trip => {
      if (!trip.current_lat || !trip.current_lng) return;

      const position: L.LatLngExpression = [trip.current_lat, trip.current_lng];
      const speedKmh = trip.current_speed ? Math.round(trip.current_speed * 3.6) : 0;
      const etaText = trip.dynamic_eta_minutes 
        ? `~${trip.dynamic_eta_minutes} min` 
        : 'Calculando...';
      const distanceText = trip.remaining_distance_km 
        ? `${trip.remaining_distance_km.toFixed(1)} km` 
        : '';

      const popupContent = `
        <div style="min-width: 180px; font-family: system-ui, sans-serif;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px;">
            ${trip.transit_type === 'FLIGHT' ? '✈️' : '🚗'} ${trip.nickname || 'Viajero'}
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
            <strong>Origen:</strong> ${trip.origin}
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
            <strong>Destino:</strong> ${trip.destination}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <span style="
              background: ${speedKmh > 5 ? '#22c55e' : '#f59e0b'};
              color: white;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            ">
              ${speedKmh} km/h
            </span>
            ${distanceText ? `
              <span style="
                background: #3b82f6;
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
              ">
                ${distanceText}
              </span>
            ` : ''}
          </div>
          <div style="font-size: 11px; color: #888; margin-top: 8px;">
            ETA: ${etaText}
          </div>
        </div>
      `;

      const existingMarker = markersRef.current.get(trip.id);
      
      if (existingMarker) {
        // Update existing marker position and icon
        existingMarker.setLatLng(position);
        existingMarker.setIcon(createTravelerMarker(trip));
        existingMarker.getPopup()?.setContent(popupContent);
      } else {
        // Create new marker
        const marker = L.marker(position, {
          icon: createTravelerMarker(trip),
        })
          .bindPopup(popupContent)
          .addTo(mapRef.current!);
        
        markersRef.current.set(trip.id, marker);
      }

      // Draw line to destination if available
      if (trip.destination_lat && trip.destination_lng) {
        const destPosition: L.LatLngExpression = [trip.destination_lat, trip.destination_lng];
        const existingLine = linesRef.current.get(trip.id);

        if (existingLine) {
          existingLine.setLatLngs([position, destPosition]);
        } else {
          const line = L.polyline([position, destPosition], {
            color: 'hsl(var(--primary))',
            weight: 2,
            opacity: 0.5,
            dashArray: '8, 8',
          }).addTo(mapRef.current!);
          
          linesRef.current.set(trip.id, line);
        }
      }
    });

    // Fit bounds to show all markers if there are trips
    if (tripsWithLocation.length > 0) {
      const bounds = L.latLngBounds(
        tripsWithLocation
          .filter(t => t.current_lat && t.current_lng)
          .map(t => [t.current_lat!, t.current_lng!] as L.LatLngTuple)
      );
      
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }
  }, [tripsWithLocation]);

  return (
    <div className="flex flex-col h-full">
      {/* Header stats */}
      <div className="flex items-center justify-between p-3 bg-card border-b">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-medium">
            {tripsWithLocation.length} viajero{tripsWithLocation.length !== 1 ? 's' : ''} activo{tripsWithLocation.length !== 1 ? 's' : ''}
          </span>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        )}
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />
        
        {/* Legend */}
        <div className="absolute bottom-16 left-3 bg-card/95 backdrop-blur-sm rounded-lg p-2 shadow-lg z-[1000]">
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>En movimiento</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Detenido</span>
            </div>
          </div>
        </div>

        {/* No trips message */}
        {tripsWithLocation.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <div className="text-center p-6">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No hay viajeros activos con ubicación compartida
              </p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && trips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Cargando viajes...</p>
            </div>
          </div>
        )}
      </div>

      {/* Trip list at bottom */}
      {tripsWithLocation.length > 0 && (
        <div className="border-t bg-card max-h-32 overflow-y-auto">
          <div className="divide-y">
            {tripsWithLocation.map(trip => {
              const speedKmh = trip.current_speed ? Math.round(trip.current_speed * 3.6) : 0;
              const isMoving = speedKmh > 5;
              
              return (
                <div 
                  key={trip.id}
                  className="flex items-center justify-between p-2 hover:bg-accent/50 cursor-pointer"
                  onClick={() => {
                    if (mapRef.current && trip.current_lat && trip.current_lng) {
                      mapRef.current.setView([trip.current_lat, trip.current_lng], 14);
                      const marker = markersRef.current.get(trip.id);
                      marker?.openPopup();
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">
                      {trip.transit_type === 'FLIGHT' ? '✈️' : '🚗'}
                    </span>
                    <div className="truncate">
                      <div className="font-medium text-sm truncate">
                        {trip.nickname || 'Viajero'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        → {trip.destination}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge 
                      variant={isMoving ? 'default' : 'secondary'}
                      className={isMoving ? 'bg-green-500' : 'bg-amber-500'}
                    >
                      <Gauge className="h-3 w-3 mr-1" />
                      {speedKmh} km/h
                    </Badge>
                    {trip.dynamic_eta_minutes && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {trip.dynamic_eta_minutes}m
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityTripsMap;
