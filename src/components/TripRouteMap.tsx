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

// Component to fit bounds
function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] });
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

  // Calculate bounds
  const bounds = useMemo(() => {
    const allPoints: [number, number][] = [...routeCoordinates];
    
    if (originCoords) {
      allPoints.push([originCoords.lat, originCoords.lng]);
    }
    if (destinationCoords) {
      allPoints.push([destinationCoords.lat, destinationCoords.lng]);
    }
    if (currentPosition) {
      allPoints.push([currentPosition.lat, currentPosition.lng]);
    }

    if (allPoints.length === 0) return null;

    return L.latLngBounds(allPoints.map(([lat, lng]) => [lat, lng]));
  }, [routeCoordinates, originCoords, destinationCoords, currentPosition]);

  // Default center if no data
  const defaultCenter: [number, number] = useMemo(() => {
    if (currentPosition) return [currentPosition.lat, currentPosition.lng];
    if (originCoords) return [originCoords.lat, originCoords.lng];
    if (routeCoordinates.length > 0) return routeCoordinates[0];
    return [19.4326, -99.1332]; // Mexico City default
  }, [currentPosition, originCoords, routeCoordinates]);

  if (routeCoordinates.length === 0 && !originCoords && !destinationCoords && !currentPosition) {
    return (
      <div 
        className={cn("flex items-center justify-center bg-muted rounded-lg", className)}
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <Navigation className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay datos de ruta disponibles</p>
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
        {routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates}
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
        {originCoords && (
          <Marker 
            position={[originCoords.lat, originCoords.lng]} 
            icon={originIcon}
          >
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
        {destinationCoords && (
          <Marker 
            position={[destinationCoords.lat, destinationCoords.lng]} 
            icon={destinationIcon}
          >
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
        {currentPosition && (
          <Marker 
            position={[currentPosition.lat, currentPosition.lng]} 
            icon={currentIcon}
          >
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
