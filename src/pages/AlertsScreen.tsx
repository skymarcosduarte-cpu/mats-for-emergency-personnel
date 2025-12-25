// Alerts Screen for COMUNIDAD EX SOS
// USGS earthquakes + "4/10" quick report + "14" help + notifications

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, MapPin, Clock, ChevronRight, AlertCircle, Loader2, Bell, Check, Trash2, ShoppingBag, WifiOff, Navigation } from 'lucide-react';
import { useEarthquakeHistory, EarthquakeWithDistance } from '@/hooks/useEarthquakeHistory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediaCapture } from '@/components/MediaCapture';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useLocation, getGoogleMapsLink } from '@/hooks/useLocation';
import { useHelpRequests } from '@/hooks/useRealtime';
import { useNotifications } from '@/hooks/useNotifications';
import type { USGSEarthquake, QuakeIntensity, QuakeDamage, UserRole, MediaRef } from '@/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

// Removed - now using useEarthquakeHistory hook

interface AlertsScreenProps {
  userRole?: UserRole;
}

export const AlertsScreen: React.FC<AlertsScreenProps> = ({ 
  userRole = 'RESCATISTA' 
}) => {
  const [selectedQuake, setSelectedQuake] = useState<EarthquakeWithDistance | null>(null);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);
  const [showHelp14Dialog, setShowHelp14Dialog] = useState(false);
  const [checkinIntensity, setCheckinIntensity] = useState<QuakeIntensity>(4);
  const [checkinDamage, setCheckinDamage] = useState<QuakeDamage>('OK');
  const [help14Message, setHelp14Message] = useState('');
  const [help14Images, setHelp14Images] = useState<File[]>([]);
  const [help14Audio, setHelp14Audio] = useState<{ blob: Blob; duration: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const { position } = useLocation();
  const { requests: helpRequests } = useHelpRequests(position);
  const { 
    notifications, 
    unreadCount, 
    loading: notificationsLoading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();

  // Use earthquake history hook with offline caching
  const { 
    earthquakes, 
    loading, 
    isOffline, 
    lastUpdated, 
    refresh: loadEarthquakes 
  } = useEarthquakeHistory(position);

  // Handle quick "4 de 10" report
  const handleQuickCheckin = async (quake: EarthquakeWithDistance) => {
    if (!position) {
      alert('Se requiere ubicación GPS');
      return;
    }

    // Submit quick OK report
    console.log('Quick checkin:', {
      quake_id: quake.id,
      intensity: 4,
      damage: 'OK',
      lat: position.lat,
      lng: position.lng,
    });
    
    // Show toast or feedback
    alert('¡Reporte "4 de 10" enviado!');
  };

  // Handle "14" help request
  const handleHelp14Submit = async () => {
    if (!position) {
      alert('Se requiere ubicación GPS');
      return;
    }

    setSubmitting(true);

    try {
      const mediaRefs: MediaRef[] = [];
      
      // Upload images (would use Supabase storage)
      // For now, just log
      console.log('Help 14 submission:', {
        quake_id: selectedQuake?.id,
        lat: position.lat,
        lng: position.lng,
        message: help14Message,
        images: help14Images.length,
        audio: help14Audio ? 'yes' : 'no',
      });

      // Generate WhatsApp alert
      const message = `🆘 AYUDA 14 - SISMO%0A${userRole === 'FAMILIAR' ? '⚠️ FAMILIAR – NO PARAMÉDICO%0A' : ''}📍 ${getGoogleMapsLink(position.lat, position.lng)}%0A${help14Message ? `Mensaje: ${help14Message}` : ''}`;
      window.open(`https://wa.me/?text=${message}`, '_blank');

      setShowHelp14Dialog(false);
      resetHelp14Form();
    } catch (error) {
      console.error('Error submitting Help 14:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetHelp14Form = () => {
    setHelp14Message('');
    setHelp14Images([]);
    setHelp14Audio(null);
    setSelectedQuake(null);
  };

  // Format earthquake magnitude
  const formatMag = (mag: number) => mag.toFixed(1);

  // Format time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Get alert color based on magnitude
  const getMagColor = (mag: number) => {
    if (mag >= 6) return 'text-destructive';
    if (mag >= 5) return 'text-panic';
    if (mag >= 4) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <div className="flex-1 overflow-auto pb-20 scrollbar-thin">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Alertas</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadEarthquakes}
            disabled={loading}
          >
            <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="earthquakes" className="p-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="earthquakes">Sismos</TabsTrigger>
          <TabsTrigger value="help">Ayuda</TabsTrigger>
          <TabsTrigger value="notifications" className="relative">
            Notificaciones
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Earthquakes Tab */}
        <TabsContent value="earthquakes" className="space-y-3 mt-4">
          {/* Offline/Cache status indicator */}
          {(isOffline || lastUpdated) && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
              isOffline ? "bg-warning/10 text-warning" : "bg-muted/50 text-muted-foreground"
            )}>
              {isOffline && <WifiOff className="w-4 h-4" />}
              <span>
                {isOffline ? 'Sin conexión - ' : ''}
                {lastUpdated && `Actualizado: ${lastUpdated.toLocaleTimeString()}`}
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : earthquakes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay sismos recientes</p>
            </div>
          ) : (
            earthquakes.map((quake) => (
              <Card 
                key={quake.id} 
                className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setSelectedQuake(quake)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'text-2xl font-bold font-mono',
                          getMagColor(quake.properties.mag)
                        )}>
                          {formatMag(quake.properties.mag)}
                        </span>
                        {quake.properties.tsunami === 1 && (
                          <span className="badge-emergency">TSUNAMI</span>
                        )}
                      </div>
                      <div className="text-sm text-foreground font-medium">
                        {quake.properties.place}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(quake.properties.time)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {quake.geometry.coordinates[2].toFixed(0)}km prof.
                        </span>
                        {/* Distance from user */}
                        {quake.distanceMiles !== null && (
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <Navigation className="w-3 h-3" />
                            {quake.distanceMiles.toFixed(0)} mi
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>

                  {/* Quick action buttons */}
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickCheckin(quake);
                      }}
                    >
                      4 de 10 ✓
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedQuake(quake);
                        setShowHelp14Dialog(true);
                      }}
                    >
                      14 AYUDA
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Active Help Tab */}
        <TabsContent value="help" className="space-y-3 mt-4">
          {helpRequests.filter(r => !r.resolved).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay solicitudes de ayuda activas</p>
            </div>
          ) : (
            helpRequests
              .filter(r => !r.resolved)
              .map((req) => (
                <Card key={req.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-bold',
                        req.kind === 'SISMO_AYUDA_14' 
                          ? 'bg-destructive text-destructive-foreground' 
                          : 'bg-warning text-warning-foreground'
                      )}>
                        {req.kind === 'SISMO_AYUDA_14' ? '14 AYUDA' : 'AYUDA'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {req.message && (
                      <p className="text-sm text-foreground">{req.message}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => window.open(getGoogleMapsLink(req.lat, req.lng), '_blank')}
                    >
                      <MapPin className="w-4 h-4 mr-1" />
                      Ver ubicación
                    </Button>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-3 mt-4">
          {notifications.length > 0 && (
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <Check className="w-3 h-3 mr-1" />
                Marcar todo como leído
              </Button>
            </div>
          )}
          
          {notificationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No tienes notificaciones</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={cn(
                  "bg-card border-border transition-colors",
                  !notification.read && "border-l-4 border-l-primary"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={cn(
                        "p-2 rounded-full",
                        notification.type === 'marketplace_contact' 
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {notification.type === 'marketplace_contact' ? (
                          <ShoppingBag className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm",
                          !notification.read && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), { 
                            addSuffix: true,
                            locale: es 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Help 14 Dialog */}
      <Dialog open={showHelp14Dialog} onOpenChange={setShowHelp14Dialog}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              AYUDA 14 - Emergencia
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedQuake && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <strong>Sismo:</strong> M{formatMag(selectedQuake.properties.mag)} - {selectedQuake.properties.place}
              </div>
            )}

            {userRole === 'FAMILIAR' && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
                ⚠️ FAMILIAR – NO PARAMÉDICO / NO EX PARAMÉDICO
              </div>
            )}

            {/* Message */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Mensaje (opcional)
              </label>
              <textarea
                value={help14Message}
                onChange={(e) => setHelp14Message(e.target.value)}
                placeholder="Describe la situación..."
                className="w-full h-24 px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>

            {/* Photos */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Fotos (opcional)
              </label>
              <MediaCapture
                onImagesSelected={setHelp14Images}
                maxImages={3}
              />
            </div>

            {/* Voice note */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Nota de voz (opcional)
              </label>
              <VoiceRecorder
                onRecordingComplete={(blob, duration) => setHelp14Audio({ blob, duration })}
                onClear={() => setHelp14Audio(null)}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowHelp14Dialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleHelp14Submit}
                disabled={submitting || !position}
                className="flex-1"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Enviar AYUDA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlertsScreen;
