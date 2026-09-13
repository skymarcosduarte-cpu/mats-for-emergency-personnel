// Alerts Screen for COMUNIDAD SOS
// USGS + SSN Mexico earthquakes + "Todo bien" quick report + "14" help + notifications + my alerts history

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, RefreshCw, MapPin, Clock, ChevronRight, AlertCircle, Loader2, Bell, Check, Trash2, WifiOff, Navigation, CloudRain, Route, X, CheckCircle2, Map, MessageCircle, Car, Plane, BookOpen, Radio, Activity, ArrowLeft, ExternalLink } from 'lucide-react';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import { useEarthquakeHistory, EarthquakeWithDistance } from '@/hooks/useEarthquakeHistory';
import { useWeatherAlerts } from '@/hooks/useWeatherAlerts';
import { useMexicoAlerts, TropicalCycloneAlert, FireHotspot } from '@/hooks/useMexicoAlerts';
import { useGDACSAlerts, GDACSAlert } from '@/hooks/useGDACSAlerts';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { areInternationalRedAlertsEnabled } from '@/hooks/useAlertSettings';
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
// Tabs removed - using conditional rendering based on initialTab
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
// CycloneMap imported on-demand if needed
import { SeismicWaveMap } from '@/components/SeismicWaveMap';
import { SkyAlertTab } from '@/components/SkyAlertTab';
import { useActiveTrips, ActiveTrip } from '@/hooks/useActiveTrips';
import { useRecentQuakeCheckins } from '@/hooks/useRecentQuakeCheckins';
import { useQuakeCheckinCounts } from '@/hooks/useQuakeCheckinCounts';
import { DamageReportsMiniMap } from '@/components/DamageReportsMiniMap';

// Removed - now using useEarthquakeHistory hook

// Seismic wave velocities (km/s)
const P_WAVE_VELOCITY = 6.0; // Primary waves (fastest, less destructive)
const S_WAVE_VELOCITY = 3.5; // Secondary/Shear waves (slower, more destructive)

// Calculate seismic wave arrival times based on distance
function calculateSeismicETA(distanceKm: number): { pWaveSeconds: number; sWaveSeconds: number } {
  return {
    pWaveSeconds: distanceKm / P_WAVE_VELOCITY,
    sWaveSeconds: distanceKm / S_WAVE_VELOCITY,
  };
}

// Format seconds to human readable
function formatSeismicTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}

interface AlertsScreenProps {
  userRole?: UserRole;
  onGoHome?: () => void;
}

export const AlertsScreen: React.FC<AlertsScreenProps> = ({ 
  userRole = 'SOS_ACTIVO',
  onGoHome
}) => {
  // Landing view state - shows big buttons before entering tabs
  const [showLanding, setShowLanding] = useState(true);
  const [initialTab, setInitialTab] = useState<'skyalert' | 'earthquakes' | 'otros'>('skyalert');
  
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
  
  // Source filter for "Otros" tab
  const [otrosSourceFilter, setOtrosSourceFilter] = useState<string | null>(null);
  // Source filter for earthquakes tab
  const [earthquakeSourceFilter, setEarthquakeSourceFilter] = useState<'ALL' | 'USGS' | 'SSN'>('ALL');
  // Messaging state
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const [messagingUserName, setMessagingUserName] = useState<string | null>(null);
  
  // Handler to enter a specific tab from landing
  const handleEnterTab = (tab: 'skyalert' | 'earthquakes' | 'otros') => {
    setInitialTab(tab);
    setShowLanding(false);
  };
  
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
    ssnStatus,
    refresh: loadEarthquakes 
  } = useEarthquakeHistory(position);

  // Get check-in counts for all earthquakes
  const earthquakeIds = useMemo(() => earthquakes.map(q => q.id), [earthquakes]);
  const { counts: checkinCounts } = useQuakeCheckinCounts(earthquakeIds);

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
    showFireNotification,
    showRedAlertNotification,
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

  // Callback for new red alerts (only if enabled in settings)
  const handleNewRedAlert = useCallback((alert: any) => {
    // Check if international red alerts are enabled
    if (!areInternationalRedAlertsEnabled()) {
      console.log('[AlertsScreen] Red alert ignored (disabled in settings):', alert.title);
      return;
    }
    console.log('[AlertsScreen] New RED alert:', alert.title);
    const notificationShown = showRedAlertNotification(alert);
    if (notificationShown) {
      playUrgentAlert();
    } else {
      console.log('[AlertsScreen] Sound skipped because no visible notification was shown');
    }
  }, [showRedAlertNotification]);

  // GDACS + AEMET international alerts with red alert callback
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
  } = useGDACSAlerts({
    onNewRedAlert: handleNewRedAlert,
  });

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
      // Upsert to avoid duplicate error: 1 reporte por usuario por sismo
      const { error } = await supabase
        .from('quake_checkins')
        .upsert(
          {
            user_id: user.id,
            usgs_event_id: quake.id,
            intensity: 4,
            damage_report: 'OK',
            lat: position.lat,
            lng: position.lng,
          },
          { onConflict: 'user_id,usgs_event_id' }
        );

      if (error) throw error;

      toast.success('Reporte guardado', {
        description: 'Solo se permite 1 reporte por sismo (se actualizó tu reporte).',
      });
    } catch (error) {
      console.error('Error submitting quick checkin:', error);
      toast.error('No se pudo guardar el reporte');
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
          .upload(`${user.id}/audio/${audioFileName}`, help14Audio.blob, {
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
          const imagePath = `${user.id}/images/${newRequest.id}/${i}-${Date.now()}.jpg`;
          
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

      // Send email notifications to "usuarios de guardia"
      if (newRequest) {
        try {
          const { data: session } = await supabase.auth.getSession();
          if (session?.session?.access_token) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-alert-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.session.access_token}`,
              },
              body: JSON.stringify({
                alertType: 'HELP_REQUEST',
                alertId: newRequest.id,
                helpKind: 'SISMO_AYUDA_14',
                creatorName: user?.email?.split('@')[0] || 'Usuario',
                message: help14Message || 'Solicitud de ayuda por sismo',
                lat: position.lat,
                lng: position.lng,
              }),
            }).then(res => {
              if (res.ok) {
                console.log('[AlertsScreen] Email notification sent successfully');
              } else {
                console.warn('[AlertsScreen] Email notification failed:', res.status);
              }
            }).catch(err => {
              console.warn('[AlertsScreen] Email notification error:', err);
            });
          }
        } catch (emailErr) {
          console.warn('[AlertsScreen] Error sending email notification:', emailErr);
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

  // Landing view with large buttons
  if (showLanding) {
    return (
      <div className="flex-1 overflow-auto pb-20">
        {/* Header */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            {onGoHome && (
              <BackToHomeButton onClick={onGoHome} />
            )}
            <h1 className="text-3xl font-bold text-foreground">Sismos</h1>
          </div>
          <p className="text-base text-muted-foreground">Alertas sísmicas y fenómenos naturales</p>
        </div>

        {/* Large Button Cards */}
        <div className="px-4 space-y-4">
          {/* SkyAlert Button */}
          <button
            onClick={() => handleEnterTab('skyalert')}
            className={cn(
              "w-full flex items-center gap-4 p-5 rounded-2xl",
              "bg-card border-2 shadow-sm",
              "hover:scale-[1.02] hover:shadow-md active:scale-[0.98]",
              "transition-all duration-200 animate-fade-in",
              "subsection-card-skyalert"
            )}
            style={{ animationDelay: '0ms' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 hover:scale-105 subsection-icon-skyalert">
              <Radio className="w-10 h-10" strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-bold text-foreground text-xl">Apps de Alertamiento Sísmico</h3>
              <p className="text-base text-muted-foreground line-clamp-3 leading-relaxed">
                Alertas tomadas de las cuentas oficiales de SkyAlert y SASSLA en X. No sustituyen a las apps oficiales en tiempo real.
              </p>
            </div>
            <ChevronRight className="w-7 h-7 text-muted-foreground/60 shrink-0" />
          </button>

          {/* Sismos Recientes Button */}
          <button
            onClick={() => handleEnterTab('earthquakes')}
            className={cn(
              "w-full flex items-center gap-4 p-5 rounded-2xl",
              "bg-card border-2 shadow-sm",
              "hover:scale-[1.02] hover:shadow-md active:scale-[0.98]",
              "transition-all duration-200 animate-fade-in",
              "subsection-card-sismos"
            )}
            style={{ animationDelay: '50ms' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 hover:scale-105 subsection-icon-sismos">
              <Activity className="w-10 h-10" strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-bold text-foreground text-xl">Sismos Recientes</h3>
              <p className="text-base text-muted-foreground line-clamp-2 leading-relaxed">
                SSN México - últimos eventos
              </p>
            </div>
            <ChevronRight className="w-7 h-7 text-muted-foreground/60 shrink-0" />
          </button>

          {/* Otros Fenómenos Button */}
          <button
            onClick={() => handleEnterTab('otros')}
            className={cn(
              "w-full flex items-center gap-4 p-5 rounded-2xl",
              "bg-card border-2 shadow-sm",
              "hover:scale-[1.02] hover:shadow-md active:scale-[0.98]",
              "transition-all duration-200 animate-fade-in",
              "subsection-card-otros"
            )}
            style={{ animationDelay: '100ms' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 hover:scale-105 subsection-icon-otros">
              <AlertTriangle className="w-10 h-10" strokeWidth={2.5} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-bold text-foreground text-xl">Otros Fenómenos</h3>
              <p className="text-base text-muted-foreground line-clamp-2 leading-relaxed">
                Ciclones, incendios y alertas internacionales
              </p>
            </div>
            <ChevronRight className="w-7 h-7 text-muted-foreground/60 shrink-0" />
          </button>

          {/* Monitor de Sismos Globales 24/7 - Embedded player */}
          <div
            className={cn(
              "w-full rounded-2xl overflow-hidden",
              "bg-black border-2 border-red-500/40 shadow-sm",
              "animate-fade-in"
            )}
            style={{ animationDelay: '150ms' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-black/90">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-500 uppercase tracking-wide font-mono">EN VIVO 24/7</span>
              </div>
              <span className="text-xs text-white/60 font-mono">Monitor de Sismos Globales</span>
            </div>
            {/* Video */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <div className="absolute inset-0 flex items-center justify-center bg-black z-0">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
              </div>
              <iframe
                src="https://www.youtube.com/embed/rvtygG4n6ew?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1"
                className="absolute inset-0 w-full h-full z-10"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title="Monitor de Sismos Globales"
              />
            </div>
          </div>

          {/* Raspberry Shake */}
          <a
            href="https://stationview.raspberryshake.org/#/?lat=15.02955&lon=148.91310&zoom=2.348"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "w-full flex items-center gap-4 p-5 rounded-2xl",
              "bg-card border-2 border-emerald-500/40 shadow-sm",
              "hover:border-emerald-400/60 active:scale-[0.98] transition-all",
              "animate-fade-in"
            )}
            style={{ animationDelay: '200ms' }}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground">Raspberry Shake</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Mira la tierra como se mueve 🌍</p>
            </div>
            <ExternalLink className="w-6 h-6 text-emerald-500/70 shrink-0" />
          </a>
        </div>
      </div>
    );
  }

  // Get section title based on current tab
  const getSectionTitle = () => {
    switch (initialTab) {
      case 'skyalert': return 'Apps de Alertamiento Sísmico';
      case 'earthquakes': return 'Sismos Recientes';
      case 'otros': return 'Otros Fenómenos';
      default: return 'Sismos';
    }
  };

  return (
    <div className="flex-1 overflow-auto pb-20 scrollbar-thin">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackToHomeButton onClick={() => setShowLanding(true)} />
            <h1 className="text-xl font-bold text-foreground">{getSectionTitle()}</h1>
          </div>
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

      {/* Content based on selected section - NO TABS */}
      <div className="p-4">
        {/* SkyAlert Section */}
        {initialTab === 'skyalert' && (
          <SkyAlertTab />
        )}

        {/* Earthquakes Section */}
        {initialTab === 'earthquakes' && (
          <div className="space-y-3">
          {/* Source filter and status */}
          <div className="flex flex-col gap-2">
            {/* Filter buttons */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Fuente:</span>
              <div className="flex gap-1">
                <Button
                  variant={earthquakeSourceFilter === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setEarthquakeSourceFilter('ALL')}
                >
                  Todas ({earthquakes.length})
                </Button>
                <Button
                  variant={earthquakeSourceFilter === 'USGS' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "h-7 text-xs px-2",
                    earthquakeSourceFilter === 'USGS' ? "" : "border-primary text-primary hover:bg-primary/10"
                  )}
                  onClick={() => setEarthquakeSourceFilter('USGS')}
                >
                  USGS ({earthquakes.filter(q => q.source === 'USGS').length})
                </Button>
                <Button
                  variant={earthquakeSourceFilter === 'SSN' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "h-7 text-xs px-2",
                    earthquakeSourceFilter === 'SSN' ? "" : "border-success text-success hover:bg-success/10"
                  )}
                  onClick={() => setEarthquakeSourceFilter('SSN')}
                >
                  SSN ({earthquakes.filter(q => q.source === 'SSN').length})
                </Button>
              </div>
            </div>
            
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
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-success text-success">SSN</Badge>
              </div>
            </div>

            {/* SSN unavailable banner */}
            {!ssnStatus.available && ssnStatus.lastAttempt && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-xs">
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="font-medium">SSN México no disponible</span>
                    <span className="text-muted-foreground ml-1">
                      — Último intento: {ssnStatus.lastAttempt.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-warning hover:text-warning hover:bg-warning/20"
                  onClick={() => loadEarthquakes()}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  <span className="ml-1">Reintentar</span>
                </Button>
              </div>
            )}
          </div>

          {(() => {
            const filtered = earthquakes.filter(
              (q) => earthquakeSourceFilter === 'ALL' || q.source === earthquakeSourceFilter
            );

            if (filtered.length === 0) {
              return loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>
                    No hay sismos recientes
                    {earthquakeSourceFilter !== 'ALL' ? ` de ${earthquakeSourceFilter}` : ''}
                  </p>
                </div>
              );
            }

            return (
              <>
                {loading && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {filtered.map((quake) => (
                  <Card
                    key={quake.id}
                    className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedQuake(quake);
                      setShowQuakeDetailDialog(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn('text-2xl font-bold font-mono', getMagColor(quake.properties.mag))}>
                              {formatMag(quake.properties.mag)}
                            </span>
                            {quake.properties.tsunami === 1 && (
                              <span className="badge-emergency">TSUNAMI</span>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] px-1.5 py-0 h-4',
                                quake.source === 'SSN'
                                  ? 'border-success text-success'
                                  : 'border-primary text-primary'
                              )}
                            >
                              {quake.source === 'SSN' ? 'SSN' : 'USGS'}
                            </Badge>
                          </div>
                          <div className="text-sm text-foreground font-medium">{quake.properties.place}</div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(quake.properties.time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {quake.geometry.coordinates[2].toFixed(0)}km prof.
                            </span>
                            {quake.distanceKm !== null && (
                              <>
                                <span className="flex items-center gap-1 text-primary font-medium">
                                  <Navigation className="w-3 h-3" />
                                  {quake.distanceKm.toFixed(0)} km
                                </span>
                                <span
                                  className="flex items-center gap-1 text-warning font-medium"
                                  title="Tiempo de llegada de ondas sísmicas (P/S)"
                                >
                                  ⚡ {formatSeismicTime(calculateSeismicETA(quake.distanceKm).sWaveSeconds)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>

                      {/* Quick action buttons with check-in count */}
                      <div className="flex items-center gap-2 mt-3 justify-between flex-wrap">
                        {/* Check-in counters with visual prominence based on count */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* OK counter */}
                          {checkinCounts[quake.id]?.ok_count > 0 &&
                            (() => {
                              const count = checkinCounts[quake.id].ok_count;
                              const isHighCount = count >= 10;
                              const isMediumCount = count >= 5;

                              return (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'flex items-center gap-1 font-medium transition-all',
                                    isHighCount
                                      ? 'bg-safe text-safe-foreground border-safe animate-pulse shadow-lg shadow-safe/40'
                                      : isMediumCount
                                      ? 'bg-safe/20 text-safe border-safe/50'
                                      : 'text-safe border-safe/30'
                                  )}
                                >
                                  <span className={cn(isHighCount && 'font-bold')}>
                                    {count} {isHighCount ? '✓ reportan bien' : 'bien'}
                                  </span>
                                </Badge>
                              );
                            })()}
                          {/* DAMAGE counter */}
                          {checkinCounts[quake.id]?.damage_count > 0 &&
                            (() => {
                              const count = checkinCounts[quake.id].damage_count;
                              const isHighCount = count >= 5;
                              const isMediumCount = count >= 2;

                              return (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'flex items-center gap-1 font-medium transition-all',
                                    isHighCount
                                      ? 'bg-destructive text-destructive-foreground border-destructive animate-pulse shadow-lg shadow-destructive/40'
                                      : isMediumCount
                                      ? 'bg-destructive/20 text-destructive border-destructive/50'
                                      : 'text-destructive border-destructive/30'
                                  )}
                                >
                                  <AlertTriangle className={cn('w-3.5 h-3.5', isHighCount && 'animate-bounce')} />
                                  <span className={cn(isHighCount && 'font-bold')}>
                                    {count} {isHighCount ? '¡reportan daños!' : 'daños'}
                                  </span>
                                </Badge>
                              );
                            })()}
                        </div>
                        <div className="flex gap-2 ml-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-3 text-xs text-muted-foreground hover:text-safe"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickCheckin(quake);
                            }}
                          >
                            ✓ Todo bien
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-3 text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQuake(quake);
                              setShowHelp14Dialog(true);
                            }}
                          >
                            Reportar Daños
                          </Button>
                        </div>
                      </div>

                      {/* Mini-map for damage reports */}
                      {checkinCounts[quake.id]?.damage_count >= 2 && (
                        <DamageReportsMiniMap
                          eventId={quake.id}
                          epicenterLat={quake.geometry.coordinates[1]}
                          epicenterLng={quake.geometry.coordinates[0]}
                          magnitude={quake.properties.mag}
                          damageCount={checkinCounts[quake.id].damage_count}
                          className="mt-3"
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            );
          })()}
          </div>
        )}

        {/* Otros Fenómenos Section */}
        {initialTab === 'otros' && (
          <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Alertas internacionales multirriesgo
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
          
          {/* Source Filter Buttons with Counters */}
          {(() => {
            // Calculate counts per source
            const gdacsCount = gdacsAlerts.filter(a => a.source === 'GDACS').length;
            const conaguaCount = gdacsAlerts.filter(a => a.source === 'CONAGUA').length;
            const nasaCount = gdacsAlerts.filter(a => a.source === 'NASA').length;
            const reliefwebCount = gdacsAlerts.filter(a => a.source === 'ReliefWeb').length;
            const aemetCount = aemetAlerts.length;
            const totalCount = gdacsAlerts.length + aemetCount;
            
            return (
              <div className="flex flex-wrap gap-1.5">
                <Badge 
                  variant={otrosSourceFilter === null ? "default" : "outline"} 
                  className={cn(
                    "text-[10px] px-2 py-0.5 cursor-pointer transition-colors",
                    otrosSourceFilter === null && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setOtrosSourceFilter(null)}
                >
                  Todas {totalCount > 0 && `(${totalCount})`}
                </Badge>
                <Badge 
                  variant={otrosSourceFilter === 'GDACS' ? "default" : "outline"} 
                  className={cn(
                    "text-[10px] px-2 py-0.5 cursor-pointer transition-colors",
                    otrosSourceFilter === 'GDACS' && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setOtrosSourceFilter(otrosSourceFilter === 'GDACS' ? null : 'GDACS')}
                >
                  GDACS {gdacsCount > 0 && `(${gdacsCount})`}
                </Badge>
                <Badge 
                  variant={otrosSourceFilter === 'CONAGUA' ? "default" : "outline"} 
                  className={cn(
                    "text-[10px] px-2 py-0.5 cursor-pointer transition-colors",
                    otrosSourceFilter === 'CONAGUA' && "bg-success text-success-foreground"
                  )}
                  onClick={() => setOtrosSourceFilter(otrosSourceFilter === 'CONAGUA' ? null : 'CONAGUA')}
                >
                  CONAGUA {conaguaCount > 0 && `(${conaguaCount})`}
                </Badge>
                <Badge 
                  variant={otrosSourceFilter === 'NASA' ? "default" : "outline"} 
                  className={cn(
                    "text-[10px] px-2 py-0.5 cursor-pointer transition-colors",
                    otrosSourceFilter === 'NASA' && "bg-blue-500 text-white"
                  )}
                  onClick={() => setOtrosSourceFilter(otrosSourceFilter === 'NASA' ? null : 'NASA')}
                >
                  NASA {nasaCount > 0 && `(${nasaCount})`}
                </Badge>
                <Badge 
                  variant={otrosSourceFilter === 'ReliefWeb' ? "default" : "outline"} 
                  className={cn(
                    "text-[10px] px-2 py-0.5 cursor-pointer transition-colors",
                    otrosSourceFilter === 'ReliefWeb' && "bg-orange-500 text-white"
                  )}
                  onClick={() => setOtrosSourceFilter(otrosSourceFilter === 'ReliefWeb' ? null : 'ReliefWeb')}
                >
                  ReliefWeb {reliefwebCount > 0 && `(${reliefwebCount})`}
                </Badge>
                <Badge 
                  variant={otrosSourceFilter === 'AEMET' ? "default" : "outline"} 
                  className={cn(
                    "text-[10px] px-2 py-0.5 cursor-pointer transition-colors",
                    otrosSourceFilter === 'AEMET' && "bg-amber-500 text-white"
                  )}
                  onClick={() => setOtrosSourceFilter(otrosSourceFilter === 'AEMET' ? null : 'AEMET')}
                >
                  AEMET {aemetCount > 0 && `(${aemetCount})`}
                </Badge>
              </div>
            );
          })()}

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
              <p className="text-xs mt-1">GDACS · CONAGUA · NASA · ReliefWeb · AEMET</p>
            </div>
          ) : (
            <>
              {/* Multi-source International Alerts Section */}
              {(() => {
                // Filter alerts based on selected source
                const filteredAlerts = otrosSourceFilter 
                  ? gdacsAlerts.filter(a => a.source === otrosSourceFilter)
                  : gdacsAlerts;
                const filteredAemet = otrosSourceFilter === 'AEMET' || otrosSourceFilter === null 
                  ? aemetAlerts 
                  : [];
                
                if (filteredAlerts.length === 0 && filteredAemet.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay alertas de {otrosSourceFilter}</p>
                    </div>
                  );
                }
                
                return (
                  <>
                    {filteredAlerts.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          🌍 {otrosSourceFilter ? `Alertas ${otrosSourceFilter}` : 'Alertas Internacionales'} ({filteredAlerts.length})
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {otrosSourceFilter || 'GDACS · CONAGUA · NASA EONET · ReliefWeb'}
                        </p>
                        {filteredAlerts.slice(0, 20).map((alert) => (
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
                                    {/* Source badge */}
                                    <Badge variant="outline" className={cn(
                                      "text-[10px] px-1.5 py-0 h-4",
                                      alert.source === 'GDACS' && "border-primary text-primary",
                                      alert.source === 'CONAGUA' && "border-success text-success",
                                      alert.source === 'NASA' && "border-blue-500 text-blue-500",
                                      alert.source === 'ReliefWeb' && "border-orange-500 text-orange-500"
                                    )}>
                                      {alert.source}
                                    </Badge>
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
                        {filteredAlerts.length > 20 && (
                          <p className="text-xs text-center text-muted-foreground">
                            +{filteredAlerts.length - 20} alertas más
                          </p>
                        )}
                      </div>
                    )}

                    {/* AEMET Spain Alerts Section */}
                    {filteredAemet.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          🇪🇸 AEMET - Avisos España ({filteredAemet.length})
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Agencia Estatal de Meteorología
                        </p>
                        {filteredAemet.map((alert) => (
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
                );
              })()}
            </>
          )}
          </div>
        )}
      </div>

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
                    selectedQuake.source === 'SSN' 
                      ? "border-success text-success" 
                      : selectedQuake.source === 'EMSC'
                      ? "border-amber-500 text-amber-500"
                      : "border-primary text-primary"
                  )}>
                    {selectedQuake.source === 'SSN' ? 'SSN México' : selectedQuake.source === 'EMSC' ? 'EMSC Europa' : 'USGS'}
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
                  {selectedQuake.distanceKm !== null && (
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <Navigation className="w-3 h-3" />
                      {selectedQuake.distanceKm.toFixed(0)} km de ti
                    </span>
                  )}
                </div>

                {/* Seismic wave ETA info */}
                {selectedQuake.distanceKm !== null && (
                  <div className="mt-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
                    <div className="text-xs font-semibold text-warning mb-2 flex items-center gap-1">
                      ⚡ Tiempo de llegada de ondas sísmicas
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Onda P (rápida):</span>
                        <span className="ml-1 font-bold text-foreground">
                          {formatSeismicTime(calculateSeismicETA(selectedQuake.distanceKm).pWaveSeconds)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Onda S (fuerte):</span>
                        <span className="ml-1 font-bold text-warning">
                          {formatSeismicTime(calculateSeismicETA(selectedQuake.distanceKm).sWaveSeconds)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      La onda S es más lenta pero causa mayor daño. Estos tiempos son aproximados desde el momento del sismo.
                    </p>
                  </div>
                )}
              </div>

              {/* Checkin map - intensity reports */}
              <div>
                {/* Seismic wave propagation map */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary" />
                    Propagación de Ondas Sísmicas
                  </h3>
                  <SeismicWaveMap
                    epicenterLat={selectedQuake.geometry.coordinates[1]}
                    epicenterLng={selectedQuake.geometry.coordinates[0]}
                    magnitude={selectedQuake.properties.mag}
                    earthquakeTime={selectedQuake.properties.time}
                    userPosition={position}
                    className="h-[300px] rounded-lg overflow-hidden"
                  />
                </div>

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
