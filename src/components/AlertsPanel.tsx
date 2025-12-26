// Alerts Panel for COMUNIDAD EX SOS
// Shows recent panic events and help requests from the community

import React, { useState } from 'react';
import { AlertTriangle, X, Ambulance, Shield, Wrench, HardHat, MapPin, Clock, ExternalLink, Trash2, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MedicalInfoBadge } from './MedicalInfoBadge';
import { SwipeToDelete } from './SwipeToDelete';
import { AlertDetailModal } from './AlertDetailModal';
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

interface AlertsPanelProps {
  panicEvents: PanicEvent[];
  helpRequests: HelpRequest[];
  onViewLocation: (lat: number, lng: number) => void;
  isRescatista?: boolean;
  currentUserId?: string;
  onResolveHelpRequest?: (requestId: string) => Promise<boolean>;
  onResolvePanicEvent?: (eventId: string) => Promise<boolean>;
  activeResponders?: ActiveResponder[];
  userPosition?: GeoPosition | null;
  onRespondToRequest?: (requestId: string) => Promise<boolean>;
  onCancelResponse?: () => Promise<void>;
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
  currentUserId,
  onResolveHelpRequest,
  onResolvePanicEvent,
  activeResponders = [],
  userPosition,
  onRespondToRequest,
  onCancelResponse,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<'panic' | 'help' | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<PanicEvent | HelpRequest | null>(null);
  const [selectedAlertType, setSelectedAlertType] = useState<'panic' | 'help' | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
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

  const handleDeleteClick = (id: string, type: 'panic' | 'help') => {
    setConfirmDeleteId(id);
    setConfirmDeleteType(type);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId || !confirmDeleteType) {
      console.warn('[AlertsPanel] handleConfirmDelete called without id/type');
      return;
    }
    
    console.log('[AlertsPanel] Attempting delete:', { confirmDeleteId, confirmDeleteType });
    setDeletingId(confirmDeleteId);
    
    try {
      let success = false;
      
      if (confirmDeleteType === 'panic') {
        if (!onResolvePanicEvent) {
          console.error('[AlertsPanel] onResolvePanicEvent not provided');
        } else {
          success = await onResolvePanicEvent(confirmDeleteId);
        }
      } else if (confirmDeleteType === 'help') {
        if (!onResolveHelpRequest) {
          console.error('[AlertsPanel] onResolveHelpRequest not provided');
        } else {
          success = await onResolveHelpRequest(confirmDeleteId);
        }
      }
      
      console.log('[AlertsPanel] Delete result:', { success });
      
      if (success) {
        toast({
          title: "Alerta eliminada",
          description: "Tu alerta ha sido eliminada correctamente",
        });
      } else {
        toast({
          title: "Error",
          description: "No se pudo eliminar la alerta (revisa permisos)",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[AlertsPanel] Error deleting alert:', error);
      toast({
        title: "Error",
        description: `Error al eliminar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
      setConfirmDeleteType(null);
    }
  };

  // Direct swipe delete (no confirmation for faster UX)
  const handleSwipeDelete = async (id: string, type: 'panic' | 'help') => {
    console.log('[AlertsPanel] handleSwipeDelete:', { id, type });
    setDeletingId(id);
    
    try {
      let success = false;
      
      if (type === 'panic') {
        if (!onResolvePanicEvent) {
          console.error('[AlertsPanel] onResolvePanicEvent not provided for swipe');
        } else {
          success = await onResolvePanicEvent(id);
        }
      } else if (type === 'help') {
        if (!onResolveHelpRequest) {
          console.error('[AlertsPanel] onResolveHelpRequest not provided for swipe');
        } else {
          success = await onResolveHelpRequest(id);
        }
      }
      
      console.log('[AlertsPanel] Swipe delete result:', { success });
      
      if (success) {
        toast({
          title: "Alerta eliminada",
          description: "Tu alerta ha sido eliminada",
        });
      } else {
        toast({
          title: "Error",
          description: "No se pudo eliminar (revisa permisos)",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[AlertsPanel] Swipe delete error:', error);
      toast({
        title: "Error",
        description: `Error al eliminar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const isOwner = (userId: string) => currentUserId === userId;
  const canDelete = (userId: string) => isOwner(userId) || isRescatista;

  const openAlertDetail = (alert: PanicEvent | HelpRequest, type: 'panic' | 'help') => {
    setSelectedAlert(alert);
    setSelectedAlertType(type);
    setSheetOpen(false); // Close sheet when opening detail
  };

  const closeAlertDetail = () => {
    setSelectedAlert(null);
    setSelectedAlertType(null);
  };

  const handleDeleteFromModal = async () => {
    if (!selectedAlert || !selectedAlertType) return;
    
    setDeletingId(selectedAlert.id);
    
    try {
      let success = false;
      
      if (selectedAlertType === 'panic') {
        if (onResolvePanicEvent) {
          success = await onResolvePanicEvent(selectedAlert.id);
        }
      } else {
        if (onResolveHelpRequest) {
          success = await onResolveHelpRequest(selectedAlert.id);
        }
      }
      
      if (success) {
        toast({
          title: "Alerta eliminada",
          description: "La alerta ha sido eliminada correctamente",
        });
        closeAlertDetail();
      } else {
        toast({
          title: "Error",
          description: "No se pudo eliminar la alerta",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[AlertsPanel] Delete from modal error:', error);
      toast({
        title: "Error",
        description: `Error al eliminar: ${error instanceof Error ? error.message : 'desconocido'}`,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
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
                      const isMyAlert = isOwner(event.user_id);
                      
                      const alertContent = (
                        <div
                          className={`border p-3 transition-colors cursor-pointer ${
                            isMyAlert ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'
                          } ${isMyAlert ? 'rounded-none' : 'rounded-lg bg-card hover:bg-accent/50 active:bg-accent'}`}
                          onClick={() => openAlertDetail(event, 'panic')}
                          onTouchEnd={(e) => {
                            // Only open if not clicking a button
                            if ((e.target as HTMLElement).closest('button')) return;
                            e.preventDefault();
                            openAlertDetail(event, 'panic');
                          }}
                          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <div className={`w-8 h-8 rounded-full ${config.color} flex items-center justify-center text-white`}>
                                {config.icon}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-foreground text-sm flex items-center gap-2">
                                  {config.emoji} {config.label}
                                  {isMyAlert && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30">
                                      MI ALERTA
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(event.created_at)}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 h-8 text-xs touch-manipulation"
                              onClick={() => onViewLocation(event.lat, event.lng)}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                onViewLocation(event.lat, event.lng);
                              }}
                              style={{ WebkitTapHighlightColor: 'transparent' }}
                            >
                              <MapPin className="w-3 h-3 mr-1" />
                              Ver en mapa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs touch-manipulation"
                              onClick={() => openGoogleMaps(event.lat, event.lng)}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                openGoogleMaps(event.lat, event.lng);
                              }}
                              style={{ WebkitTapHighlightColor: 'transparent' }}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                            <MedicalInfoBadge userId={event.user_id} isRescatista={isRescatista} />
                            
                            {/* Delete button fallback (owner + rescatistas) */}
                            {canDelete(event.user_id) && onResolvePanicEvent && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 touch-manipulation"
                                onClick={() => handleDeleteClick(event.id, 'panic')}
                                onTouchEnd={(e) => {
                                  e.preventDefault();
                                  handleDeleteClick(event.id, 'panic');
                                }}
                                disabled={deletingId === event.id}
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                      
                      // Wrap owner's alerts with SwipeToDelete
                      if (isMyAlert && onResolvePanicEvent) {
                        return (
                          <SwipeToDelete
                            key={event.id}
                            onDelete={() => handleSwipeDelete(event.id, 'panic')}
                            disabled={deletingId === event.id}
                          >
                            {alertContent}
                          </SwipeToDelete>
                        );
                      }
                      
                      return (
                        <div key={event.id}>
                          {alertContent}
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
                        const isMyAlert = isOwner(request.user_id);
                        
                        const alertContent = (
                          <div
                            className={`border p-3 transition-colors cursor-pointer ${
                              isMyAlert ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'
                            } ${isMyAlert ? 'rounded-none' : 'rounded-lg bg-card hover:bg-accent/50 active:bg-accent'}`}
                            onClick={() => openAlertDetail(request, 'help')}
                            onTouchEnd={(e) => {
                              // Only open if not clicking a button
                              if ((e.target as HTMLElement).closest('button')) return;
                              e.preventDefault();
                              openAlertDetail(request, 'help');
                            }}
                            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-foreground text-sm flex items-center gap-2">
                                  {config.emoji} {config.label}
                                  {isMyAlert && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30">
                                      MI ALERTA
                                    </Badge>
                                  )}
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
                              <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1 h-8 text-xs touch-manipulation"
                                onClick={() => onViewLocation(request.lat, request.lng)}
                                onTouchEnd={(e) => {
                                  e.preventDefault();
                                  onViewLocation(request.lat, request.lng);
                                }}
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                              >
                                <MapPin className="w-3 h-3 mr-1" />
                                Ver en mapa
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs touch-manipulation"
                                onClick={() => openGoogleMaps(request.lat, request.lng)}
                                onTouchEnd={(e) => {
                                  e.preventDefault();
                                  openGoogleMaps(request.lat, request.lng);
                                }}
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                              <MedicalInfoBadge userId={request.user_id} isRescatista={isRescatista} />
                              
                              {/* Delete button fallback (owner + rescatistas) */}
                              {canDelete(request.user_id) && onResolveHelpRequest && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 touch-manipulation"
                                  onClick={() => handleDeleteClick(request.id, 'help')}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    handleDeleteClick(request.id, 'help');
                                  }}
                                  disabled={deletingId === request.id}
                                  style={{ WebkitTapHighlightColor: 'transparent' }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                        
                        // Wrap owner's alerts with SwipeToDelete
                        if (isMyAlert && onResolveHelpRequest) {
                          return (
                            <SwipeToDelete
                              key={request.id}
                              onDelete={() => handleSwipeDelete(request.id, 'help')}
                              disabled={deletingId === request.id}
                            >
                              {alertContent}
                            </SwipeToDelete>
                          );
                        }
                        
                        return (
                          <div key={request.id}>
                            {alertContent}
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

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta alerta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la alerta como resuelta y ya no será visible para otros usuarios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Detail Modal */}
      <AlertDetailModal
        alert={selectedAlert}
        alertType={selectedAlertType}
        isOpen={!!selectedAlert}
        onClose={closeAlertDetail}
        onViewLocation={(lat, lng) => {
          closeAlertDetail();
          onViewLocation(lat, lng);
        }}
        onDelete={handleDeleteFromModal}
        isDeleting={deletingId === selectedAlert?.id}
        isOwner={selectedAlert ? isOwner(selectedAlert.user_id) : false}
        isRescatista={isRescatista}
        canDelete={selectedAlert ? canDelete(selectedAlert.user_id) : false}
        responders={activeResponders}
        currentUserId={currentUserId}
        userPosition={userPosition}
        onRespond={onRespondToRequest}
        onCancelResponse={onCancelResponse}
      />
    </>
  );
};

export default AlertsPanel;
