// ShareLocationButton - Quick share current location via WhatsApp or copy coordinates
import React, { useState, useCallback } from 'react';
import { Share2, Copy, MessageCircle, Check, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareLocationButtonProps {
  position: { lat: number; lng: number } | null;
  className?: string;
}

export function ShareLocationButton({ position, className }: ShareLocationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const getGoogleMapsLink = useCallback((lat: number, lng: number) => {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }, []);

  const formatCoordinates = useCallback((lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }, []);

  const handleCopyCoordinates = useCallback(async () => {
    if (!position) {
      toast.error('Ubicación no disponible');
      return;
    }

    const coords = formatCoordinates(position.lat, position.lng);
    try {
      await navigator.clipboard.writeText(coords);
      setCopied(true);
      toast.success('Coordenadas copiadas');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = coords;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success('Coordenadas copiadas');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [position, formatCoordinates]);

  const handleCopyLink = useCallback(async () => {
    if (!position) {
      toast.error('Ubicación no disponible');
      return;
    }

    const link = getGoogleMapsLink(position.lat, position.lng);
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Enlace copiado');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('Enlace copiado');
    }
  }, [position, getGoogleMapsLink]);

  const handleShareWhatsApp = useCallback(() => {
    if (!position) {
      toast.error('Ubicación no disponible');
      return;
    }

    const link = getGoogleMapsLink(position.lat, position.lng);
    const message = `📍 Mi ubicación actual:\n${link}\n\nCoordenadas: ${formatCoordinates(position.lat, position.lng)}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  }, [position, getGoogleMapsLink, formatCoordinates]);

  if (!position) return null;

  return (
    <div className={className}>
      {/* Main toggle button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-card/95 backdrop-blur-sm shadow-lg border-border hover:bg-accent"
        aria-label="Compartir ubicación"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-muted-foreground" />
        ) : (
          <Share2 className="w-5 h-5 text-primary" />
        )}
      </Button>

      {/* Expanded options */}
      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-border p-2 min-w-[180px]">
          <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
            Compartir ubicación
          </div>
          
          {/* Current coordinates display */}
          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded text-xs font-mono mb-2">
            <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
            <span className="truncate">{formatCoordinates(position.lat, position.lng)}</span>
          </div>

          {/* Action buttons */}
          <div className="space-y-1">
            <button
              onClick={handleCopyCoordinates}
              className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-accent transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-safe" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
              <span>Copiar coordenadas</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-accent transition-colors"
            >
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>Copiar enlace Maps</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-accent transition-colors text-[#25D366]"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar por WhatsApp</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
