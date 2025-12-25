// Map Screen with Leaflet for COMUNIDAD EX SOS

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useLocation } from '@/hooks/useLocation';
import { useUserLocations, useHelpRequests, useRoadReports } from '@/hooks/useRealtime';
import { MatsLogo } from '@/components/MatsLogo';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom MATS marker icon
const createMatsIcon = () => {
  return L.divIcon({
    className: 'mats-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: hsl(142, 65%, 40%);
        border: 2px solid hsl(0, 0%, 10%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
          <g transform="translate(50, 50)">
            ${[0, 60, 120, 180, 240, 300].map(angle => `
              <g transform="rotate(${angle})">
                <rect x="-6" y="-35" width="12" height="25" rx="3" fill="hsl(0, 0%, 10%)"/>
              </g>
            `).join('')}
            <circle cx="0" cy="0" r="12" fill="hsl(0, 0%, 10%)"/>
          </g>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Help 14 marker with red halo
const createHelp14Icon = () => {
  return L.divIcon({
    className: 'help14-marker',
    html: `
      <div style="
        width: 48px;
        height: 48px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 48px;
          height: 48px;
          background: hsla(0, 90%, 55%, 0.3);
          border-radius: 50%;
          animation: pulse 1s infinite;
        "></div>
        <div style="
          width: 32px;
          height: 32px;
          background: hsl(0, 90%, 55%);
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          z-index: 1;
        ">14</div>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      </style>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
};

// Report marker
const createReportIcon = (severity: number) => {
  const colors: Record<number, string> = {
    1: 'hsl(142, 70%, 45%)', // Green - low
    2: 'hsl(45, 95%, 55%)',  // Yellow - medium
    3: 'hsl(25, 95%, 55%)',  // Orange - high
    4: 'hsl(0, 85%, 55%)',   // Red - critical
  };
  const color = colors[severity] || colors[2];
  
  return L.divIcon({
    className: 'report-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Current location marker
const createCurrentLocationIcon = () => {
  return L.divIcon({
    className: 'current-location-marker',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background: hsl(210, 90%, 55%);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 10px hsl(210, 90%, 55%);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Auto-center map on position changes
function MapCenterHandler({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], map.getZoom());
    }
  }, [position, map]);
  
  return null;
}

interface MapScreenProps {
  className?: string;
}

export const MapScreen: React.FC<MapScreenProps> = ({ className }) => {
  const { position, error: locationError } = useLocation();
  const { locations } = useUserLocations();
  const { requests: helpRequests } = useHelpRequests();
  const { reports } = useRoadReports();
  const [centered, setCentered] = useState(false);

  // Default center (Mexico City)
  const defaultCenter: [number, number] = [19.4326, -99.1332];
  const center: [number, number] = position 
    ? [position.lat, position.lng] 
    : defaultCenter;

  const matsIcon = createMatsIcon();
  const help14Icon = createHelp14Icon();
  const currentLocationIcon = createCurrentLocationIcon();

  // Help 14 requests only
  const help14Requests = helpRequests.filter(r => r.kind === 'SISMO_AYUDA_14' && !r.resolved);

  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Location error banner */}
      {locationError && (
        <div className="absolute top-2 left-2 right-2 z-[1000] bg-warning/90 text-warning-foreground p-2 rounded-lg text-sm">
          {locationError}
        </div>
      )}

      <MapContainer
        center={center}
        zoom={14}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Current user location */}
        {position && (
          <>
            <Marker 
              position={[position.lat, position.lng]} 
              icon={currentLocationIcon}
            >
              <Popup>
                <div className="text-center">
                  <strong>Tu ubicación</strong>
                  <br />
                  <span className="text-xs text-gray-500">
                    Precisión: {position.accuracy?.toFixed(0)}m
                  </span>
                </div>
              </Popup>
            </Marker>
            
            {/* Accuracy circle */}
            {position.accuracy && (
              <Circle
                center={[position.lat, position.lng]}
                radius={position.accuracy}
                pathOptions={{
                  color: 'hsl(210, 90%, 55%)',
                  fillColor: 'hsl(210, 90%, 55%)',
                  fillOpacity: 0.1,
                  weight: 1,
                }}
              />
            )}
          </>
        )}

        {/* Other users (MATS icons - no PII) */}
        {locations.map((loc) => (
          <Marker
            key={loc.user_id}
            position={[loc.lat, loc.lng]}
            icon={matsIcon}
          >
            <Popup>
              <div className="flex items-center gap-2">
                <MatsLogo size={24} />
                <span className="font-medium">Miembro activo</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Help 14 markers */}
        {help14Requests.map((req) => (
          <Marker
            key={req.id}
            position={[req.lat, req.lng]}
            icon={help14Icon}
          >
            <Popup>
              <div className="text-center p-1">
                <div className="text-lg font-bold text-red-600">⚠️ AYUDA 14</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(req.created_at).toLocaleTimeString()}
                </div>
                {req.message && (
                  <div className="mt-2 text-sm">{req.message}</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Road reports */}
        {reports.map((report) => (
          <Marker
            key={report.id}
            position={[report.lat, report.lng]}
            icon={createReportIcon(report.severity)}
          >
            <Popup>
              <div className="max-w-[200px]">
                <div className="font-medium">{report.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {report.category} • Severidad {report.severity}/4
                </div>
                {report.description && (
                  <div className="text-sm mt-2">{report.description}</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Auto-center once */}
        {!centered && position && (
          <MapCenterHandler position={position} />
        )}
      </MapContainer>

      {/* Map legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-mats-green rounded-full border border-background" />
            <span>Miembro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-help14 rounded-full border border-background" />
            <span>Ayuda 14</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-warning rounded-full border border-background" />
            <span>Reporte</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapScreen;
