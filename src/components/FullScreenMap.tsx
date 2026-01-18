// Full-screen interactive map overlay
// Shows an interactive map with the alert location and user's current position

import React, { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, ZoomIn, ZoomOut, Locate, Navigation, Crosshair, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FullScreenMapProps {
  lat: number;
  lng: number;
  userLat?: number;
  userLng?: number;
  isOpen: boolean;
  onClose: () => void;
  /** If true, centers on main location instead of fitting bounds to both markers */
  focusOnMain?: boolean;
  /** Custom initial zoom level (default: 16) */
  initialZoom?: number;
  /** Route coordinates to draw as a polyline [[lat, lng], ...] */
  routeCoordinates?: [number, number][];
  /** Title for the header */
  title?: string;
}

// Calculate distance between two coordinates in km (Haversine formula)
const calculateDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Format distance for display
const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

// Create custom red marker icon for alert/traveler location
const createRedIcon = () => L.divIcon({
  className: 'custom-marker',
  html: `
    <div class="relative">
      <div class="w-10 h-10 bg-destructive rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-destructive rotate-45 -z-10"></div>
    </div>
  `,
  iconSize: [40, 48],
  iconAnchor: [20, 48],
});

// Create user location icon
const createUserIcon = () => L.divIcon({
  className: 'user-location-marker',
  html: `
    <div class="relative flex items-center justify-center">
      <div class="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping"></div>
      <div class="absolute w-6 h-6 bg-blue-500/20 rounded-full animate-pulse"></div>
      <div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export const FullScreenMap: React.FC<FullScreenMapProps> = ({ 
  lat, 
  lng, 
  userLat,
  userLng,
  isOpen,
  onClose,
  focusOnMain = false,
  initialZoom = 16,
  routeCoordinates = [],
  title = 'Ubicación',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mainMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const hasInitializedRef = useRef(false);
  const [isFollowing, setIsFollowing] = useState(true); // Auto-follow enabled by default
  const [showRoute, setShowRoute] = useState(true); // Show route by default

  // Calculate distance between user and alert
  const distance = useMemo(() => {
    if (userLat === undefined || userLng === undefined) return null;
    return calculateDistanceKm(userLat, userLng, lat, lng);
  }, [lat, lng, userLat, userLng]);

  // Initialize map only once when opened
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Small delay to ensure container is rendered
    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      // Initialize map with touch support enabled
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: initialZoom,
        zoomControl: false,
        // Enable all touch interactions for mobile
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
      });

      mapRef.current = map;
      hasInitializedRef.current = true;

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Add main marker
      const mainMarker = L.marker([lat, lng], { icon: createRedIcon() })
        .addTo(map)
        .bindPopup(`<strong>Ubicación</strong><br/>Lat: ${lat.toFixed(6)}<br/>Lng: ${lng.toFixed(6)}`);
      mainMarkerRef.current = mainMarker;

      // Draw route polyline if coordinates provided
      if (routeCoordinates.length > 1) {
        const routeLine = L.polyline(routeCoordinates, {
          color: '#3b82f6', // Blue color
          weight: 4,
          opacity: 0.8,
          smoothFactor: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        routeLineRef.current = routeLine;
      }

      // Add user location marker if available
      if (userLat !== undefined && userLng !== undefined) {
        const userMarker = L.marker([userLat, userLng], { icon: createUserIcon() })
          .addTo(map)
          .bindPopup('<strong>Tu ubicación</strong>');
        userMarkerRef.current = userMarker;

        // Only fit bounds if not focusing on main location
        if (!focusOnMain) {
          const bounds = L.latLngBounds([
            [lat, lng],
            [userLat, userLng]
          ]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
      }

      // Force resize after a moment
      setTimeout(() => map.invalidateSize(), 100);
    }, 50);

    // Cleanup only when closed
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]); // Only depend on isOpen, not coordinates

  // Cleanup map when dialog closes
  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      mainMarkerRef.current = null;
      userMarkerRef.current = null;
      routeLineRef.current = null;
      hasInitializedRef.current = false;
    }
  }, [isOpen]);

  // Update route when coordinates change
  useEffect(() => {
    if (!isOpen || !mapRef.current || !hasInitializedRef.current) return;

    // Remove existing route line
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    // Draw new route if coordinates provided and showRoute is enabled
    if (routeCoordinates.length > 1 && showRoute) {
      const routeLine = L.polyline(routeCoordinates, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapRef.current);
      routeLineRef.current = routeLine;
    }
  }, [routeCoordinates, isOpen, showRoute]);

  // Update marker position when coordinates change (follow if enabled)
  useEffect(() => {
    if (!isOpen || !mapRef.current || !hasInitializedRef.current) return;

    // Update main marker position
    if (mainMarkerRef.current) {
      mainMarkerRef.current.setLatLng([lat, lng]);
      mainMarkerRef.current.setPopupContent(
        `<strong>Ubicación</strong><br/>Lat: ${lat.toFixed(6)}<br/>Lng: ${lng.toFixed(6)}`
      );
      
      // Auto-pan to new position if following is enabled
      if (isFollowing) {
        mapRef.current.panTo([lat, lng], { animate: true, duration: 0.5 });
      }
    }
  }, [lat, lng, isOpen, isFollowing]);

  // Update user marker position when it changes
  useEffect(() => {
    if (!isOpen || !mapRef.current || !hasInitializedRef.current) return;

    if (userLat !== undefined && userLng !== undefined) {
      if (userMarkerRef.current) {
        // Update existing marker
        userMarkerRef.current.setLatLng([userLat, userLng]);
      } else {
        // Create new marker if it doesn't exist
        const userMarker = L.marker([userLat, userLng], { icon: createUserIcon() })
          .addTo(mapRef.current)
          .bindPopup('<strong>Tu ubicación</strong>');
        userMarkerRef.current = userMarker;
      }
    }
  }, [userLat, userLng, isOpen]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleRecenter = () => {
    mapRef.current?.setView([lat, lng], initialZoom, { animate: true });
    setIsFollowing(true); // Re-enable following when recentering
  };

  const toggleFollow = () => {
    setIsFollowing(prev => !prev);
    if (!isFollowing && mapRef.current) {
      // When enabling follow, immediately center on current position
      mapRef.current.panTo([lat, lng], { animate: true });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4000] bg-background flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="font-semibold text-foreground">{title}</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="touch-manipulation"
        >
          <X className="w-5 h-5" />
        </Button>
      </header>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div 
          ref={mapContainerRef} 
          className="absolute inset-0"
        />
        
        {/* Map Controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-2 z-[1000]">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomIn}
            className="shadow-lg bg-card/95 backdrop-blur-sm"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomOut}
            className="shadow-lg bg-card/95 backdrop-blur-sm"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleRecenter}
            className="shadow-lg bg-card/95 backdrop-blur-sm"
          >
            <Locate className="w-4 h-4" />
          </Button>
          <Button
            variant={isFollowing ? "default" : "secondary"}
            size="icon"
            onClick={toggleFollow}
            className={`shadow-lg backdrop-blur-sm ${
              isFollowing 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card/95'
            }`}
            title={isFollowing ? 'Siguiendo posición' : 'Seguir posición'}
          >
            <Crosshair className={`w-4 h-4 ${isFollowing ? 'animate-pulse' : ''}`} />
          </Button>
          {routeCoordinates.length > 1 && (
            <Button
              variant={showRoute ? "default" : "secondary"}
              size="icon"
              onClick={() => setShowRoute(prev => !prev)}
              className={`shadow-lg backdrop-blur-sm ${
                showRoute 
                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                  : 'bg-card/95'
              }`}
              title={showRoute ? 'Ocultar ruta' : 'Mostrar ruta'}
            >
              <Route className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Follow indicator */}
        {isFollowing && (
          <div className="absolute right-4 top-[200px] bg-primary/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg z-[1000]">
            <p className="text-xs font-medium text-primary-foreground flex items-center gap-1.5">
              <Crosshair className="w-3 h-3" />
              Siguiendo
            </p>
          </div>
        )}

        {/* Distance Indicator */}
        {distance !== null && (
          <div className="absolute left-4 top-4 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-[1000]">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {formatDistance(distance)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              de distancia
            </p>
          </div>
        )}

        {/* Coordinates Badge */}
        <div className="absolute left-4 bottom-4 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-[1000]">
          <p className="text-xs text-muted-foreground font-mono">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
};
