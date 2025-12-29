import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Flag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface TripRouteMapProps {
  routeCoordinates: [number, number][];
  originCoords?: { lat: number; lng: number } | null;
  destinationCoords?: { lat: number; lng: number } | null;
  currentPosition?: { lat: number; lng: number } | null;
  originName?: string;
  destinationName?: string;
  className?: string;
  height?: string;
}

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const isValidLatLng = (lat: unknown, lng: unknown) =>
  isFiniteNumber(lat) &&
  isFiniteNumber(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

// Custom icons
const createIcon = (color: string, size: number = 24) => {
  return L.divIcon({
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const originIcon = createIcon('#22c55e', 20); // Green for origin
const destinationIcon = createIcon('#ef4444', 20); // Red for destination
const currentIcon = createIcon('#3b82f6', 24); // Blue for current position

// Component to fit bounds safely
function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;
    
    try {
      // Double-check validity before calling fitBounds
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
      }
    } catch (err) {
      console.warn('[FitBounds] Error fitting bounds:', err);
    }
  }, [map, bounds]);

  return null;
}

// Component to track when map is ready
function MapReadyHandler({ onReady }: { onReady: () => void }) {
  const map = useMap();

  useEffect(() => {
    // Wait for tiles to start loading, then mark as ready
    const handleLoad = () => {
      onReady();
    };
    
    // Mark ready after a short delay to ensure map container is visible
    const timeout = setTimeout(handleLoad, 300);
    
    map.on('load', handleLoad);
    
    return () => {
      clearTimeout(timeout);
      map.off('load', handleLoad);
    };
  }, [map, onReady]);

  return null;
}

export default function TripRouteMap({
  routeCoordinates,
  originCoords,
  destinationCoords,
  currentPosition,
  originName = 'Origen',
  destinationName = 'Destino',
  className,
  height = '300px',
}: TripRouteMapProps) {
  const [isMapReady, setIsMapReady] = useState(false);

  const safeRouteCoordinates = useMemo(() => {
    const input = routeCoordinates ?? [];
    const filtered = input.filter(([lat, lng]) => isValidLatLng(lat, lng));

    if (filtered.length !== input.length) {
      console.warn('[TripRouteMap] Dropped invalid route points', {
        total: input.length,
        valid: filtered.length,
      });
    }

    return filtered;
  }, [routeCoordinates]);

  const safeOrigin = useMemo(
    () => (originCoords && isValidLatLng(originCoords.lat, originCoords.lng) ? originCoords : null),
    [originCoords]
  );

  const safeDestination = useMemo(
    () =>
      destinationCoords && isValidLatLng(destinationCoords.lat, destinationCoords.lng)
        ? destinationCoords
        : null,
    [destinationCoords]
  );

  const safeCurrent = useMemo(
    () => (currentPosition && isValidLatLng(currentPosition.lat, currentPosition.lng) ? currentPosition : null),
    [currentPosition]
  );

  // Calculate bounds - need at least 2 points for valid bounds
  const bounds = useMemo(() => {
    const allPoints: [number, number][] = [...safeRouteCoordinates];

    if (safeOrigin) {
      allPoints.push([safeOrigin.lat, safeOrigin.lng]);
    }
    if (safeDestination) {
      allPoints.push([safeDestination.lat, safeDestination.lng]);
    }
    if (safeCurrent) {
      allPoints.push([safeCurrent.lat, safeCurrent.lng]);
    }

    // Need at least 2 distinct points to create valid bounds
    if (allPoints.length < 2) return null;

    try {
      const latLngs = allPoints.map(([lat, lng]) => L.latLng(lat, lng));
      const b = L.latLngBounds(latLngs);
      return b.isValid() ? b : null;
    } catch (err) {
      console.warn('[TripRouteMap] Error creating bounds:', err);
      return null;
    }
  }, [safeRouteCoordinates, safeOrigin, safeDestination, safeCurrent]);

  // Default center if no data
  const defaultCenter: [number, number] = useMemo(() => {
    if (safeCurrent) return [safeCurrent.lat, safeCurrent.lng];
    if (safeOrigin) return [safeOrigin.lat, safeOrigin.lng];
    if (safeRouteCoordinates.length > 0) return safeRouteCoordinates[0];
    return [19.4326, -99.1332]; // Mexico City default
  }, [safeCurrent, safeOrigin, safeRouteCoordinates]);

  if (
    safeRouteCoordinates.length === 0 &&
    !safeOrigin &&
    !safeDestination &&
    !safeCurrent
  ) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded-lg", className)} style={{ height }}>
        <div className="text-center text-muted-foreground">
          <Navigation className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay datos de ubicación válidos</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg overflow-hidden border relative", className)} style={{ height, background: 'hsl(var(--muted))' }}>
      {/* Loading overlay */}
      {!isMapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs">Cargando mapa...</span>
          </div>
        </div>
      )}
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Traveled route polyline */}
        {safeRouteCoordinates.length > 1 && (
          <Polyline
            positions={safeRouteCoordinates}
            pathOptions={{
              color: '#3b82f6',
              weight: 4,
              opacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Origin marker */}
        {safeOrigin && (
          <Marker position={[safeOrigin.lat, safeOrigin.lng]} icon={originIcon}>
            <Popup>
              <div className="text-center">
                <MapPin className="w-4 h-4 inline mr-1 text-safe" />
                <strong>Origen</strong>
                <p className="text-sm text-muted-foreground">{originName}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination marker */}
        {safeDestination && (
          <Marker position={[safeDestination.lat, safeDestination.lng]} icon={destinationIcon}>
            <Popup>
              <div className="text-center">
                <Flag className="w-4 h-4 inline mr-1 text-destructive" />
                <strong>Destino</strong>
                <p className="text-sm text-muted-foreground">{destinationName}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Current position marker */}
        {safeCurrent && (
          <Marker position={[safeCurrent.lat, safeCurrent.lng]} icon={currentIcon}>
            <Popup>
              <div className="text-center">
                <Navigation className="w-4 h-4 inline mr-1 text-primary" />
                <strong>Posición actual</strong>
              </div>
            </Popup>
          </Marker>
        )}

        <FitBounds bounds={bounds} />
        <MapReadyHandler onReady={() => setIsMapReady(true)} />
      </MapContainer>
    </div>
  );
}
