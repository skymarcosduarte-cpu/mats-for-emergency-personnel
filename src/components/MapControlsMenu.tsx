// MapControlsMenu - Collapsible map controls for mobile screens
import React, { useState } from 'react';
import { Locate, Share2, Copy, MessageCircle, Check, MapPin, X, MoreHorizontal, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MapControlsMenuProps {
  position: { lat: number; lng: number } | null;
  onCenterOnMe: () => void;
  activeUsersCount: number;
  className?: string;
}

export function MapControlsMenu({ 
  position, 
  onCenterOnMe, 
  activeUsersCount,
  className 
}: MapControlsMenuProps) {
  const [copied, setCopied] = useState(false);

  const getGoogleMapsLink = (lat: number, lng: number) => {
    return `https://maps.google.com/?q=${lat},${lng}`;
  };

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const handleCopyCoordinates = async () => {
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
  };

  const handleCopyLink = async () => {
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
  };

  const handleShareWhatsApp = () => {
    if (!position) {
      toast.error('Ubicación no disponible');
      return;
    }

    const link = getGoogleMapsLink(position.lat, position.lng);
    const message = `📍 Mi ubicación actual:\n${link}\n\nCoordenadas: ${formatCoordinates(position.lat, position.lng)}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Desktop: show all controls */}
      <div className="hidden sm:flex items-center gap-2">
        {/* Active users count */}
        <div className="bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-border">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-safe" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-safe animate-ping opacity-75" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {activeUsersCount} {activeUsersCount === 1 ? 'activo' : 'activos'}
            </span>
          </div>
        </div>

        {/* Center on me button */}
        <button
          onClick={onCenterOnMe}
          disabled={!position}
          className="bg-card/95 backdrop-blur-sm rounded-lg p-2.5 shadow-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Centrar en mi ubicación"
        >
          <Locate className="w-5 h-5 text-primary" />
        </button>

        {/* Share location dropdown */}
        {position && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="bg-card/95 backdrop-blur-sm shadow-lg border-border hover:bg-accent"
                aria-label="Compartir ubicación"
              >
                <Share2 className="w-5 h-5 text-primary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 z-[9999]" sideOffset={8}>
              <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded text-xs font-mono mx-1 mb-1">
                <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                <span className="truncate">{formatCoordinates(position.lat, position.lng)}</span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyCoordinates}>
                {copied ? <Check className="w-4 h-4 mr-2 text-safe" /> : <Copy className="w-4 h-4 mr-2" />}
                Copiar coordenadas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <MapPin className="w-4 h-4 mr-2" />
                Copiar enlace Maps
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareWhatsApp} className="text-[#25D366]">
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar por WhatsApp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Mobile: collapsed menu */}
      <div className="flex sm:hidden items-center gap-2">
        {/* Active users badge (always visible) */}
        <div className="bg-card/95 backdrop-blur-sm rounded-lg px-2.5 py-2 shadow-lg border border-border">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-safe" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-safe animate-ping opacity-75" />
            </div>
            <span className="text-xs font-medium text-foreground">
              {activeUsersCount}
            </span>
          </div>
        </div>

        {/* Collapsed controls menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="bg-card/95 backdrop-blur-sm rounded-lg p-2.5 shadow-lg border border-border hover:bg-accent transition-colors"
              aria-label="Controles del mapa"
            >
              <MoreHorizontal className="w-5 h-5 text-primary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 z-[9999]" sideOffset={8}>
            <DropdownMenuItem onClick={onCenterOnMe} disabled={!position}>
              <Locate className="w-4 h-4 mr-2 text-primary" />
              Centrar en mi ubicación
            </DropdownMenuItem>
            
            {position && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Compartir ubicación
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded text-xs font-mono mx-1 mb-1">
                  <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                  <span className="truncate">{formatCoordinates(position.lat, position.lng)}</span>
                </div>
                <DropdownMenuItem onClick={handleCopyCoordinates}>
                  {copied ? <Check className="w-4 h-4 mr-2 text-safe" /> : <Copy className="w-4 h-4 mr-2" />}
                  Copiar coordenadas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyLink}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Copiar enlace Maps
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareWhatsApp} className="text-[#25D366]">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Enviar por WhatsApp
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default MapControlsMenu;
