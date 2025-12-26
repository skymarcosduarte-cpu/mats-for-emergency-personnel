// Mini map preview component using vanilla Leaflet
// Shows a static marker at a specific location with tap-to-expand

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Expand } from 'lucide-react';
import { FullScreenMap } from './FullScreenMap';

interface MiniMapProps {
  lat: number;
  lng: number;
  userLat?: number;
  userLng?: number;
  className?: string;
  zoom?: number;
}

export const MiniMap: React.FC<MiniMapProps> = ({ 
  lat, 
  lng, 
  userLat,
  userLng,
  className = '',
  zoom = 15 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || isExpanded) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom,
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

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Create custom red marker icon
    const redIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="relative">
          <div class="w-8 h-8 bg-destructive rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-destructive rotate-45 -z-10"></div>
        </div>
      `,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    });

    // Add marker
    L.marker([lat, lng], { icon: redIcon }).addTo(map);

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, zoom, isExpanded]);

  return (
    <>
      <div 
        className={`relative w-full h-32 rounded-lg overflow-hidden cursor-pointer group ${className}`}
        style={{ minHeight: '128px' }}
        onClick={() => setIsExpanded(true)}
      >
        <div ref={mapContainerRef} className="absolute inset-0" />
        
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

      <FullScreenMap
        lat={lat}
        lng={lng}
        userLat={userLat}
        userLng={userLng}
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
      />
    </>
  );
};
