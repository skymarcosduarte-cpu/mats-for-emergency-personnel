import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, MessageCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Clave100OverlayProps {
  isVisible: boolean;
  senderName: string;
  message: string;
  onDismiss: () => void;
  onOpenChat: () => void;
}

export const Clave100Overlay: React.FC<Clave100OverlayProps> = ({
  isVisible,
  senderName,
  message,
  onDismiss,
  onOpenChat,
}) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Small delay for animation
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  // Extract location link if present
  const locationMatch = message.match(/https:\/\/www\.google\.com\/maps\?q=[\d.-]+,[\d.-]+/);
  const locationUrl = locationMatch ? locationMatch[0] : null;

  // Clean message for display (remove the CLAVE 100 header)
  const cleanMessage = message
    .replace(/🚨 CLAVE 100 - EMERGENCIA MÁXIMA 🚨\n\n/, '')
    .trim();

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center p-4",
        "bg-black/90 backdrop-blur-sm",
        "transition-opacity duration-300",
        showContent ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Pulsing background effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-destructive/20 animate-pulse" />
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, rgba(220, 38, 38, 0.3) 50%, transparent 100%)',
            animation: 'pulse-ring 2s ease-out infinite',
          }}
        />
      </div>

      {/* Content */}
      <div 
        className={cn(
          "relative max-w-md w-full bg-background border-2 border-destructive rounded-2xl shadow-2xl overflow-hidden",
          "transform transition-all duration-500",
          showContent ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        )}
      >
        {/* Header with animated warning */}
        <div className="bg-destructive p-4 flex items-center gap-3">
          <div className="relative">
            <AlertTriangle className="w-10 h-10 text-destructive-foreground animate-pulse" />
            <div className="absolute inset-0 bg-destructive-foreground/30 rounded-full animate-ping" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-destructive-foreground">
              🚨 CLAVE 100
            </h2>
            <p className="text-sm text-destructive-foreground/90">
              EMERGENCIA MÁXIMA
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="text-destructive-foreground hover:bg-destructive-foreground/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Sender */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-lg">🆘</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mensaje de</p>
              <p className="font-semibold">{senderName}</p>
            </div>
          </div>

          {/* Message */}
          <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
            <p className="text-sm whitespace-pre-wrap break-words">
              {cleanMessage}
            </p>
          </div>

          {/* Location button if present */}
          {locationUrl && (
            <Button
              variant="outline"
              className="w-full border-primary"
              onClick={() => window.open(locationUrl, '_blank')}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Ver ubicación en el mapa
            </Button>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onDismiss}
              className="flex-1"
            >
              Entendido
            </Button>
            <Button
              onClick={() => {
                onOpenChat();
                onDismiss();
              }}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Responder
            </Button>
          </div>
        </div>

        {/* Bottom warning bar */}
        <div className="bg-amber-500/20 border-t border-amber-500/30 px-4 py-2">
          <p className="text-xs text-center text-amber-700 dark:text-amber-400">
            ⚠️ Esta es una alerta de emergencia real
          </p>
        </div>
      </div>

      {/* CSS for pulse ring animation */}
      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.4;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
};
