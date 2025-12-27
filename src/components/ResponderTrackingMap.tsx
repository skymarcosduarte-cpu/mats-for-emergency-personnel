// Real-time map showing rescuer(s) approaching the emergency location
// Updates in real-time as rescuers move towards the alert

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Navigation, Timer, MapPin, User, Maximize2, RefreshCw, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ResponderLocation {
  id: string;
  user_id: string;
  nickname: string;
  lat: number | null;
  lng: number | null;
  transport_mode: string | null;
  distance_km: number;
  eta_minutes: number | null;
  arrived_at: string | null;
}

interface ResponderTrackingMapProps {
  isOpen: boolean;
  onClose: () => void;
  alertLat: number;
  alertLng: number;
  responders: ResponderLocation[];
  onNavigate?: () => void;
  onMessageResponder?: (userId: string, nickname: string) => void;
}

const TRANSPORT_ICONS: Record<string, string> = {
  walking: '🚶',
  bicycle: '🚴',
  motorcycle: '🏍️',
  car: '🚗',
  public_transport: '🚌',
  ambulance: '🚑',
};

// Create custom marker for the emergency location
const createEmergencyMarker = () => {
  return L.divIcon({
    className: 'custom-emergency-marker',
    html: `
      <div class="relative">
        <div class="absolute -inset-4 animate-ping bg-red-500/30 rounded-full"></div>
        <div class="relative w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-3 border-white">
          <span class="text-white text-lg">🆘</span>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

// Create custom marker for a responder
const createResponderMarker = (nickname: string, transportMode: string | null) => {
  const emoji = transportMode ? TRANSPORT_ICONS[transportMode] || '🚶' : '🚶';
  const initial = nickname.charAt(0).toUpperCase();
  
  return L.divIcon({
    className: 'custom-responder-marker',
    html: `
      <div class="relative">
        <div class="absolute -inset-2 animate-pulse bg-green-500/30 rounded-full"></div>
        <div class="relative w-10 h-10 bg-green-600 rounded-full flex items-center justify-center shadow-lg border-3 border-white">
          <span class="text-white font-bold text-sm">${initial}</span>
        </div>
        <div class="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow text-xs">
          ${emoji}
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

export const ResponderTrackingMap: React.FC<ResponderTrackingMapProps> = ({
  isOpen,
  onClose,
  alertLat,
  alertLng,
  responders,
  onNavigate,
  onMessageResponder,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const emergencyMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Create map
    const map = L.map(mapContainerRef.current, {
      center: [alertLat, alertLng],
      zoom: 14,
      zoomControl: false,
    });

    mapRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    // Add zoom control on top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add emergency marker
    const emergencyMarker = L.marker([alertLat, alertLng], { 
      icon: createEmergencyMarker() 
    }).addTo(map);
    emergencyMarkerRef.current = emergencyMarker;

    // Cleanup
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, alertLat, alertLng]);

  // Update responder markers
  useEffect(() => {
    if (!mapRef.current || !isOpen) return;

    const map = mapRef.current;
    const bounds = L.latLngBounds([[alertLat, alertLng]]);
    
    // Remove old polylines
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Track which markers still exist
    const activeIds = new Set<string>();

    responders.forEach(responder => {
      if (!responder.lat || !responder.lng) return;
      
      activeIds.add(responder.id);
      bounds.extend([responder.lat, responder.lng]);

      const existingMarker = markersRef.current.get(responder.id);
      
      if (existingMarker) {
        // Update existing marker position with animation
        existingMarker.setLatLng([responder.lat, responder.lng]);
      } else {
        // Create new marker
        const marker = L.marker([responder.lat, responder.lng], {
          icon: createResponderMarker(responder.nickname, responder.transport_mode)
        }).addTo(map);
        
        // Add popup with responder info
        marker.bindPopup(`
          <div class="text-center p-1">
            <strong>${responder.nickname}</strong>
            <br/>
            <span class="text-xs text-gray-600">
              ${responder.distance_km.toFixed(1)} km • 
              ${responder.eta_minutes ? `~${Math.round(responder.eta_minutes)} min` : 'Calculando...'}
            </span>
          </div>
        `);
        
        markersRef.current.set(responder.id, marker);
      }

      // Draw line from responder to emergency
      if (!responder.arrived_at) {
        const line = L.polyline(
          [[responder.lat, responder.lng], [alertLat, alertLng]], 
          { 
            color: '#22c55e', 
            weight: 3, 
            opacity: 0.7,
            dashArray: '10, 10',
          }
        ).addTo(map);
        polylineRef.current = line;
      }
    });

    // Remove markers for responders that are no longer active
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Fit bounds if we have responders
    if (responders.some(r => r.lat && r.lng)) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    setLastUpdate(new Date());
  }, [isOpen, responders, alertLat, alertLng]);

  const formatEta = (minutes: number | null) => {
    if (!minutes) return 'Calculando...';
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `~${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `~${hours}h ${mins}m`;
  };

  const activeResponders = responders.filter(r => !r.arrived_at && r.lat && r.lng);
  const arrivedResponders = responders.filter(r => r.arrived_at);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[4000] bg-background flex flex-col"
        >
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-border bg-card z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">Rescatistas en camino</h1>
                <p className="text-xs text-muted-foreground">
                  {activeResponders.length > 0 
                    ? `${activeResponders.length} rescatista${activeResponders.length > 1 ? 's' : ''} acercándose`
                    : 'Esperando ubicación...'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </header>

          {/* Map container */}
          <div className="flex-1 relative">
            <div ref={mapContainerRef} className="absolute inset-0" />
            
            {/* Last update indicator */}
            <div className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3" />
              Actualizado: {lastUpdate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>

          {/* Responders list panel */}
          <div className="bg-card border-t border-border p-4 space-y-3 max-h-[35vh] overflow-y-auto">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              {arrivedResponders.length > 0 ? 'Estado de respuesta' : 'En camino'}
            </h3>
            
            {responders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Esperando que los rescatistas compartan su ubicación...
              </p>
            ) : (
              <div className="space-y-2">
                {/* Active responders */}
                {activeResponders.map(responder => (
                  <div 
                    key={responder.id}
                    className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                        {responder.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{responder.nickname}</p>
                        <p className="text-xs text-muted-foreground">
                          {responder.transport_mode && TRANSPORT_ICONS[responder.transport_mode]} {responder.distance_km.toFixed(1)} km
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onMessageResponder && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                          onClick={() => onMessageResponder(responder.user_id, responder.nickname)}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-green-600 font-medium">
                          <Timer className="w-4 h-4" />
                          {formatEta(responder.eta_minutes)}
                        </div>
                        <p className="text-xs text-muted-foreground">En camino</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Arrived responders */}
                {arrivedResponders.map(responder => (
                  <div 
                    key={responder.id}
                    className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                        ✓
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{responder.nickname}</p>
                        <p className="text-xs text-primary">¡Ya llegó!</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onMessageResponder && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                          onClick={() => onMessageResponder(responder.user_id, responder.nickname)}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                        <MapPin className="w-3 h-3" />
                        En ubicación
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Navigate button */}
            {onNavigate && (
              <Button 
                onClick={onNavigate}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Abrir navegación a mi ubicación
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
