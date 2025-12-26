// Alerts Panel for COMUNIDAD EX SOS
// Shows recent panic events and help requests from the community

import React from 'react';
import { AlertTriangle, X, Ambulance, Shield, Wrench, HardHat, MapPin, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MedicalInfoBadge } from './MedicalInfoBadge';

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
}

interface AlertsPanelProps {
  panicEvents: PanicEvent[];
  helpRequests: HelpRequest[];
  onViewLocation: (lat: number, lng: number) => void;
  isRescatista?: boolean;
}

const PANIC_TYPE_CONFIG: Record<string, { label: string; emoji: string; color: string; icon: React.ReactNode }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia Propia', emoji: '🚑', color: 'bg-red-500', icon: <Ambulance className="w-4 h-4" /> },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia Tercero', emoji: '🚑', color: 'bg-red-500', icon: <Ambulance className="w-4 h-4" /> },
  'PATRULLA': { label: 'Patrulla', emoji: '🚔', color: 'bg-blue-500', icon: <Shield className="w-4 h-4" /> },
  'MECANICO': { label: 'Mecánico', emoji: '🔧', color: 'bg-yellow-500', icon: <Wrench className="w-4 h-4" /> },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘', color: 'bg-orange-500', icon: <HardHat className="w-4 h-4" /> },
};

const HELP_KIND_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  'SISMO_AYUDA_14': { label: 'Ayuda 14 - Emergencia Sísmica', emoji: '🆘', color: 'bg-red-600' },
  'SISMO_OK': { label: 'Reporte OK', emoji: '✅', color: 'bg-green-500' },
  'SISMO_DAMAGE': { label: 'Daños Reportados', emoji: '⚠️', color: 'bg-orange-500' },
};

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  panicEvents,
  helpRequests,
  onViewLocation,
  isRescatista = false,
}) => {
  const totalAlerts = panicEvents.length + helpRequests.filter(r => r.kind === 'SISMO_AYUDA_14').length;

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch {
      return 'hace un momento';
    }
  };

  const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative bg-card/95 backdrop-blur-sm border-border hover:bg-accent"
        >
          <AlertTriangle className="w-4 h-4 mr-2 text-panic" />
          Alertas
          {totalAlerts > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
            >
              {totalAlerts}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[340px] sm:w-[400px] p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-panic" />
            Alertas de la Comunidad
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-4">
            {/* Panic Events Section */}
            {panicEvents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-panic animate-pulse" />
                  Alertas SOS Activas ({panicEvents.length})
                </h3>
                <div className="space-y-2">
                  {panicEvents.map((event) => {
                    const config = PANIC_TYPE_CONFIG[event.panic_type] || {
                      label: 'Emergencia',
                      emoji: '🆘',
                      color: 'bg-red-500',
                      icon: <AlertTriangle className="w-4 h-4" />,
                    };
                    return (
                      <div
                        key={event.id}
                        className="bg-card border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full ${config.color} flex items-center justify-center text-white`}>
                              {config.icon}
                            </div>
                            <div>
                              <div className="font-medium text-foreground text-sm">
                                {config.emoji} {config.label}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatTime(event.created_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 h-8 text-xs"
                            onClick={() => onViewLocation(event.lat, event.lng)}
                          >
                            <MapPin className="w-3 h-3 mr-1" />
                            Ver en mapa
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => openGoogleMaps(event.lat, event.lng)}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                          <MedicalInfoBadge userId={event.user_id} isRescatista={isRescatista} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Help Requests Section */}
            {helpRequests.filter(r => r.kind === 'SISMO_AYUDA_14').length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  Solicitudes de Ayuda ({helpRequests.filter(r => r.kind === 'SISMO_AYUDA_14').length})
                </h3>
                <div className="space-y-2">
                  {helpRequests
                    .filter(r => r.kind === 'SISMO_AYUDA_14')
                    .map((request) => {
                      const config = HELP_KIND_CONFIG[request.kind] || {
                        label: 'Ayuda',
                        emoji: '🆘',
                        color: 'bg-red-500',
                      };
                      return (
                        <div
                          key={request.id}
                          className="bg-card border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-foreground text-sm">
                                {config.emoji} {config.label}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(request.created_at)}
                              </div>
                              {request.message && (
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                  {request.message}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 h-8 text-xs"
                              onClick={() => onViewLocation(request.lat, request.lng)}
                            >
                              <MapPin className="w-3 h-3 mr-1" />
                              Ver en mapa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => openGoogleMaps(request.lat, request.lng)}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                            <MedicalInfoBadge userId={request.user_id} isRescatista={isRescatista} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {totalAlerts === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">Sin alertas activas</h3>
                <p className="text-sm text-muted-foreground">
                  Cuando alguien de la comunidad necesite ayuda, aparecerá aquí.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default AlertsPanel;
