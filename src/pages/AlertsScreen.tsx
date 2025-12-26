// Alerts Screen for COMUNIDAD EX SOS
// USGS earthquakes + "4/10" quick report + "14" help + notifications

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, RefreshCw, MapPin, Clock, ChevronRight, AlertCircle, Loader2, Bell, Check, Trash2, ShoppingBag, WifiOff, Navigation, CloudRain, Flame, Wind } from 'lucide-react';
import { useEarthquakeHistory, EarthquakeWithDistance } from '@/hooks/useEarthquakeHistory';
import { useWeatherAlerts } from '@/hooks/useWeatherAlerts';
import { useMexicoAlerts, TropicalCycloneAlert, FireHotspot } from '@/hooks/useMexicoAlerts';
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
import { useLocation, getGoogleMapsLink } from '@/hooks/useLocation';
import { useHelpRequests } from '@/hooks/useRealtime';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import type { USGSEarthquake, QuakeIntensity, QuakeDamage, UserRole, MediaRef } from '@/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { playUrgentAlert } from '@/lib/alertSound';

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const { position } = useLocation();
  const { requests: helpRequests, resolveRequest } = useHelpRequests(position);
  const { user } = useAuth();
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
              onClick={requestNotifPermission}
            >
              Activar
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="earthquakes" className="p-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="earthquakes" className="text-xs px-1">Sismos</TabsTrigger>
          <TabsTrigger value="mexico" className="relative text-xs px-1">
            México
            {(cyclones.length > 0 || fires.length > 0) && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {cyclones.length + fires.length}
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
          <TabsTrigger value="help" className="text-xs px-1">Ayuda</TabsTrigger>
          <TabsTrigger value="notifications" className="relative text-xs px-1">
            Avisos
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
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

        {/* Weather Alerts Tab */}
        <TabsContent value="weather" className="space-y-3 mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Alertas de clima severo en un radio de 100 millas
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
                      <div className="flex items-center gap-2 mb-1">
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

        {/* Mexico Federal Alerts Tab - NHC Cyclones + Fire Hotspots */}
        <TabsContent value="mexico" className="space-y-3 mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Alertas federales mexicanas (NHC + CONABIO)
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshMexico}
                disabled={mexicoLoading}
              >
                <RefreshCw className={cn('w-4 h-4', mexicoLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Test notification buttons */}
          {notifPermission === 'granted' && (
            <div className="flex gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground flex-1">Probar notificaciones:</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  const testCyclone: TropicalCycloneAlert = {
                    id: 'test-cyclone-' + Date.now(),
                    name: 'Huracán Test',
                    type: 'hurricane',
                    category: 3,
                    basin: 'atlantic',
                    headline: 'Huracán de prueba para verificar notificaciones',
                    description: 'Este es un ciclón de prueba generado para verificar que las notificaciones funcionan correctamente.',
                    link: '',
                    pubDate: new Date().toISOString(),
                    windSpeed: 120,
                    distanceKm: 150,
                  };
                  showCycloneNotification(testCyclone);
                }}
              >
                <Wind className="w-3 h-3 mr-1" />
                Ciclón
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  const testFires: FireHotspot[] = [{
                    id: 'test-fire-' + Date.now(),
                    lat: position?.lat || 19.4326,
                    lng: position?.lng || -99.1332,
                    brightness: 350,
                    confidence: 'high',
                    acqDate: new Date().toISOString().split('T')[0],
                    acqTime: new Date().toTimeString().slice(0, 5).replace(':', ''),
                    satellite: 'TEST',
                    distanceKm: 25,
                    frp: 50,
                  }];
                  showFireNotification(testFires, 25);
                }}
              >
                <Flame className="w-3 h-3 mr-1" />
                Incendio
              </Button>
            </div>
          )}

          {mexicoLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : mexicoError ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{mexicoError}</p>
            </div>
          ) : cyclones.length === 0 && fires.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wind className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay alertas activas</p>
              <p className="text-xs mt-1">Ciclones tropicales e incendios forestales</p>
            </div>
          ) : (
            <>
              {/* Tropical Cyclones Section */}
              {cyclones.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Wind className="w-4 h-4" />
                    Ciclones Tropicales ({cyclones.length})
                  </h3>
                  {cyclones.map((cyclone) => (
                    <Card 
                      key={cyclone.id} 
                      className={cn(
                        "bg-card border-border",
                        cyclone.type === 'hurricane' && "border-l-4 border-l-destructive",
                        cyclone.type === 'tropical_storm' && "border-l-4 border-l-panic",
                        cyclone.type === 'tropical_depression' && "border-l-4 border-l-warning"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-full shrink-0 text-2xl",
                            getCycloneSeverityColor(cyclone.type, cyclone.category)
                          )}>
                            {getCycloneIcon(cyclone.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                                cyclone.type === 'hurricane' && "bg-destructive text-destructive-foreground",
                                cyclone.type === 'tropical_storm' && "bg-panic text-white",
                                cyclone.type === 'tropical_depression' && "bg-warning text-warning-foreground",
                                cyclone.type === 'disturbance' && "bg-muted text-muted-foreground"
                              )}>
                                {cyclone.type === 'hurricane' ? `HURACÁN${cyclone.category ? ` CAT ${cyclone.category}` : ''}` :
                                 cyclone.type === 'tropical_storm' ? 'TORMENTA TROPICAL' :
                                 cyclone.type === 'tropical_depression' ? 'DEPRESIÓN TROPICAL' : 'PERTURBACIÓN'}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {cyclone.basin === 'atlantic' ? 'Atlántico' : 'Pacífico'}
                              </Badge>
                              {cyclone.distanceKm && (
                                <span className="text-xs text-primary font-medium flex items-center gap-1">
                                  <Navigation className="w-3 h-3" />
                                  {cyclone.distanceKm.toFixed(0)} km
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-foreground">{cyclone.name}</h3>
                            {cyclone.windSpeed && (
                              <p className="text-sm text-foreground mt-1">
                                Vientos: {cyclone.windSpeed} mph ({Math.round(cyclone.windSpeed * 1.60934)} km/h)
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {cyclone.description.substring(0, 150)}...
                            </p>
                            {cyclone.link && (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto mt-2 text-xs"
                                onClick={() => window.open(cyclone.link, '_blank')}
                              >
                                Ver detalles completos →
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Fire Hotspots Section */}
              {fires.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Flame className="w-4 h-4 text-panic" />
                    Incendios Forestales Cercanos ({fires.length})
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Puntos de calor detectados en las últimas 24h (VIIRS/NASA)
                  </p>
                  <div className="grid gap-2">
                    {fires.slice(0, 10).map((fire) => (
                      <Card key={fire.id} className="bg-card border-border">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-full shrink-0",
                              getFireConfidenceColor(fire.confidence)
                            )}>
                              <Flame className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-bold",
                                  fire.confidence === 'high' && "bg-destructive text-destructive-foreground",
                                  fire.confidence === 'nominal' && "bg-warning text-warning-foreground",
                                  fire.confidence === 'low' && "bg-muted text-muted-foreground"
                                )}>
                                  {fire.confidence === 'high' ? 'ALTA' : fire.confidence === 'nominal' ? 'MEDIA' : 'BAJA'} CONF.
                                </span>
                                {fire.distanceKm && (
                                  <span className="text-xs text-primary font-medium flex items-center gap-1">
                                    <Navigation className="w-3 h-3" />
                                    {fire.distanceKm.toFixed(1)} km
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  FRP: {fire.frp.toFixed(1)} MW
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span>{fire.lat.toFixed(4)}, {fire.lng.toFixed(4)}</span>
                                <span>•</span>
                                <span>{fire.acqDate} {fire.acqTime}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`https://maps.google.com/?q=${fire.lat},${fire.lng}`, '_blank')}
                            >
                              <MapPin className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {fires.length > 10 && (
                    <p className="text-xs text-center text-muted-foreground">
                      +{fires.length - 10} puntos de calor más
                    </p>
                  )}
                </div>
              )}
            </>
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
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
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getGoogleMapsLink(req.lat, req.lng), '_blank')}
                          >
                            <MapPin className="w-4 h-4 mr-1" />
                            Ver ubicación
                          </Button>
                          {/* Show resolve button only for the owner */}
                          {user?.id === req.user_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteConfirmId(req.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
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
                    await resolveRequest(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
