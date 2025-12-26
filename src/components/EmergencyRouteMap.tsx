// Emergency Route Map Component
// Shows route from responder to emergency location

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Navigation, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

interface EmergencyRouteMapProps {
  responderLat: number;
  responderLng: number;
  emergencyLat: number;
  emergencyLng: number;
  onClose?: () => void;
  className?: string;
}

interface RouteInfo {
  distance: number; // in km
  duration: number; // in minutes
}

export const EmergencyRouteMap: React.FC<EmergencyRouteMapProps> = ({
  responderLat,
  responderLng,
  emergencyLat,
  emergencyLng,
  onClose,
  className,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const responderMarkerRef = useRef<L.Marker | null>(null);
  const emergencyMarkerRef = useRef<L.Marker | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Create emergency icon
  const createEmergencyIcon = () => L.divIcon({
    className: 'emergency-marker',
    html: `
      <div style="
        width: 44px;
        height: 44px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 44px;
          height: 44px;
          background: rgba(239, 68, 68, 0.3);
          border-radius: 50%;
          animation: pulseEmergency 1s infinite;
        "></div>
        <div style="
          width: 32px;
          height: 32px;
          background: #ef4444;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          font-size: 14px;
          font-weight: bold;
          color: white;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.5);
        ">🆘</div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  // Create responder icon
  const createResponderIcon = () => L.divIcon({
    className: 'responder-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 28px;
          height: 28px;
          background: #22c55e;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          box-shadow: 0 2px 8px rgba(34, 197, 94, 0.5);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L14 8H20L15 12L17 18L12 14L7 18L9 12L4 8H10L12 2Z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  // Fetch route using OSRM (free routing service)
  const fetchRoute = async () => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${responderLng},${responderLat};${emergencyLng},${emergencyLat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          coordinates: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]) as [number, number][],
          distance: route.distance / 1000, // Convert to km
          duration: route.duration / 60, // Convert to minutes
        };
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
    return null;
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulseEmergency {
        0%, 100% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.4); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    const map = L.map(mapRef.current, {
      center: [emergencyLat, emergencyLng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Add markers
    emergencyMarkerRef.current = L.marker([emergencyLat, emergencyLng], {
      icon: createEmergencyIcon(),
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup('<strong>📍 Emergencia</strong>');

    responderMarkerRef.current = L.marker([responderLat, responderLng], {
      icon: createResponderIcon(),
      zIndexOffset: 900,
    })
      .addTo(map)
      .bindPopup('<strong>🚗 Tu ubicación</strong>');

    // Fetch and draw route
    const loadRoute = async () => {
      const routeData = await fetchRoute();
      if (routeData && mapInstanceRef.current) {
        routeLayerRef.current = L.polyline(routeData.coordinates, {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.8,
          dashArray: '10, 10',
        }).addTo(mapInstanceRef.current);

        // Fit bounds to show entire route
        const bounds = L.latLngBounds([
          [responderLat, responderLng],
          [emergencyLat, emergencyLng],
        ]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });

        setRouteInfo({
          distance: routeData.distance,
          duration: routeData.duration,
        });
      }
      setLoading(false);
    };

    loadRoute();

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      style.remove();
    };
  }, []);

  // Update responder marker position
  useEffect(() => {
    if (responderMarkerRef.current) {
      responderMarkerRef.current.setLatLng([responderLat, responderLng]);
    }
  }, [responderLat, responderLng]);

  return (
    <div className={cn('relative rounded-lg overflow-hidden', className)}>
      {/* Map container */}
      <div ref={mapRef} className="h-full w-full min-h-[300px]" />

      {/* Route info overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
        <div className="bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
          {loading ? (
            <span className="text-sm text-muted-foreground">Calculando ruta...</span>
          ) : routeInfo ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 font-medium">
                <Navigation className="w-4 h-4 text-primary" />
                {routeInfo.distance.toFixed(1)} km
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-4 h-4" />
                ~{Math.round(routeInfo.duration)} min
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Ruta no disponible</span>
          )}
        </div>

        {onClose && (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/95 backdrop-blur-sm"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Navigation button */}
      <div className="absolute bottom-3 left-3 right-3">
        <Button
          className="w-full"
          onClick={() => {
            const url = `https://www.google.com/maps/dir/${responderLat},${responderLng}/${emergencyLat},${emergencyLng}`;
            window.open(url, '_blank');
          }}
        >
          <Navigation className="w-4 h-4 mr-2" />
          Abrir en Google Maps
        </Button>
      </div>
    </div>
  );
};

export default EmergencyRouteMap;
