// Waze Live Map Overlay - embeds Waze traffic map as a full-screen overlay
// Only mounts the iframe when explicitly opened by the user
import React, { useState, useEffect } from 'react';
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
  // Only mount iframe after overlay is confirmed open (prevents flash)
  const [iframeMounted, setIframeMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay to let the overlay background render first
      const timer = setTimeout(() => setIframeMounted(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIframeMounted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const iframeSrc = `https://embed.waze.com/iframe?zoom=${zoom}&lat=${lat}&lon=${lng}&pin=0`;

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

      {/* Waze iframe - only mounted after delay */}
      <div className="flex-1 relative bg-muted">
        {iframeMounted ? (
          <iframe
            src={iframeSrc}
            width="100%"
            height="100%"
            allowFullScreen
            loading="lazy"
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
