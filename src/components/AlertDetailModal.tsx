// Full-screen Alert Detail Modal
// Shows complete alert info with timestamp, location, and responder status

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  X, 
  MapPin, 
  ExternalLink, 
  Clock, 
  Navigation, 
  User,
  Loader2,
  Trash2,
  Phone,
  HeartHandshake,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MedicalInfoBadge } from './MedicalInfoBadge';
import { ResponderEtaCountdown } from './ResponderEtaCountdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PanicEvent {
  id: string;
  user_id: string;
  panic_type: string;
  lat: number;
  lng: number;
  resolved: boolean;
  created_at: string;
}

interface HelpRequest {
  id: string;
  user_id: string;
  kind: string;
  lat: number;
  lng: number;
  message: string | null;
  resolved: boolean;
  created_at: string;
  responding_by?: string | null;
  responding_started_at?: string | null;
  arrived_at?: string | null;
}

interface ActiveResponder {
  request_id: string;
  responder_id: string;
  responder_lat: number;
  responder_lng: number;
  emergency_lat: number;
  emergency_lng: number;
  responding_started_at: string;
  speed: number | null;
  distance_km: number;
  eta_minutes: number | null;
  arrived_at: string | null;
}

interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface AlertDetailModalProps {
  alert: PanicEvent | HelpRequest | null;
  alertType: 'panic' | 'help' | null;
  isOpen: boolean;
  onClose: () => void;
  onViewLocation: (lat: number, lng: number) => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  isOwner?: boolean;
  isRescatista?: boolean;
  canDelete?: boolean;
  responders?: ActiveResponder[];
  currentUserId?: string;
  userPosition?: GeoPosition | null;
  onRespond?: (requestId: string) => Promise<boolean>;
  onCancelResponse?: () => Promise<void>;
}

const PANIC_TYPE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia Propia', emoji: '🚑', color: 'bg-red-500' },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia Tercero', emoji: '🚑', color: 'bg-red-500' },
  'PATRULLA': { label: 'Patrulla', emoji: '🚔', color: 'bg-blue-500' },
  'MECANICO': { label: 'Mecánico', emoji: '🔧', color: 'bg-yellow-500' },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘', color: 'bg-orange-500' },
};

const HELP_KIND_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  'SISMO_AYUDA_14': { label: 'Ayuda 14 - Emergencia Sísmica', emoji: '🆘', color: 'bg-red-600' },
  'SISMO_OK': { label: 'Reporte OK', emoji: '✅', color: 'bg-green-500' },
  'SISMO_DAMAGE': { label: 'Daños Reportados', emoji: '⚠️', color: 'bg-orange-500' },
};

// Calculate distance between two coordinates in km (Haversine formula)
const calculateDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const MAX_RESPONSE_RADIUS_KM = 10; // 10km radius

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({
  alert,
  alertType,
  isOpen,
  onClose,
  onViewLocation,
  onDelete,
  isDeleting = false,
  isOwner = false,
  isRescatista = false,
  canDelete = false,
  responders = [],
  currentUserId,
  userPosition,
  onRespond,
  onCancelResponse,
}) => {
  const [isResponding, setIsResponding] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean | null>(null);
  const [distanceToAlert, setDistanceToAlert] = useState<number | null>(null);

  // Check if user is already responding
  const isAlreadyResponding = currentUserId && responders.some(
    r => r.responder_id === currentUserId && r.request_id === alert?.id
  );

  // Calculate distance when modal opens or position changes
  useEffect(() => {
    if (!alert || !userPosition) {
      setIsWithinRadius(null);
      setDistanceToAlert(null);
      return;
    }

    const distance = calculateDistanceKm(
      userPosition.lat,
      userPosition.lng,
      alert.lat,
      alert.lng
    );
    setDistanceToAlert(distance);
    setIsWithinRadius(distance <= MAX_RESPONSE_RADIUS_KM);
  }, [alert, userPosition]);

  if (!isOpen || !alert) return null;

  const isPanic = alertType === 'panic';
  const config = isPanic
    ? PANIC_TYPE_CONFIG[(alert as PanicEvent).panic_type] || { label: 'Emergencia', emoji: '🆘', color: 'bg-red-500' }
    : HELP_KIND_CONFIG[(alert as HelpRequest).kind] || { label: 'Ayuda', emoji: '🆘', color: 'bg-red-500' };

  const openGoogleMaps = () => {
    window.open(`https://maps.google.com/?q=${alert.lat},${alert.lng}`, '_blank');
  };

  const openGoogleMapsDirections = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${alert.lat},${alert.lng}`, '_blank');
  };

  const callEmergency = (number: string) => {
    window.location.href = `tel:${number}`;
  };

  const handleRespond = async () => {
    if (!onRespond || !alert || isPanic) return;
    
    setIsResponding(true);
    try {
      const success = await onRespond(alert.id);
      if (success) {
        toast({
          title: "¡Respondiendo!",
          description: "Has comenzado a responder a esta emergencia. Tu ubicación se compartirá con el solicitante.",
        });
      } else {
        toast({
          title: "Error",
          description: "No se pudo iniciar la respuesta. Verifica que estés dentro del radio de 10km.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[AlertDetailModal] Error responding:', error);
      toast({
        title: "Error",
        description: "Error al responder a la alerta",
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  // Get responders for this alert
  const alertResponders = responders.filter(r => r.request_id === alert.id);
  const hasResponders = alertResponders.length > 0;
  const arrivedResponders = alertResponders.filter(r => r.arrived_at);

  // Show respond button for help requests if: is rescatista, not owner, not already responding, is within radius
  const canRespond = !isPanic && isRescatista && !isOwner && !isAlreadyResponding && onRespond;

  return (
    <div 
      className="fixed inset-0 z-[3000] bg-background flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-white text-xl`}>
            {config.emoji}
          </div>
          <div>
            <h1 className="font-semibold text-foreground">{config.label}</h1>
            {isOwner && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30">
                MI ALERTA
              </Badge>
            )}
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <X className="w-5 h-5" />
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Timestamp Section */}
        <section className="bg-card rounded-lg p-4 border border-border">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Tiempo
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Creada</span>
              <span className="font-medium text-foreground">
                {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: es })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Hora exacta</span>
              <span className="font-medium text-foreground">
                {format(new Date(alert.created_at), 'HH:mm:ss', { locale: es })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Fecha</span>
              <span className="font-medium text-foreground">
                {format(new Date(alert.created_at), 'dd MMM yyyy', { locale: es })}
              </span>
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section className="bg-card rounded-lg p-4 border border-border">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Ubicación
          </h2>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Latitud</span>
              <span className="font-mono text-sm text-foreground">{alert.lat.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Longitud</span>
              <span className="font-mono text-sm text-foreground">{alert.lng.toFixed(6)}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="secondary" 
              className="w-full touch-manipulation"
              onClick={() => {
                onViewLocation(alert.lat, alert.lng);
                onClose();
              }}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Ver en mapa
            </Button>
            <Button 
              variant="secondary" 
              className="w-full touch-manipulation"
              onClick={openGoogleMaps}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Google Maps
            </Button>
          </div>
          <Button 
            variant="default" 
            className="w-full mt-2 touch-manipulation"
            onClick={openGoogleMapsDirections}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Navigation className="w-4 h-4 mr-2" />
            Navegar hacia aquí
          </Button>
        </section>

        {/* Message (for help requests) */}
        {!isPanic && (alert as HelpRequest).message && (
          <section className="bg-card rounded-lg p-4 border border-border">
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Mensaje
            </h2>
            <p className="text-foreground">{(alert as HelpRequest).message}</p>
          </section>
        )}

        {/* Responder Status Section */}
        <section className="bg-card rounded-lg p-4 border border-border">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Estado de Respuesta
          </h2>
          
          {hasResponders ? (
            <div className="space-y-3">
              {arrivedResponders.length > 0 && (
                <div className="flex items-center gap-2 text-green-600 bg-green-500/10 rounded-lg p-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="font-medium">
                    {arrivedResponders.length} rescatista{arrivedResponders.length > 1 ? 's' : ''} en el lugar
                  </span>
                </div>
              )}
              
              {alertResponders.filter(r => !r.arrived_at).map((responder, index) => (
                <div key={responder.responder_id} className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      Rescatista {alertResponders.length > 1 ? index + 1 : ''}
                    </span>
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-600">
                      En camino
                    </Badge>
                  </div>
                  <ResponderEtaCountdown
                    distanceKm={responder.distance_km}
                    etaMinutes={responder.eta_minutes}
                    speed={responder.speed}
                    respondingStartedAt={responder.responding_started_at}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                <User className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                Esperando respuesta de rescatistas...
              </p>
            </div>
          )}
        </section>

        {/* Medical Info */}
        {isRescatista && (
          <section className="bg-card rounded-lg p-4 border border-border">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Información Médica
            </h2>
            <MedicalInfoBadge userId={alert.user_id} isRescatista={isRescatista} />
          </section>
        )}

        {/* Emergency Contacts */}
        <section className="bg-card rounded-lg p-4 border border-border">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Llamar Servicios de Emergencia
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="touch-manipulation"
              onClick={() => callEmergency('911')}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              🚔 911
            </Button>
            <Button 
              variant="outline" 
              className="touch-manipulation"
              onClick={() => callEmergency('065')}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              🚑 065 Cruz Roja
            </Button>
            <Button 
              variant="outline" 
              className="touch-manipulation"
              onClick={() => callEmergency('066')}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              🚒 066 Bomberos
            </Button>
            <Button 
              variant="outline" 
              className="touch-manipulation"
              onClick={() => callEmergency('089')}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              🆘 089 Denuncia
            </Button>
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <footer className="p-4 border-t border-border bg-card sticky bottom-0 space-y-2">
        {/* Respond Button for Rescatistas */}
        {canRespond && (
          <>
            {isWithinRadius === false && (
              <div className="flex items-center gap-2 text-warning bg-warning/10 rounded-lg p-3 mb-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">
                  Estás a {distanceToAlert?.toFixed(1)}km. Debes estar dentro de 10km para responder.
                </span>
              </div>
            )}
            <Button 
              variant="default"
              className="w-full touch-manipulation bg-primary hover:bg-primary/90"
              onClick={handleRespond}
              disabled={isResponding || !isWithinRadius || !userPosition}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isResponding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <HeartHandshake className="w-4 h-4 mr-2" />
              )}
              {!userPosition 
                ? 'Esperando ubicación...'
                : isWithinRadius === false 
                  ? 'Fuera de rango (10km)'
                  : 'Responder a esta alerta'
              }
            </Button>
          </>
        )}

        {/* Already Responding - Show status and cancel button */}
        {isAlreadyResponding && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary bg-primary/10 rounded-lg p-3">
              <HeartHandshake className="w-4 h-4" />
              <span className="font-medium">Ya estás respondiendo a esta alerta</span>
            </div>
            {onCancelResponse && (
              <Button 
                variant="outline"
                className="w-full touch-manipulation border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={async () => {
                  setIsCancelling(true);
                  try {
                    await onCancelResponse();
                    toast({
                      title: "Respuesta cancelada",
                      description: "Has dejado de responder a esta alerta.",
                    });
                  } catch (error) {
                    console.error('[AlertDetailModal] Error cancelling response:', error);
                    toast({
                      title: "Error",
                      description: "No se pudo cancelar la respuesta",
                      variant: "destructive",
                    });
                  } finally {
                    setIsCancelling(false);
                  }
                }}
                disabled={isCancelling}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {isCancelling ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Cancelar mi respuesta
              </Button>
            )}
          </div>
        )}

        {/* Delete/Resolve Button */}
        {canDelete && onDelete && (
          <Button 
            variant="destructive" 
            className="w-full touch-manipulation"
            onClick={onDelete}
            disabled={isDeleting}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {isOwner ? 'Eliminar mi alerta' : 'Resolver alerta'}
          </Button>
        )}
      </footer>
    </div>
  );
};

export default AlertDetailModal;
