// Waze Live Map Overlay - embeds Waze traffic map as a full-screen overlay
import React from 'react';
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
  if (!isOpen) return null;

  const iframeSrc = `https://embed.waze.com/iframe?zoom=${zoom}&lat=${lat}&lon=${lng}&pin=0`;

  return (
    <div className="fixed inset-0 z-[2000] bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/90">
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
      <div className="flex-1 relative">
        <iframe
          src={iframeSrc}
          width="100%"
          height="100%"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 w-full h-full border-0"
          title="Waze Live Map - Tráfico en tiempo real"
        />
      </div>
    </div>
  );
};

export default WazeLiveMapOverlay;
