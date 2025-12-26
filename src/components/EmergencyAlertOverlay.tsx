// Prominent Emergency Alert Overlay for COMUNIDAD EX SOS
// Shows full-screen alert when someone in the community needs help

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, MapPin, Phone, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmergencyAlert {
  id: string;
  type: 'panic' | 'help';
  panicType?: string;
  kind?: string;
  lat: number;
  lng: number;
  message?: string | null;
  audioUrl?: string | null;
  audioDurationMs?: number | null;
  createdAt: string;
  userId: string;
}

interface EmergencyAlertOverlayProps {
  alert: EmergencyAlert | null;
  onDismiss: () => void;
  onViewLocation: () => void;
  onNavigate: () => void;
}

const PANIC_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia Propia', emoji: '🚑', color: 'bg-red-500' },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia Tercero', emoji: '🚑', color: 'bg-red-500' },
  'PATRULLA': { label: 'Patrulla', emoji: '🚔', color: 'bg-blue-500' },
  'MECANICO': { label: 'Mecánico', emoji: '🔧', color: 'bg-yellow-500' },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘', color: 'bg-orange-500' },
};

const HELP_KIND_LABELS: Record<string, { label: string; emoji: string }> = {
  'medical': { label: 'Ayuda Médica', emoji: '🏥' },
  'supplies': { label: 'Suministros', emoji: '📦' },
  'transport': { label: 'Transporte', emoji: '🚗' },
  'shelter': { label: 'Refugio', emoji: '🏠' },
  'other': { label: 'Ayuda General', emoji: '🤝' },
};

export const EmergencyAlertOverlay: React.FC<EmergencyAlertOverlayProps> = ({
  alert,
  onDismiss,
  onViewLocation,
  onNavigate,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState('');

  useEffect(() => {
    if (alert) {
      setIsVisible(true);
      // Vibrate on show
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }
    } else {
      setIsVisible(false);
    }
  }, [alert]);

  // Update time elapsed
  useEffect(() => {
    if (!alert) return;

    const updateTime = () => {
      const created = new Date(alert.createdAt);
      const now = new Date();
      const diffMs = now.getTime() - created.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      
      if (diffMins < 1) {
        setTimeElapsed('Hace menos de un minuto');
      } else if (diffMins === 1) {
        setTimeElapsed('Hace 1 minuto');
      } else if (diffMins < 60) {
        setTimeElapsed(`Hace ${diffMins} minutos`);
      } else {
        setTimeElapsed(`Hace más de una hora`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, [alert]);

  if (!alert || !isVisible) return null;

  const typeInfo = alert.type === 'panic' && alert.panicType
    ? PANIC_TYPE_LABELS[alert.panicType] || { label: 'Emergencia', emoji: '🆘', color: 'bg-red-500' }
    : HELP_KIND_LABELS[alert.kind || 'other'] || { label: 'Ayuda', emoji: '🤝' };

  const bgColor = alert.type === 'panic' 
    ? (PANIC_TYPE_LABELS[alert.panicType || '']?.color || 'bg-red-500')
    : 'bg-orange-500';

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 200);
  };

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[30000] flex items-center justify-center p-4 transition-all duration-200",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop with pulsing effect */}
      <div 
        className="absolute inset-0 bg-black/90 animate-pulse"
        onClick={handleDismiss}
      />
      
      {/* Alert Card */}
      <div 
        className={cn(
          "relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300",
          bgColor
        )}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 text-white">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <span className="text-4xl">{typeInfo.emoji}</span>
            </div>
            <div>
              <div className="text-sm opacity-80 uppercase tracking-wide font-medium">
                🚨 Alerta de Emergencia
              </div>
              <div className="text-2xl font-bold">
                {typeInfo.label}
              </div>
            </div>
          </div>
          
          <div className="text-white/80 text-sm">
            {timeElapsed}
          </div>
        </div>
        
        {/* Message if available */}
        {alert.message && (
          <div className="px-6 py-3 bg-black/20">
            <p className="text-white text-sm italic">"{alert.message}"</p>
          </div>
        )}
        
        {/* Audio indicator if available */}
        {alert.audioUrl && (
          <div className="px-6 py-2 bg-black/20 flex items-center gap-2 text-white/80 text-sm">
            <span>🎙️</span>
            <span>Mensaje de voz adjunto</span>
          </div>
        )}
        
        {/* Actions */}
        <div className="bg-white p-4 space-y-3">
          <div className="text-center text-sm text-muted-foreground mb-3">
            Un miembro de la comunidad necesita ayuda
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onViewLocation}
              variant="outline"
              className="h-14 flex-col gap-1"
            >
              <MapPin className="w-5 h-5" />
              <span className="text-xs">Ver en mapa</span>
            </Button>
            
            <Button
              onClick={onNavigate}
              className="h-14 flex-col gap-1 bg-primary"
            >
              <Navigation className="w-5 h-5" />
              <span className="text-xs">Navegar</span>
            </Button>
          </div>
          
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleDismiss}
          >
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmergencyAlertOverlay;
