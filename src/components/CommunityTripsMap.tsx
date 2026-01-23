// Real-time map displaying all active community trips with current speed

import React, { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Car, Plane, Navigation, Clock, Gauge, MapPin, Users, RefreshCw, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type ActiveTrip } from '@/hooks/useActiveTrips';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { GeoPosition } from '@/types';

interface CommunityTripsMapProps {
  trips: ActiveTrip[];
  loading?: boolean;
  onRefresh?: () => void;
  /** Current user's location to show on the map */
  userLocation?: GeoPosition | null;
}

// Create custom marker for each traveler
function createTravelerMarker(trip: ActiveTrip): L.DivIcon {
  const nickname = trip.nickname || 'Viajero';
  const initial = nickname.charAt(0).toUpperCase();
  const emoji = trip.transit_type === 'FLIGHT' ? '✈️' : '🚗';
  
  // Check if position is estimated
  const isEstimated = trip.is_position_estimated || false;
  const estimatedPosition = trip.estimated_position;
  
  // Check if location is stale
  let staleMinutes = 0;
  if (trip.location_updated_at) {
    const updatedDate = new Date(trip.location_updated_at);
    const now = new Date();
    const diffMs = now.getTime() - updatedDate.getTime();
    staleMinutes = Math.floor(diffMs / (1000 * 60));
  }
  
  // Stale status levels
  const isLocationStale = staleMinutes >= 5;
  const isSignalLost = staleMinutes >= 10;
  const isCriticallyStale = staleMinutes >= 30;
  
  // Only show speed if location is fresh
  const rawSpeedKmh = trip.current_speed ? Math.round(trip.current_speed * 3.6) : 0;
  const speedKmh = isLocationStale ? 0 : rawSpeedKmh;
  const isMoving = !isLocationStale && speedKmh > 5;
  
  // Color based on status - blue for estimated position
  let bgColor = isMoving ? '#22c55e' : '#f59e0b';
  let borderColor = 'white';
  let animation = '';
  
  // Special styling for estimated positions
  if (isEstimated && estimatedPosition) {
    bgColor = '#8b5cf6'; // Purple for estimated
    borderColor = '#c4b5fd';
    animation = 'animation: pulse-estimated 2s ease-in-out infinite;';
  } else if (isCriticallyStale) {
    bgColor = '#ef4444'; // Red for critical
    borderColor = '#fca5a5';
    animation = 'animation: pulse-signal-lost 1s ease-in-out infinite;';
  } else if (isSignalLost) {
    bgColor = '#f97316'; // Orange for signal lost
    borderColor = '#fdba74';
    animation = 'animation: pulse-signal-warning 1.5s ease-in-out infinite;';
  }
  
  // Badge content - show estimation info if estimated
  let speedBadgeContent: string;
  if (isEstimated && estimatedPosition) {
    const avgSpeed = estimatedPosition.averageSpeedKmh;
    const confidence = estimatedPosition.confidenceLevel;
    const confidenceEmoji = confidence === 'high' ? '✓' : (confidence === 'medium' ? '~' : '?');
    speedBadgeContent = `📍 ~${avgSpeed} km/h ${confidenceEmoji}`;
  } else if (isSignalLost) {
    speedBadgeContent = `📡 ${staleMinutes >= 60 ? `${Math.floor(staleMinutes / 60)}h` : `${staleMinutes}m`}`;
  } else if (isLocationStale) {
    speedBadgeContent = `⏱ ${staleMinutes}m`;
  } else {
    speedBadgeContent = `${speedKmh} km/h`;
  }
  
  return L.divIcon({
    className: `custom-traveler-marker ${isSignalLost ? 'signal-lost' : ''}`,
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
        position: relative;
      ">
        ${isSignalLost ? `
          <div style="
            position: absolute;
            top: 24px;
            width: 52px;
            height: 52px;
            background: ${isCriticallyStale ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.3)'};
            border-radius: 50%;
            animation: pulse-signal-lost-outer 1.2s ease-out infinite;
          "></div>
        ` : ''}
        <div style="
          background: ${bgColor};
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: ${isSignalLost ? `0 0 12px ${bgColor}` : '0 2px 8px rgba(0,0,0,0.3)'};
          margin-bottom: 4px;
          border: ${isSignalLost ? `2px solid ${borderColor}` : 'none'};
          ${isSignalLost ? 'animation: pulse-badge 1s ease-in-out infinite;' : ''}
        ">
          ${speedBadgeContent}
        </div>
        <div style="
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8));
          border: 3px solid ${borderColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: ${isSignalLost ? `0 0 15px ${bgColor}` : '0 3px 10px rgba(0,0,0,0.3)'};
          ${isLocationStale && !isSignalLost ? 'opacity: 0.7;' : ''}
          ${animation}
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
        ${isEstimated && estimatedPosition ? `
          <div style="
            position: absolute;
            bottom: -16px;
            background: #8b5cf6;
            color: white;
            font-size: 8px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 2px;
          ">
            📍 Pos. estimada
          </div>
        ` : (isSignalLost ? `
          <div style="
            position: absolute;
            bottom: -16px;
            background: ${isCriticallyStale ? '#ef4444' : '#f97316'};
            color: white;
            font-size: 8px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">
            ${isCriticallyStale ? '⚠️ Sin señal' : '📡 Señal débil'}
          </div>
        ` : '')}
      </div>
      <style>
        @keyframes pulse-estimated {
          0%, 100% { 
            box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3);
            opacity: 1;
          }
          50% { 
            box-shadow: 0 0 0 8px rgba(139, 92, 246, 0.2), 0 2px 8px rgba(0,0,0,0.3);
            opacity: 0.85;
          }
        }
      </style>
    `,
    iconSize: [80, (isSignalLost || isEstimated) ? 120 : 80],
    iconAnchor: [40, (isSignalLost || isEstimated) ? 100 : 80],
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

// Create current user location marker
function createCurrentLocationMarker(): L.DivIcon {
  return L.divIcon({
    className: 'custom-current-location-marker',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -50%);
      ">
        <div style="
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3);
          animation: pulse-location 2s ease-in-out infinite;
        "></div>
        <div style="
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
          margin-top: 4px;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">
          📍 Yo
        </div>
      </div>
      <style>
        @keyframes pulse-location {
          0%, 100% { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(0,0,0,0.3); }
        }
      </style>
    `,
    iconSize: [60, 50],
    iconAnchor: [30, 25],
  });
}

export const CommunityTripsMap: React.FC<CommunityTripsMapProps> = ({
  trips,
  loading = false,
  onRefresh,
  userLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const linesRef = useRef<Map<string, L.Polyline>>(new Map());
  const estimationLinesRef = useRef<Map<string, L.Polyline>>(new Map()); // Lines from real to estimated position
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const hasInitializedBounds = useRef(false);
  
  // Track if user is manually interacting with the map
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  // Filter trips that have current location (or display location if estimated)
  const tripsWithLocation = useMemo(() => {
    return trips.filter(t => (t.display_lat && t.display_lng) || (t.current_lat && t.current_lng));
  }, [trips]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center on Mexico by default
    const defaultCenter: L.LatLngExpression = [23.6345, -102.5528];
    
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 5,
      zoomControl: false,
    });
    
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    // Detect user interaction to prevent auto-centering
    map.on('dragstart', () => {
      setIsUserInteracting(true);
    });
    
    map.on('zoomstart', () => {
      setIsUserInteracting(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      hasInitializedBounds.current = false;
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

    // Remove estimation lines for inactive trips
    estimationLinesRef.current.forEach((line, tripId) => {
      if (!currentTripIds.has(tripId)) {
        line.remove();
        estimationLinesRef.current.delete(tripId);
      }
    });

    // Add or update markers for each trip
    tripsWithLocation.forEach(trip => {
      if (!trip.current_lat || !trip.current_lng) return;

      // Use display position (estimated if available, otherwise current)
      const displayLat = trip.display_lat ?? trip.current_lat;
      const displayLng = trip.display_lng ?? trip.current_lng;
      const isEstimated = trip.is_position_estimated || false;
      
      const position: L.LatLngExpression = [displayLat, displayLng];
      const realPosition: L.LatLngExpression = [trip.current_lat, trip.current_lng];
      
      // Show estimated speed if position is estimated
      const speedKmh = isEstimated && trip.estimated_position 
        ? trip.estimated_position.averageSpeedKmh 
        : (trip.current_speed ? Math.round(trip.current_speed * 3.6) : 0);
      
      const etaText = trip.dynamic_eta_minutes 
        ? `~${trip.dynamic_eta_minutes} min` 
        : 'Calculando...';
      const distanceText = trip.remaining_distance_km 
        ? `${trip.remaining_distance_km.toFixed(1)} km` 
        : '';

      // Show estimation badge in popup
      const estimationInfo = isEstimated && trip.estimated_position 
        ? `<div style="font-size: 10px; color: #8b5cf6; margin-top: 4px; padding: 4px; background: rgba(139, 92, 246, 0.1); border-radius: 4px;">
             📍 Posición estimada (${trip.estimated_position.estimatedSinceMinutes}min sin señal)<br/>
             Confianza: ${trip.estimated_position.confidenceLevel === 'high' ? 'Alta' : (trip.estimated_position.confidenceLevel === 'medium' ? 'Media' : 'Baja')}
           </div>`
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
              background: ${isEstimated ? '#8b5cf6' : (speedKmh > 5 ? '#22c55e' : '#f59e0b')};
              color: white;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            ">
              ${isEstimated ? `~${speedKmh} km/h` : `${speedKmh} km/h`}
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
          ${estimationInfo}
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

      // Draw line from estimated position to destination
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

      // Draw dotted line from real position to estimated position
      if (isEstimated && trip.estimated_position) {
        const existingEstimationLine = estimationLinesRef.current.get(trip.id);
        
        if (existingEstimationLine) {
          existingEstimationLine.setLatLngs([realPosition, position]);
        } else {
          const estimationLine = L.polyline([realPosition, position], {
            color: '#8b5cf6',
            weight: 3,
            opacity: 0.7,
            dashArray: '4, 8',
          }).addTo(mapRef.current!);
          
          estimationLinesRef.current.set(trip.id, estimationLine);
        }
      } else {
        // Remove estimation line if position is no longer estimated
        const existingEstimationLine = estimationLinesRef.current.get(trip.id);
        if (existingEstimationLine) {
          existingEstimationLine.remove();
          estimationLinesRef.current.delete(trip.id);
        }
      }
    });

    // Only fit bounds on initial load, not on every update (to preserve user zoom/pan)
    if (!hasInitializedBounds.current && !isUserInteracting) {
      const allPoints: L.LatLngTuple[] = tripsWithLocation
        .filter(t => (t.display_lat && t.display_lng) || (t.current_lat && t.current_lng))
        .map(t => [t.display_lat ?? t.current_lat!, t.display_lng ?? t.current_lng!] as L.LatLngTuple);
      
      if (userLocation) {
        allPoints.push([userLocation.lat, userLocation.lng]);
      }
      
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
          hasInitializedBounds.current = true;
        }
      }
    }
  }, [tripsWithLocation, userLocation, isUserInteracting]);

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (userLocation) {
      const position: L.LatLngExpression = [userLocation.lat, userLocation.lng];
      
      // Update or create marker
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setLatLng(position);
      } else {
        userLocationMarkerRef.current = L.marker(position, {
          icon: createCurrentLocationMarker(),
          zIndexOffset: 1000, // Keep user marker on top
        })
          .bindPopup(`
            <div style="text-align: center; font-family: system-ui, sans-serif;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">
                📍 Tu ubicación actual
              </div>
              <div style="font-size: 11px; color: #666;">
                Precisión: ${userLocation.accuracy ? `±${Math.round(userLocation.accuracy)}m` : 'Desconocida'}
              </div>
            </div>
          `)
          .addTo(mapRef.current);
      }
      
      // Update or create accuracy circle
      if (userLocation.accuracy && userLocation.accuracy < 500) {
        if (userAccuracyCircleRef.current) {
          userAccuracyCircleRef.current.setLatLng(position);
          userAccuracyCircleRef.current.setRadius(userLocation.accuracy);
        } else {
          userAccuracyCircleRef.current = L.circle(position, {
            radius: userLocation.accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 1,
          }).addTo(mapRef.current);
        }
      }
      
      // If no trips visible but we have user location, center on user (only on initial load)
      if (tripsWithLocation.length === 0 && !hasInitializedBounds.current && !isUserInteracting) {
        mapRef.current.setView(position, 14);
        hasInitializedBounds.current = true;
      }
    } else {
      // Remove user location marker if no location
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.remove();
        userAccuracyCircleRef.current = null;
      }
    }
  }, [userLocation, tripsWithLocation.length, isUserInteracting]);

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
