// Alerts Screen for COMUNIDAD SOS
// USGS + SSN Mexico earthquakes + "Todo bien" quick report + "14" help + notifications + my alerts history

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, RefreshCw, MapPin, Clock, ChevronRight, AlertCircle, Loader2, Bell, Check, Trash2, ShoppingBag, WifiOff, Navigation, CloudRain, Flame, Wind, Route, X, CheckCircle2, Map, MessageCircle, Car, Plane } from 'lucide-react';
import { useEarthquakeHistory, EarthquakeWithDistance } from '@/hooks/useEarthquakeHistory';
import { useWeatherAlerts } from '@/hooks/useWeatherAlerts';
import { useMexicoAlerts, TropicalCycloneAlert, FireHotspot } from '@/hooks/useMexicoAlerts';
import { useGDACSAlerts, GDACSAlert, AEMETAlert } from '@/hooks/useGDACSAlerts';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediaCapture } from '@/components/MediaCapture';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { EmergencyRouteMap } from '@/components/EmergencyRouteMap';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ResponderEtaCountdown } from '@/components/ResponderEtaCountdown';
import { ThankYouDialog } from '@/components/ThankYouDialog';
import { InternalMessaging } from '@/components/InternalMessaging';
import { useLocation, getGoogleMapsLink } from '@/hooks/useLocation';
import { useHelpRequests, useActiveResponders } from '@/hooks/useRealtime';

import { useAuth } from '@/hooks/useAuth';
import { useEmergencyResponse } from '@/hooks/useEmergencyResponse';
import { supabase } from '@/integrations/supabase/client';
import type { USGSEarthquake, QuakeIntensity, QuakeDamage, UserRole, MediaRef } from '@/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { playUrgentAlert } from '@/lib/alertSound';
import { toast } from 'sonner';
import { MyAlertsHistory } from '@/components/MyAlertsHistory';
import { QuakeCheckinMap } from '@/components/QuakeCheckinMap';
import { CycloneMap } from '@/components/CycloneMap';
import { useActiveTrips, ActiveTrip } from '@/hooks/useActiveTrips';
import { useRecentQuakeCheckins } from '@/hooks/useRecentQuakeCheckins';

// Removed - now using useEarthquakeHistory hook

interface AlertsScreenProps {
  userRole?: UserRole;
}

export const AlertsScreen: React.FC<AlertsScreenProps> = ({ 
  userRole = 'SOS_ACTIVO' 
}) => {
  const [selectedQuake, setSelectedQuake] = useState<EarthquakeWithDistance | null>(null);
  const [showQuakeDetailDialog, setShowQuakeDetailDialog] = useState(false);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);
  const [showHelp14Dialog, setShowHelp14Dialog] = useState(false);
  const [checkinIntensity, setCheckinIntensity] = useState<QuakeIntensity>(4);
  const [checkinDamage, setCheckinDamage] = useState<QuakeDamage>('OK');
  const [help14Message, setHelp14Message] = useState('');
  const [help14Images, setHelp14Images] = useState<File[]>([]);
  const [help14Audio, setHelp14Audio] = useState<{ blob: Blob; duration: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showRouteMap, setShowRouteMap] = useState<{ requestId: string; lat: number; lng: number } | null>(null);
  
  // Messaging state
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const [messagingUserName, setMessagingUserName] = useState<string | null>(null);
  
  const { position } = useLocation();
  const { requests: helpRequests, resolvedRequests, resolveRequest } = useHelpRequests(position);
  const { user } = useAuth();
  const { 
    activeResponse, 
    isResponding, 
    startResponding, 
    stopResponding,
    markAsArrived,
    markAsResolved,
    showThankYou,
    dismissThankYou 
  } = useEmergencyResponse();
  const { responders } = useActiveResponders();

  // Active trips from community members
  const { trips: activeTrips, loading: tripsLoading, refresh: refreshTrips } = useActiveTrips();

  // Recent quake checkins for community tab
  const { checkins: quakeCheckins, loading: quakeCheckinsLoading, refresh: refreshQuakeCheckins } = useRecentQuakeCheckins(15);

  const { 
    earthquakes, 
    loading, 
    isOffline, 
    lastUpdated, 
    refresh: loadEarthquakes 
  } = useEarthquakeHistory(position);

  // Weather alerts (hurricanes, storms within 100 miles)
  const {
    alerts: weatherAlerts,
    loading: weatherLoading,
    error: weatherError,
    refresh: refreshWeather
  } = useWeatherAlerts(position);

  // Push notifications
  const { 
    permission: notifPermission, 
    isSupported: notifSupported,
    requestPermission: requestNotifPermission,
    showCycloneNotification,
    showFireNotification 
  } = usePushNotifications();

  // Callbacks for Mexico alerts notifications
  const handleNewCyclone = useCallback((cyclone: TropicalCycloneAlert) => {
    console.log('New cyclone detected:', cyclone.name);
    showCycloneNotification(cyclone);
    playUrgentAlert();
  }, [showCycloneNotification]);

  const handleNewFires = useCallback((fires: FireHotspot[], nearestDistance: number) => {
    console.log('New fires detected:', fires.length, 'nearest:', nearestDistance, 'km');
    showFireNotification(fires, nearestDistance);
    playUrgentAlert();
  }, [showFireNotification]);

  // Mexico federal alerts (NHC tropical cyclones + fire hotspots)
  const {
    cyclones,
    fires,
    loading: mexicoLoading,
    error: mexicoError,
    refresh: refreshMexico,
    getCycloneIcon,
    getCycloneSeverityColor,
    getFireConfidenceColor
  } = useMexicoAlerts(position, 500, {
    onNewCyclone: handleNewCyclone,
    onNewFires: handleNewFires,
  });

  // GDACS + AEMET international alerts
  const {
    gdacsAlerts,
    aemetAlerts,
    loading: gdacsLoading,
    error: gdacsError,
    refresh: refreshGDACS,
    getCategoryIcon,
    getCategoryLabel,
    getAlertLevelColor,
    getAEMETLevelColor,
  } = useGDACSAlerts();

  // Auto-refresh all alerts every 2 minutes while on this screen
  useEffect(() => {
    const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes

    const refreshAllAlerts = () => {
      console.log('[AlertsScreen] Auto-refreshing all alerts...');
      loadEarthquakes();
      refreshWeather();
      refreshGDACS();
      refreshMexico();
    };

    // Set up interval for automatic refresh
    const intervalId = setInterval(refreshAllAlerts, REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [loadEarthquakes, refreshWeather, refreshGDACS, refreshMexico]);

  // Handle messaging a user
  const handleMessageUser = useCallback((userId: string, displayName: string | null) => {
    setMessagingUserId(userId);
    setMessagingUserName(displayName);
    setMessagingOpen(true);
  }, []);

  // Handle quick "Todo bien" report
  const handleQuickCheckin = async (quake: EarthquakeWithDistance) => {
    if (!position) {
      toast.error('Se requiere ubicación GPS');
      return;
    }

    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }

    try {
      const { error } = await supabase
        .from('quake_checkins')
        .insert({
          user_id: user.id,
          usgs_event_id: quake.id,
          intensity: 4,
          damage_report: 'OK',
          lat: position.lat,
          lng: position.lng,
        });

      if (error) throw error;

      toast.success('¡Todo bien!', {
        description: 'Reporte enviado - Gracias por reportar',
      });
    } catch (error) {
      console.error('Error submitting quick checkin:', error);
      toast.error('Error al enviar reporte');
    }
  };

  // Handle "14" help request
  const handleHelp14Submit = async () => {
    if (!position) {
      toast.error('Se requiere ubicación GPS');
      return;
    }

    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }

    setSubmitting(true);

    try {
      let audioUrl: string | null = null;
      let audioDurationMs: number | null = null;

      // Upload voice note to storage if present
      if (help14Audio) {
        const mimeType = help14Audio.blob.type || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioFileName = `help-${Date.now()}-${user.id}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('reports_media')
          .upload(`audio/${audioFileName}`, help14Audio.blob, {
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) {
          console.error('Audio upload error:', uploadError);
        } else {
          audioUrl = uploadData.path;
          audioDurationMs = help14Audio.duration;
        }
      }

      // Create help request in database
      const { data: newRequest, error: insertError } = await supabase
        .from('help_requests')
        .insert({
          user_id: user.id,
          kind: 'SISMO_AYUDA_14',
          quake_event_id: selectedQuake?.id || null,
          lat: position.lat,
          lng: position.lng,
          message: help14Message || null,
          audio_url: audioUrl,
          audio_duration_ms: audioDurationMs,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating help request:', insertError);
        toast.error('Error al enviar alerta');
        return;
      }

      // Upload images if present
      if (help14Images.length > 0 && newRequest) {
        for (let i = 0; i < help14Images.length; i++) {
          const image = help14Images[i];
          const imagePath = `images/${newRequest.id}/${i}-${Date.now()}.jpg`;
          
          await supabase.storage
            .from('reports_media')
            .upload(imagePath, image, {
              contentType: image.type,
              upsert: false,
            });
          
          // Create media reference
          await supabase
            .from('report_media')
            .insert({
              report_id: newRequest.id,
              report_type: 'help_request',
              media_type: 'image',
              mime_type: image.type,
              storage_path: imagePath,
            });
        }
      }

      // Notify nearby users about the damage report
      if (selectedQuake) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          await fetch(`${supabaseUrl}/functions/v1/notify-quake-damage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: position.lat,
              lng: position.lng,
              magnitude: selectedQuake.properties.mag,
              place: selectedQuake.properties.place,
              intensity: 8, // Default high intensity for explicit damage reports
              damageReport: 'DAMAGE',
              creatorId: user.id,
            }),
          });
          console.log('Nearby users notified about quake damage');
        } catch (notifyError) {
          console.error('Error notifying nearby users:', notifyError);
        }
      }

      toast.success('¡Alerta enviada!', {
        description: 'Se notificó a la comunidad dentro de la app',
        duration: 5000,
      });

      setShowHelp14Dialog(false);
      resetHelp14Form();
    } catch (error) {
      console.error('Error submitting Help 14:', error);
      toast.error('Error al enviar alerta');
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

        {/* Notification permission prompt */}
        {notifSupported && notifPermission !== 'granted' && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Bell className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm text-foreground flex-1">
              Activa notificaciones para alertas de ciclones e incendios cercanos
            </p>
            <Button
              size="sm"
              variant="default"
              onClick={async () => {
                const granted = await requestNotifPermission();
                if (granted) {
                  toast.success('Notificaciones activadas', {
                    description: 'Recibirás alertas de ciclones e incendios cercanos',
                  });
                } else {
                  toast.error('Notificaciones bloqueadas', {
                    description: 'Habilítalas en la configuración de tu navegador',
                  });
                }
              }}
            >
              Activar
            </Button>
          </div>
        )}
      </div>

      <Tabs 
        defaultValue="help" 
        className="p-4"
        onValueChange={(value) => {
          // Auto-refresh when entering specific tabs
          if (value === 'earthquakes') {
            loadEarthquakes();
          } else if (value === 'otros') {
            refreshGDACS();
          } else if (value === 'weather') {
            refreshWeather();
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="help" className="relative text-xs px-1 font-semibold">
            🆘 Comunidad
            {helpRequests.filter(r => !r.resolved).length > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] animate-pulse"
              >
                {helpRequests.filter(r => !r.resolved).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="myalerts" className="text-xs px-1">
            📋 Mías
          </TabsTrigger>
          <TabsTrigger value="earthquakes" className="text-xs px-1">Sismos</TabsTrigger>
          <TabsTrigger value="otros" className="relative text-xs px-1">
            Otros
            {(gdacsAlerts.length > 0 || aemetAlerts.length > 0) && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {gdacsAlerts.length + aemetAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="weather" className="relative text-xs px-1">
            NOAA
            {weatherAlerts.length > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {weatherAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* My Alerts History Tab */}
        <TabsContent value="myalerts" className="mt-4">
          <MyAlertsHistory onOpenMessaging={handleMessageUser} />
        </TabsContent>

        {/* Earthquakes Tab */}
        <TabsContent value="earthquakes" className="space-y-3 mt-4">
          {/* Offline/Cache status indicator */}
          <div className={cn(
            "flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs",
            isOffline ? "bg-warning/10 text-warning" : "bg-muted/50 text-muted-foreground"
          )}>
            <div className="flex items-center gap-2">
              {isOffline && <WifiOff className="w-4 h-4" />}
              <span>
                {isOffline ? 'Sin conexión - ' : ''}
                {lastUpdated && `Actualizado: ${lastUpdated.toLocaleTimeString()}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-primary text-primary">USGS</Badge>
              <span className="text-muted-foreground">+</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-success text-success">SSN México</Badge>
            </div>
          </div>

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
                onClick={() => { setSelectedQuake(quake); setShowQuakeDetailDialog(true); }}
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
                        <Badge variant="outline" className={cn(
                          "text-[10px] px-1.5 py-0 h-4",
                          quake.source === 'SSN' ? "border-success text-success" : "border-primary text-primary"
                        )}>
                          {quake.source === 'SSN' ? 'SSN México' : 'USGS'}
                        </Badge>
                      </div>
                      <div className="text-sm text-foreground font-medium">
                        {quake.properties.place}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
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
                      Todo bien ✓
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
                      Reporto Daños
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Weather Alerts Tab */}
        <TabsContent value="weather" className="space-y-3 mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Alertas Climatológicas NOAA
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshWeather}
              disabled={weatherLoading}
            >
            <RefreshCw className={cn('w-4 h-4', weatherLoading && 'animate-spin')} />
            </Button>
          </div>

          {/* Cyclone Map */}
          <CycloneMap 
            alerts={weatherAlerts} 
            userLat={position?.lat}
            userLng={position?.lng}
          />

          {weatherLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : weatherError ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{weatherError}</p>
            </div>
          ) : weatherAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CloudRain className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay alertas de clima severo</p>
              <p className="text-xs mt-1">Huracanes, tormentas tropicales</p>
            </div>
          ) : (
            weatherAlerts.map((alert) => (
              <Card 
                key={alert.id} 
                className={cn(
                  "bg-card border-border",
                  alert.severity === 'Extreme' && "border-l-4 border-l-destructive",
                  alert.severity === 'Severe' && "border-l-4 border-l-panic",
                  alert.severity === 'Moderate' && "border-l-4 border-l-warning"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-full shrink-0",
                      alert.severity === 'Extreme' && "bg-destructive/10 text-destructive",
                      alert.severity === 'Severe' && "bg-panic/10 text-panic",
                      alert.severity === 'Moderate' && "bg-warning/10 text-warning",
                      !['Extreme', 'Severe', 'Moderate'].includes(alert.severity) && "bg-muted text-muted-foreground"
                    )}>
                      <CloudRain className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-bold",
                          alert.severity === 'Extreme' && "bg-destructive text-destructive-foreground",
                          alert.severity === 'Severe' && "bg-panic text-white",
                          alert.severity === 'Moderate' && "bg-warning text-warning-foreground"
                        )}>
                          {alert.severity === 'Extreme' ? 'EXTREMO' : 
                           alert.severity === 'Severe' ? 'SEVERO' : 
                           alert.severity === 'Moderate' ? 'MODERADO' : alert.severity}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {alert.source || 'NOAA'}
                        </Badge>
                        {alert.distanceMiles !== null && (
                          <span className="text-xs text-primary font-medium flex items-center gap-1">
                            <Navigation className="w-3 h-3" />
                            {alert.distanceMiles.toFixed(0)} mi
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground">{alert.event}</h3>
                      <p className="text-sm text-foreground mt-1">{alert.headline}</p>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                        {alert.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Efectivo: {new Date(alert.effective).toLocaleDateString()}
                        </span>
                        {alert.expires && (
                          <span>
                            Expira: {new Date(alert.expires).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Otros - GDACS + AEMET International Alerts Tab */}
        <TabsContent value="otros" className="space-y-3 mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Alertas internacionales (GDACS + AEMET España)
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshGDACS}
                disabled={gdacsLoading}
              >
                <RefreshCw className={cn('w-4 h-4', gdacsLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {gdacsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : gdacsError ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{gdacsError}</p>
            </div>
          ) : gdacsAlerts.length === 0 && aemetAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay alertas internacionales activas</p>
              <p className="text-xs mt-1">GDACS global + AEMET España</p>
            </div>
          ) : (
            <>
              {/* GDACS Alerts Section */}
              {gdacsAlerts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    🌍 GDACS - Alertas Globales ({gdacsAlerts.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Sistema Global de Alerta y Coordinación de Desastres
                  </p>
                  {gdacsAlerts.slice(0, 15).map((alert) => (
                    <Card 
                      key={alert.id} 
                      className={cn(
                        "bg-card border-border",
                        alert.alertLevel === 'red' && "border-l-4 border-l-destructive",
                        alert.alertLevel === 'orange' && "border-l-4 border-l-panic",
                        alert.alertLevel === 'green' && "border-l-4 border-l-success"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-full shrink-0 text-2xl",
                            getAlertLevelColor(alert.alertLevel)
                          )}>
                            {getCategoryIcon(alert.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                                alert.alertLevel === 'red' && "bg-destructive text-destructive-foreground",
                                alert.alertLevel === 'orange' && "bg-panic text-white",
                                alert.alertLevel === 'green' && "bg-success text-success-foreground",
                                !alert.alertLevel && "bg-muted text-muted-foreground"
                              )}>
                                {getCategoryLabel(alert.category)}
                              </span>
                              {alert.alertLevel && (
                                <Badge variant="outline" className={cn(
                                  "text-xs",
                                  alert.alertLevel === 'red' && "border-destructive text-destructive",
                                  alert.alertLevel === 'orange' && "border-panic text-panic",
                                  alert.alertLevel === 'green' && "border-success text-success"
                                )}>
                                  {alert.alertLevel === 'red' ? 'ROJO' : alert.alertLevel === 'orange' ? 'NARANJA' : 'VERDE'}
                                </Badge>
                              )}
                              {alert.magnitude && (
                                <Badge variant="outline" className="text-xs">
                                  M{alert.magnitude.toFixed(1)}
                                </Badge>
                              )}
                              {alert.country && (
                                <span className="text-xs text-muted-foreground">
                                  📍 {alert.country}
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-foreground text-sm line-clamp-2">{alert.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {alert.description.substring(0, 150)}
                              {alert.description.length > 150 && '...'}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(alert.pubDate).toLocaleDateString()}
                              </span>
                              {alert.link && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 h-auto text-xs"
                                  onClick={() => window.open(alert.link, '_blank')}
                                >
                                  Ver más →
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {gdacsAlerts.length > 15 && (
                    <p className="text-xs text-center text-muted-foreground">
                      +{gdacsAlerts.length - 15} alertas más
                    </p>
                  )}
                </div>
              )}

              {/* AEMET Spain Alerts Section */}
              {aemetAlerts.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    🇪🇸 AEMET - Avisos España ({aemetAlerts.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Agencia Estatal de Meteorología
                  </p>
                  {aemetAlerts.map((alert) => (
                    <Card 
                      key={alert.id} 
                      className={cn(
                        "bg-card border-border",
                        alert.level === 'rojo' && "border-l-4 border-l-destructive",
                        alert.level === 'naranja' && "border-l-4 border-l-panic",
                        alert.level === 'amarillo' && "border-l-4 border-l-warning"
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-full shrink-0",
                            getAEMETLevelColor(alert.level)
                          )}>
                            <CloudRain className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {alert.level && (
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                                  alert.level === 'rojo' && "bg-destructive text-destructive-foreground",
                                  alert.level === 'naranja' && "bg-panic text-white",
                                  alert.level === 'amarillo' && "bg-warning text-warning-foreground"
                                )}>
                                  {alert.level.toUpperCase()}
                                </span>
                              )}
                              {alert.zone && (
                                <span className="text-xs text-muted-foreground">
                                  📍 {alert.zone}
                                </span>
                              )}
                            </div>
                            <h4 className="font-medium text-foreground text-sm line-clamp-2">{alert.title}</h4>
                            {alert.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {alert.description.substring(0, 120)}
                                {alert.description.length > 120 && '...'}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(alert.pubDate).toLocaleDateString()}
                              </span>
                              {alert.link && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 h-auto text-xs"
                                  onClick={() => window.open(alert.link, '_blank')}
                                >
                                  Ver más →
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Active Help Tab */}
        <TabsContent value="help" className="space-y-4 mt-4">
          {/* Active Trips Section */}
          {activeTrips.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Car className="w-4 h-4 text-warning" />
                  Viajes activos de la comunidad
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={refreshTrips}
                  disabled={tripsLoading}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', tripsLoading && 'animate-spin')} />
                </Button>
              </div>
              <div className="space-y-2">
                {activeTrips.map((trip) => (
                  <Card key={trip.id} className="bg-warning/5 border-warning/30">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-full shrink-0",
                          trip.transit_type === 'FLIGHT' ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning"
                        )}>
                          {trip.transit_type === 'FLIGHT' ? (
                            <Plane className="w-4 h-4" />
                          ) : (
                            <Car className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {trip.nickname && (
                              <span className="text-xs font-semibold text-foreground">
                                {trip.nickname}
                              </span>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-warning/50 text-warning">
                              {trip.transit_type === 'FLIGHT' ? 'Vuelo' : 'Carretera'}
                            </Badge>
                            {trip.flight_number && (
                              <span className="text-[10px] text-muted-foreground">
                                ✈️ {trip.airline} {trip.flight_number}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-foreground">
                            <span className="text-muted-foreground">De:</span> {trip.origin}
                          </div>
                          <div className="text-sm text-foreground">
                            <span className="text-muted-foreground">A:</span> {trip.destination}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              ETA: {new Date(trip.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {trip.plates && (
                              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                🚗 {trip.plates}
                              </span>
                            )}
                            {trip.companions && (
                              <span className="text-[10px]">
                                👥 {trip.companions}
                              </span>
                            )}
                          </div>
                        </div>
                        {trip.user_id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleMessageUser(trip.user_id, trip.nickname || null)}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Quake Checkins Section */}
          {quakeCheckins.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  Reportes de sismos (24h)
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={refreshQuakeCheckins}
                  disabled={quakeCheckinsLoading}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', quakeCheckinsLoading && 'animate-spin')} />
                </Button>
              </div>
              <div className="space-y-2">
                {quakeCheckins.map((checkin) => (
                  <Card 
                    key={checkin.id} 
                    className={cn(
                      "bg-card border-border",
                      checkin.damage_report === 'DAMAGE' && "border-l-4 border-l-destructive"
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          checkin.damage_report === 'OK' && "bg-safe",
                          checkin.damage_report === 'UNSURE' && "bg-warning",
                          checkin.damage_report === 'DAMAGE' && "bg-destructive"
                        )}>
                          <span className="text-white font-bold text-sm">
                            {checkin.damage_report === 'OK' ? '✓' : 
                             checkin.damage_report === 'UNSURE' ? '?' : '⚠'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {checkin.nickname && (
                              <span className="text-xs font-semibold text-foreground">
                                {checkin.nickname}
                              </span>
                            )}
                            <Badge
                              variant={
                                checkin.damage_report === 'OK' ? 'default' :
                                checkin.damage_report === 'UNSURE' ? 'secondary' : 'destructive'
                              }
                              className="text-[10px] px-1.5 py-0"
                            >
                              {checkin.damage_report === 'OK' ? 'Todo bien' :
                               checkin.damage_report === 'UNSURE' ? 'No seguro' : 'Reporta daños'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(checkin.created_at), { 
                                addSuffix: true, 
                                locale: es 
                              })}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => window.open(getGoogleMapsLink(checkin.lat, checkin.lng), '_blank')}
                        >
                          <MapPin className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Help Requests Section */}
          {helpRequests.filter(r => !r.resolved).length === 0 && activeTrips.length === 0 && quakeCheckins.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay actividad de la comunidad</p>
            </div>
          ) : helpRequests.filter(r => !r.resolved).length > 0 && (
            <div className="space-y-2">
              {(activeTrips.length > 0 || quakeCheckins.length > 0) && (
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mt-4">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Solicitudes de ayuda
                </h3>
              )}
              {helpRequests
                .filter(r => !r.resolved)
                .map((req) => (
                <Card key={req.id} className={cn(
                  "bg-card border-border",
                  activeResponse?.requestId === req.id && "border-primary border-2"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-bold',
                            req.kind === 'SISMO_AYUDA_14' 
                              ? 'bg-destructive text-destructive-foreground' 
                              : 'bg-warning text-warning-foreground'
                          )}>
                            {req.kind === 'SISMO_AYUDA_14' ? 'Daños / Ayuda' : 'Ayuda'}
                          </span>
                          {(req as any).responding_by && (
                            <Badge variant="outline" className="text-xs text-primary border-primary/50">
                              <Route className="w-3 h-3 mr-1" />
                              Responder en camino
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(req.created_at).toLocaleTimeString()}
                          </span>
                          {(req as any).creator_name && (
                            <span className="text-xs text-muted-foreground">
                              • por <span className="font-medium text-foreground">{(req as any).creator_name}</span>
                            </span>
                          )}
                        </div>
                        {req.message && (
                          <p className="text-sm text-foreground">{req.message}</p>
                        )}
                        
                        {/* ETA Countdown or Arrived badge */}
                        {(() => {
                          // Show "Arrived" badge if responder has arrived
                          if ((req as any).arrived_at) {
                            return (
                              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30">
                                <CheckCircle2 className="w-5 h-5 text-success" />
                                <span className="text-sm font-medium text-success">
                                  Rescatista en el lugar
                                </span>
                              </div>
                            );
                          }
                          
                          // Show ETA if responder is on the way
                          const responderData = responders.find(r => r.request_id === req.id);
                          if (responderData) {
                            return (
                              <div className="mt-2">
                                <ResponderEtaCountdown
                                  etaMinutes={responderData.eta_minutes}
                                  distanceKm={responderData.distance_km}
                                  speed={responderData.speed}
                                  respondingStartedAt={responderData.responding_started_at}
                                />
                              </div>
                            );
                          }
                          return null;
                        })()}
                        
                        {/* Audio playback if available */}
                        {(req as any).audio_url && (
                          <div className="mt-2">
                            <AudioPlayer storagePath={(req as any).audio_url} />
                          </div>
                        )}
                        
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getGoogleMapsLink(req.lat, req.lng), '_blank')}
                          >
                            <MapPin className="w-4 h-4 mr-1" />
                            Ver ubicación
                          </Button>
                          
                          {/* Respond button - only for SOS_ACTIVO/EX_SOS and if not already responding */}
                          {(userRole === 'SOS_ACTIVO' || userRole === 'EX_SOS') && user?.id !== req.user_id && (
                            <>
                              {activeResponse?.requestId === req.id ? (
                                <>
                                  {/* Show different buttons based on arrival status */}
                                  {(req as any).arrived_at ? (
                                    // After arrived: show Resolve button
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="bg-success hover:bg-success/90"
                                      onClick={markAsResolved}
                                    >
                                      <Check className="w-4 h-4 mr-1" />
                                      Resolver
                                    </Button>
                                  ) : (
                                    // Before arrived: show Llegué button
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="bg-success hover:bg-success/90"
                                      onClick={markAsArrived}
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      Llegué
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowRouteMap({ requestId: req.id, lat: req.lat, lng: req.lng })}
                                  >
                                    <Route className="w-4 h-4 mr-1" />
                                    Ver ruta
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground"
                                    onClick={stopResponding}
                                  >
                                    <X className="w-4 h-4 mr-1" />
                                    Cancelar
                                  </Button>
                                </>
                              ) : !isResponding && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => startResponding(req.id, req.lat, req.lng, userRole === 'SOS_ACTIVO' || userRole === 'EX_SOS')}
                                >
                                  <Navigation className="w-4 h-4 mr-1" />
                                  Responder
                                </Button>
                              )}
                            </>
                          )}
                          
                          {/* Show resolve/delete buttons for owner or SOS_ACTIVO/EX_SOS */}
                          {(user?.id === req.user_id || userRole === 'SOS_ACTIVO' || userRole === 'EX_SOS') && (
                            <>
                              {/* Quick resolve button with checkmark */}
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-success hover:bg-success/90"
                                onClick={async () => {
                                  const success = await resolveRequest(req.id, user?.id);
                                  if (success) {
                                    toast.success('Alerta resuelta correctamente');
                                  } else {
                                    toast.error('Error al resolver la alerta');
                                  }
                                }}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Resolver
                              </Button>
                              
                              {/* Delete button (confirmation dialog) */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteConfirmId(req.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Eliminar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Recently Resolved Requests */}
          {resolvedRequests.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Resueltas recientemente
              </h3>
              <div className="space-y-3">
                {resolvedRequests.map((req) => (
                  <Card key={req.id} className="bg-card/50 border-border opacity-75">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground line-through">
                              {req.kind === 'SISMO_AYUDA_14' ? 'Daños / Ayuda' : 'Ayuda'}
                            </span>
                            {(req as any).creator_name && (
                              <span className="text-xs text-muted-foreground">
                                por {(req as any).creator_name}
                              </span>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              Resuelta
                            </Badge>
                            {/* Show badge if resolved by someone other than creator */}
                            {req.resolved_by && req.resolved_by !== req.user_id && (
                              <Badge variant="outline" className="text-xs text-primary border-primary/50">
                                Resuelto por rescatista
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {req.resolved_at && formatDistanceToNow(new Date(req.resolved_at), { 
                                addSuffix: true,
                                locale: es 
                              })}
                            </span>
                          </div>
                          {req.message && (
                            <p className="text-sm text-muted-foreground">{req.message}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar esta alerta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción marcará la alerta como resuelta y ya no será visible para otros usuarios. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (deleteConfirmId) {
                    // Pass the current user's ID as the resolver
                    const success = await resolveRequest(deleteConfirmId, user?.id);
                    setDeleteConfirmId(null);
                    if (success) {
                      toast.success('Alerta eliminada correctamente');
                    } else {
                      toast.error('Error al eliminar la alerta');
                    }
                  }
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </Tabs>

      {/* Quake Detail Dialog with Checkin Map */}
      <Dialog open={showQuakeDetailDialog} onOpenChange={setShowQuakeDetailDialog}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Map className="w-5 h-5 text-primary" />
              Detalle del Sismo
            </DialogTitle>
          </DialogHeader>

          {selectedQuake && (
            <div className="space-y-4 py-2">
              {/* Earthquake info */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    'text-3xl font-bold font-mono',
                    getMagColor(selectedQuake.properties.mag)
                  )}>
                    M{formatMag(selectedQuake.properties.mag)}
                  </span>
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    selectedQuake.source === 'SSN' ? "border-success text-success" : "border-primary text-primary"
                  )}>
                    {selectedQuake.source === 'SSN' ? 'SSN México' : 'USGS'}
                  </Badge>
                </div>
                <p className="text-sm text-foreground font-medium mb-2">
                  {selectedQuake.properties.place}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(selectedQuake.properties.time)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {selectedQuake.geometry.coordinates[2].toFixed(0)}km prof.
                  </span>
                  {selectedQuake.distanceMiles !== null && (
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <Navigation className="w-3 h-3" />
                      {selectedQuake.distanceMiles.toFixed(0)} mi de ti
                    </span>
                  )}
                </div>
              </div>

              {/* Checkin map - intensity reports */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Reportes de la Comunidad
                </h3>
                <QuakeCheckinMap
                  eventId={selectedQuake.id}
                  epicenterLat={selectedQuake.geometry.coordinates[1]}
                  epicenterLng={selectedQuake.geometry.coordinates[0]}
                  magnitude={selectedQuake.properties.mag}
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    handleQuickCheckin(selectedQuake);
                  }}
                >
                  Todo bien ✓
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setShowQuakeDetailDialog(false);
                    setShowHelp14Dialog(true);
                  }}
                >
                  Reporto Daños
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Help 14 Dialog */}
      <Dialog open={showHelp14Dialog} onOpenChange={setShowHelp14Dialog}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Reporte de Daño por Sismo
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
                Enviar Reporte
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Route Map Dialog */}
      <Dialog open={!!showRouteMap} onOpenChange={(open) => !open && setShowRouteMap(null)}>
        <DialogContent className="sm:max-w-lg bg-card border-border p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              Ruta a la emergencia
            </DialogTitle>
          </DialogHeader>
          {showRouteMap && activeResponse && (
            <div className="h-[400px]">
              <EmergencyRouteMap
                responderLat={activeResponse.responderLat}
                responderLng={activeResponse.responderLng}
                emergencyLat={showRouteMap.lat}
                emergencyLng={showRouteMap.lng}
                onClose={() => setShowRouteMap(null)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Thank You Dialog - shown when user's alert is resolved */}
      <ThankYouDialog
        open={showThankYou}
        onClose={dismissThankYou}
      />

      {/* Internal Messaging Modal */}
      {messagingOpen && (
        <InternalMessaging
          isOpen={messagingOpen}
          onClose={() => {
            setMessagingOpen(false);
            setMessagingUserId(null);
            setMessagingUserName(null);
          }}
          initialUserId={messagingUserId}
          initialUserName={messagingUserName}
        />
      )}

    </div>
  );
};

export default AlertsScreen;
