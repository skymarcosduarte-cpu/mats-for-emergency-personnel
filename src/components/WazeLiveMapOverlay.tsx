// Waze Live Map Overlay - embeds Waze traffic map as a full-screen overlay
// Captures coordinates once on open to prevent re-renders from GPS updates
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WazeLiveMapOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  lat?: number;
  lng?: number;
  zoom?: number;
}

export const WazeLiveMapOverlay: React.FC<WazeLiveMapOverlayProps> = ({
  isOpen,
  onClose,
  lat = 23.6345,
  lng = -102.5528,
  zoom = 6,
}) => {
  const [iframeMounted, setIframeMounted] = useState(false);
  // Capture coordinates once when overlay opens, so GPS updates don't re-render
  const capturedCoordsRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Freeze the coordinates at the moment of opening
      if (!capturedCoordsRef.current) {
        capturedCoordsRef.current = { lat, lng, zoom };
      }
      const timer = setTimeout(() => setIframeMounted(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIframeMounted(false);
      capturedCoordsRef.current = null;
    }
  }, [isOpen]); // intentionally exclude lat/lng/zoom to prevent re-triggering

  if (!isOpen) return null;

  const coords = capturedCoordsRef.current ?? { lat, lng, zoom };
  const iframeSrc = `https://embed.waze.com/iframe?zoom=${coords.zoom}&lat=${coords.lat}&lon=${coords.lng}&pin=0&locale=es`;

  return (
    <div className="fixed inset-0 z-[2000] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚗</span>
          <div>
            <h2 className="font-bold text-foreground text-sm">Waze Tráfico en Vivo</h2>
            <p className="text-xs text-muted-foreground">Bloqueos, accidentes e incidentes</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Waze iframe */}
      <div className="flex-1 relative bg-muted">
        {iframeMounted ? (
          <iframe
            src={iframeSrc}
            width="100%"
            height="100%"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
            title="Waze Live Map - Tráfico en tiempo real"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Cargando Waze...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WazeLiveMapOverlay;
