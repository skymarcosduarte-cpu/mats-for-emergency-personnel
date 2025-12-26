// Map Screen with vanilla Leaflet for COMUNIDAD EX SOS
// Using vanilla Leaflet to avoid react-leaflet context issues

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import DOMPurify from 'dompurify';
import { Locate } from 'lucide-react';
import { useLocation } from '@/hooks/useLocation';
import { useUserLocations, useHelpRequests, useRoadReports, useMedicalProviders, usePanicEvents, useActiveResponders } from '@/hooks/useRealtime';
import { useEmergencyResponse } from '@/hooks/useEmergencyResponse';
import { AlertsPanel } from '@/components/AlertsPanel';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import 'leaflet/dist/leaflet.css';

// Sanitize user content for safe HTML rendering
const sanitize = (text: string | null | undefined): string => {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons
const createMatsIcon = () => L.divIcon({
  className: 'mats-marker',
  html: `
    <div style="
      width: 32px;
      height: 32px;
      background: #2e8b57;
      border: 2px solid #0a0a0a;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14 8H20L15 12L17 18L12 14L7 18L9 12L4 8H10L12 2Z" fill="#0a0a0a"/>
      </svg>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const createHelp14Icon = () => L.divIcon({
  className: 'help14-marker',
  html: `
    <div style="
      width: 40px;
      height: 40px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 40px;
        height: 40px;
        background: rgba(239, 68, 68, 0.3);
        border-radius: 50%;
        animation: pulse14 1s infinite;
      "></div>
      <div style="
        width: 28px;
        height: 28px;
        background: #ef4444;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        z-index: 1;
      ">14</div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const createCurrentLocationIcon = () => L.divIcon({
  className: 'current-location-marker',
  html: `
    <div style="
      width: 18px;
      height: 18px;
      background: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 10px #3b82f6;
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const createReportIcon = (severity: number) => {
  const colors: Record<number, string> = {
    1: '#22c55e',
    2: '#eab308',
    3: '#f97316',
    4: '#ef4444',
  };
  return L.divIcon({
    className: 'report-marker',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background: ${colors[severity] || colors[2]};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
};

// Panic event icons with different colors based on type
const createPanicIcon = (panicType: string) => {
  const typeConfig: Record<string, { color: string; emoji: string }> = {
    'AMBULANCIA_PROPIA': { color: '#ef4444', emoji: '🚑' },
    'AMBULANCIA_TERCERO': { color: '#ef4444', emoji: '🚑' },
    'PATRULLA': { color: '#3b82f6', emoji: '🚔' },
    'MECANICO': { color: '#eab308', emoji: '🔧' },
    'PROTECCION_CIVIL': { color: '#f97316', emoji: '🆘' },
  };
  const config = typeConfig[panicType] || { color: '#ef4444', emoji: '🆘' };
  
  return L.divIcon({
    className: 'panic-marker',
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
          background: ${config.color}40;
          border-radius: 50%;
          animation: pulsePanic 1s infinite;
        "></div>
        <div style="
          width: 32px;
          height: 32px;
          background: ${config.color};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          font-size: 16px;
          box-shadow: 0 2px 8px ${config.color}80;
        ">${config.emoji}</div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};

// Responder icon - shows RESCATISTA responding to emergency
const createResponderIcon = () => L.divIcon({
  className: 'responder-marker',
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
        background: rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        animation: pulseResponder 1.5s infinite;
      "></div>
      <div style="
        width: 32px;
        height: 32px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22],
});

// Medical provider icon with cross symbol
const createMedicalIcon = (hasKit: boolean, canProvide: boolean) => {
  const iconContent = canProvide 
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
       </svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2">
        <path d="M12 2v20M2 12h20"/>
       </svg>`;

  return L.divIcon({
    className: 'medical-marker',
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
          position: absolute;
          width: 36px;
          height: 36px;
          background: rgba(34, 197, 94, 0.3);
          border-radius: 50%;
          animation: pulseMedical 2s infinite;
        "></div>
        <div style="
          width: 28px;
          height: 28px;
          background: #22c55e;
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
        ">${iconContent}</div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

interface MapScreenProps {
  className?: string;
}

export const MapScreen: React.FC<MapScreenProps> = ({ className }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const currentLocationMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const { position, error: locationError } = useLocation();
  const { role, user } = useAuth();
  const { locations } = useUserLocations();
  const { requests: helpRequests, resolveRequest } = useHelpRequests(position);
  const { reports } = useRoadReports();
  const { providers: medicalProviders } = useMedicalProviders();
  const { events: panicEvents, resolveEvent } = usePanicEvents();
  const { responders: activeResponders } = useActiveResponders();
  const { startResponding, stopResponding, markAsArrived, markAsResolved } = useEmergencyResponse();
  
  const isRescatista = role === 'RESCATISTA';
  const currentUserId = user?.id;

  // Handle respond to help request from modal
  const handleRespondToRequest = useCallback(async (requestId: string) => {
    // Find the help request to get its coordinates
    const request = helpRequests.find(r => r.id === requestId);
    if (!request) {
      console.error('[MapScreen] Help request not found:', requestId);
      return false;
    }
    return await startResponding(requestId, request.lat, request.lng, isRescatista);
  }, [helpRequests, startResponding]);

  // Default center (Mexico City)
  const defaultCenter: [number, number] = [19.4326, -99.1332];

  // Center map on user's location
  const centerOnMe = useCallback(() => {
    if (!mapInstanceRef.current || !position) return;
    mapInstanceRef.current.setView([position.lat, position.lng], 16, { animate: true });
  }, [position]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    // Add pulse animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse14 {
        0%, 100% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.5); opacity: 0; }
      }
      @keyframes pulseMedical {
        0%, 100% { transform: scale(1); opacity: 0.4; }
        50% { transform: scale(1.3); opacity: 0; }
      }
      @keyframes pulsePanic {
        0%, 100% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.4); opacity: 0; }
      }
      @keyframes pulseResponder {
        0%, 100% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.3); opacity: 0.2; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      style.remove();
    };
  }, []);

  // Update current location
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    if (position) {
      const latlng: [number, number] = [position.lat, position.lng];

      // Update or create current location marker
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setLatLng(latlng);
      } else {
        currentLocationMarkerRef.current = L.marker(latlng, {
          icon: createCurrentLocationIcon(),
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center;">
              <strong>Tu ubicación</strong><br/>
              <span style="font-size: 11px; color: #666;">
                Precisión: ${position.accuracy?.toFixed(0) || '?'}m
              </span>
            </div>
          `);

        // Center map on first position
        map.setView(latlng, 14);
      }

      // Update accuracy circle
      if (position.accuracy) {
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng(latlng);
          accuracyCircleRef.current.setRadius(position.accuracy);
        } else {
          accuracyCircleRef.current = L.circle(latlng, {
            radius: position.accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 1,
          }).addTo(map);
        }
      }
    }
  }, [position, mapReady]);

  // Update user location markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Remove old markers
    markersRef.current.forEach((marker, key) => {
      if (!locations.find(l => l.user_id === key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update markers
    locations.forEach((loc) => {
      const key = `user-${loc.user_id}`;
      const existingMarker = markersRef.current.get(key);

      if (existingMarker) {
        existingMarker.setLatLng([loc.lat, loc.lng]);
      } else {
        const marker = L.marker([loc.lat, loc.lng], {
          icon: createMatsIcon(),
        })
          .addTo(map)
          .bindPopup(`
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 24px; height: 24px; background: #2e8b57; border-radius: 50%;"></div>
              <span style="font-weight: 500;">Miembro activo</span>
            </div>
          `);
        markersRef.current.set(key, marker);
      }
    });
  }, [locations, mapReady]);

  // Update help 14 markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    const help14Requests = helpRequests.filter(r => r.kind === 'SISMO_AYUDA_14' && !r.resolved);

    // Remove old help markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('help-') && !help14Requests.find(r => `help-${r.id}` === key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update help markers
    help14Requests.forEach((req) => {
      const key = `help-${req.id}`;
      const existingMarker = markersRef.current.get(key);

      if (existingMarker) {
        existingMarker.setLatLng([req.lat, req.lng]);
      } else {
        const marker = L.marker([req.lat, req.lng], {
          icon: createHelp14Icon(),
          zIndexOffset: 500,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 16px; font-weight: bold; color: #ef4444;">⚠️ AYUDA 14</div>
              <div style="font-size: 11px; color: #666; margin-top: 4px;">
                ${new Date(req.created_at).toLocaleTimeString()}
              </div>
              ${req.message ? `<div style="font-size: 13px; margin-top: 8px;">${sanitize(req.message)}</div>` : ''}
            </div>
          `);
        markersRef.current.set(key, marker);
      }
    });
  }, [helpRequests, mapReady]);

  // Update report markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Remove old report markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('report-') && !reports.find(r => `report-${r.id}` === key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update report markers
    reports.forEach((report) => {
      const key = `report-${report.id}`;
      const existingMarker = markersRef.current.get(key);

      if (existingMarker) {
        existingMarker.setLatLng([report.lat, report.lng]);
      } else {
        const marker = L.marker([report.lat, report.lng], {
          icon: createReportIcon(report.severity),
        })
          .addTo(map)
          .bindPopup(`
            <div style="max-width: 180px;">
              <div style="font-weight: 500;">${sanitize(report.title)}</div>
              <div style="font-size: 11px; color: #666; margin-top: 4px;">
                ${sanitize(report.category)} • Severidad ${report.severity}/4
              </div>
              ${report.description ? `<div style="font-size: 12px; margin-top: 8px;">${sanitize(report.description)}</div>` : ''}
            </div>
          `);
        markersRef.current.set(key, marker);
      }
    });
  }, [reports, mapReady]);

  // Update medical provider markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Remove old medical markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('medical-') && !medicalProviders.find(p => `medical-${p.user_id}` === key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update medical provider markers
    medicalProviders.forEach((provider) => {
      const key = `medical-${provider.user_id}`;
      const existingMarker = markersRef.current.get(key);

      // Determine popup content
      const capabilities: string[] = [];
      if (provider.can_provide_medical_assistance) capabilities.push('Asistencia médica');
      if (provider.has_first_aid_kit) capabilities.push('Botiquín disponible');

      if (existingMarker) {
        existingMarker.setLatLng([provider.lat, provider.lng]);
      } else {
        const marker = L.marker([provider.lat, provider.lng], {
          icon: createMedicalIcon(provider.has_first_aid_kit, provider.can_provide_medical_assistance),
          zIndexOffset: 400,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 14px; font-weight: bold; color: #22c55e;">🏥 Asistencia Médica</div>
              <div style="font-size: 12px; color: #666; margin-top: 6px;">
                ${capabilities.join(' • ')}
              </div>
            </div>
          `);
        markersRef.current.set(key, marker);
      }
    });
  }, [medicalProviders, mapReady]);

  // Update panic event markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Remove old panic markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('panic-') && !panicEvents.find(e => `panic-${e.id}` === key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update panic markers
    panicEvents.forEach((event) => {
      const key = `panic-${event.id}`;
      const existingMarker = markersRef.current.get(key);

      const typeLabels: Record<string, string> = {
        'AMBULANCIA_PROPIA': '🚑 Ambulancia Propia',
        'AMBULANCIA_TERCERO': '🚑 Ambulancia Tercero',
        'PATRULLA': '🚔 Patrulla',
        'MECANICO': '🔧 Mecánico',
        'PROTECCION_CIVIL': '🆘 Protección Civil',
      };
      const label = typeLabels[event.panic_type] || '🆘 Emergencia';

      if (existingMarker) {
        existingMarker.setLatLng([event.lat, event.lng]);
      } else {
        const marker = L.marker([event.lat, event.lng], {
          icon: createPanicIcon(event.panic_type),
          zIndexOffset: 600,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 16px; font-weight: bold; color: #ef4444;">⚠️ ALERTA SOS</div>
              <div style="font-size: 13px; margin-top: 4px;">${label}</div>
              <div style="font-size: 11px; color: #666; margin-top: 4px;">
                ${new Date(event.created_at).toLocaleTimeString()}
              </div>
              <a href="https://maps.google.com/?q=${event.lat},${event.lng}" 
                 target="_blank" 
                 style="display: inline-block; margin-top: 8px; font-size: 12px; color: #3b82f6;">
                Abrir en Google Maps
              </a>
            </div>
          `);
        markersRef.current.set(key, marker);
      }
    });
  }, [panicEvents, mapReady]);

  // Update responder markers and route lines
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Get current responder keys for comparison
    const currentResponderKeys = new Set(activeResponders.map(r => `responder-${r.request_id}-${r.responder_id}`));
    const currentRouteKeys = new Set(activeResponders.map(r => `route-${r.request_id}-${r.responder_id}`));

    // Remove old responder markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('responder-') && !currentResponderKeys.has(key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Remove old route polylines
    polylinesRef.current.forEach((polyline, key) => {
      if (key.startsWith('route-') && !currentRouteKeys.has(key)) {
        map.removeLayer(polyline);
        polylinesRef.current.delete(key);
      }
    });

    // Count responders per request for display
    const respondersPerRequest = new Map<string, number>();
    activeResponders.forEach(r => {
      respondersPerRequest.set(r.request_id, (respondersPerRequest.get(r.request_id) || 0) + 1);
    });

    // Add/update responder markers and route lines
    activeResponders.forEach((responder, index) => {
      // Use composite key to support multiple responders per request
      const markerKey = `responder-${responder.request_id}-${responder.responder_id}`;
      const routeKey = `route-${responder.request_id}-${responder.responder_id}`;
      const existingMarker = markersRef.current.get(markerKey);
      const existingPolyline = polylinesRef.current.get(routeKey);

      const responderLatLng: [number, number] = [responder.responder_lat, responder.responder_lng];
      const emergencyLatLng: [number, number] = [responder.emergency_lat, responder.emergency_lng];

      // Format ETA display
      const formatEta = (minutes: number | null, distanceKm: number) => {
        const distanceText = distanceKm < 1 
          ? `${Math.round(distanceKm * 1000)}m` 
          : `${distanceKm.toFixed(1)}km`;
        
        if (minutes === null) {
          return `📍 ${distanceText}`;
        }
        
        if (minutes < 1) {
          return `⏱️ <1 min • ${distanceText}`;
        } else if (minutes < 60) {
          return `⏱️ ~${Math.round(minutes)} min • ${distanceText}`;
        } else {
          const hours = Math.floor(minutes / 60);
          const mins = Math.round(minutes % 60);
          return `⏱️ ~${hours}h ${mins}min • ${distanceText}`;
        }
      };

      const etaDisplay = formatEta(responder.eta_minutes, responder.distance_km);
      const speedDisplay = responder.speed 
        ? `${Math.round(responder.speed * 3.6)} km/h` 
        : 'Velocidad desconocida';
      
      // Show responder count if multiple
      const totalResponders = respondersPerRequest.get(responder.request_id) || 1;
      const responderIndexForRequest = activeResponders
        .filter(r => r.request_id === responder.request_id)
        .indexOf(responder) + 1;
      
      const responderLabel = totalResponders > 1 
        ? `Rescatista ${responderIndexForRequest}/${totalResponders}`
        : 'Rescatista en camino';

      // Check if arrived
      const arrivedBadge = responder.arrived_at 
        ? '<div style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-top: 4px;">✓ LLEGÓ</div>'
        : '';

      const popupContent = `
        <div style="text-align: center; padding: 4px; min-width: 160px;">
          <div style="font-size: 14px; font-weight: bold; color: #3b82f6;">🚨 ${responderLabel}</div>
          ${arrivedBadge}
          <div style="font-size: 13px; font-weight: 600; color: #22c55e; margin-top: 6px;">
            ${etaDisplay}
          </div>
          <div style="font-size: 11px; color: #666; margin-top: 4px;">
            ${speedDisplay}
          </div>
          <div style="font-size: 10px; color: #999; margin-top: 4px;">
            Desde ${new Date(responder.responding_started_at).toLocaleTimeString()}
          </div>
        </div>
      `;

      // Update or create responder marker
      if (existingMarker) {
        existingMarker.setLatLng(responderLatLng);
        existingMarker.setPopupContent(popupContent);
      } else {
        const marker = L.marker(responderLatLng, {
          icon: createResponderIcon(),
          zIndexOffset: 700 + index, // Stagger z-index for multiple markers
        })
          .addTo(map)
          .bindPopup(popupContent);
        markersRef.current.set(markerKey, marker);
      }

      // Different colors for multiple responders
      const routeColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899'];
      const routeColor = routeColors[responderIndexForRequest - 1] || routeColors[0];

      // Update or create route polyline (dashed line from responder to emergency)
      if (existingPolyline) {
        existingPolyline.setLatLngs([responderLatLng, emergencyLatLng]);
        existingPolyline.setStyle({ color: routeColor });
      } else {
        const polyline = L.polyline([responderLatLng, emergencyLatLng], {
          color: routeColor,
          weight: 3,
          opacity: 0.8,
          dashArray: '10, 10',
        }).addTo(map);
        polylinesRef.current.set(routeKey, polyline);
      }
    });
  }, [activeResponders, mapReady]);

  // Handle view location from alerts panel
  const handleViewLocation = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([lat, lng], 17, { animate: true });
  }, []);

  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Location error banner */}
      {locationError && (
        <div className="absolute top-2 left-2 right-2 z-[1000] bg-warning/90 text-background p-2 rounded-lg text-sm font-medium">
          {locationError}
        </div>
      )}

      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Active users count + center button + alerts panel */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-border">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-foreground">
                {locations.length} {locations.length === 1 ? 'activo' : 'activos'}
              </span>
            </div>
          </div>
          <button
            onClick={centerOnMe}
            disabled={!position}
            className="bg-card/95 backdrop-blur-sm rounded-lg p-2.5 shadow-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Centrar en mi ubicación"
          >
            <Locate className="w-5 h-5 text-primary" />
          </button>
        </div>
        
        {/* Alerts Panel Button */}
        <AlertsPanel
          panicEvents={panicEvents}
          helpRequests={helpRequests}
          onViewLocation={handleViewLocation}
          isRescatista={isRescatista}
          currentUserId={currentUserId}
          onResolveHelpRequest={resolveRequest}
          onResolvePanicEvent={resolveEvent}
          activeResponders={activeResponders}
          userPosition={position}
          onRespondToRequest={handleRespondToRequest}
          onCancelResponse={stopResponding}
          onMarkAsArrived={markAsArrived}
          onResolve={markAsResolved}
        />
      </div>

      {/* Map legend */}
      <div className="absolute bottom-20 right-4 z-[1000] bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border">
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#2e8b57' }} />
            <span className="text-foreground">Miembro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#22c55e' }} />
            <span className="text-foreground">Médico/Botiquín</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
            <span className="text-foreground">Alerta SOS</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#ef4444', opacity: 0.7 }} />
            <span className="text-foreground">Ayuda 14</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#eab308' }} />
            <span className="text-foreground">Reporte</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
            <span className="text-foreground">Rescatista</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapScreen;
