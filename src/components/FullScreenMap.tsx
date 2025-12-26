// Full-screen interactive map overlay
// Shows an interactive map with the alert location

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, ZoomIn, ZoomOut, Locate } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FullScreenMapProps {
  lat: number;
  lng: number;
  isOpen: boolean;
  onClose: () => void;
}

export const FullScreenMap: React.FC<FullScreenMapProps> = ({ 
  lat, 
  lng, 
  isOpen,
  onClose 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Small delay to ensure container is rendered
    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: false,
      });

      mapRef.current = map;

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Create custom red marker icon
      const redIcon = L.divIcon({
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

      // Add marker with popup
      L.marker([lat, lng], { icon: redIcon })
        .addTo(map)
        .bindPopup(`<strong>Ubicación de la alerta</strong><br/>Lat: ${lat.toFixed(6)}<br/>Lng: ${lng.toFixed(6)}`)
        .openPopup();

      // Force resize after a moment
      setTimeout(() => map.invalidateSize(), 100);
    }, 50);

    // Cleanup
    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, lat, lng]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleRecenter = () => {
    mapRef.current?.setView([lat, lng], 16, { animate: true });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4000] bg-background flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="font-semibold text-foreground">Ubicación de la Alerta</h1>
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
        </div>

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
