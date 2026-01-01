// Community Events Screen for COMUNIDAD EX SOS
// Message board for birthdays, health notices, hospital support, announcements + notifications

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cake, Heart, MessageSquarePlus, Loader2, RefreshCw, 
  Clock, User, AlertTriangle, Megaphone, Trash2, Bell, Check, ShoppingBag, Car, Plane, MapPin, Navigation, Map, Route, Share2, Copy, ExternalLink, ImagePlus, X, Send, Gift, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommunityEvents, CommunityEventType } from '@/hooks/useCommunityEvents';
import { useNotifications } from '@/hooks/useNotifications';
import { useActiveTrips, ActiveTrip } from '@/hooks/useActiveTrips';
import TripRouteMap from '@/components/TripRouteMap';
import MapErrorBoundary from '@/components/MapErrorBoundary';
import { TravelerLocationDialog } from '@/components/TravelerLocationDialog';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, differenceInMinutes, isPast, format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useInternalMessages } from '@/hooks/useInternalMessages';
import { NearbyBirthday } from '@/hooks/useCommunityEvents';

const EVENT_TYPES: { value: CommunityEventType; label: string }[] = [
  { value: 'BIRTHDAY', label: '🎂 Cumpleaños' },
  { value: 'EVENT', label: '📅 Evento' },
  { value: 'ANNIVERSARY', label: '💍 Aniversario' },
  { value: 'DECEASE', label: '🕯️ Deceso' },
  { value: 'VISIT', label: '👋 Visita' },
  { value: 'CELEBRATION', label: '🎉 Hoy se Celebra' },
  { value: 'RECOMMENDATION', label: '💡 Recomendación' },
  { value: 'OTHER', label: '📝 Otro' },
];

export const CommunityScreen: React.FC = () => {
  const { user } = useAuth();
  const { 
    events, 
    birthdays, 
    loading, 
    createEvent, 
    deleteEvent,
    uploadImage,
    refresh,
    getEventTypeLabel,
    getEventTypeColor,
  } = useCommunityEvents();
  
  const { 
    notifications, 
    unreadCount, 
    loading: notificationsLoading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    deleteAllRead,
  } = useNotifications();

  const {
    trips: communityTrips,
    loading: tripsLoading,
  } = useActiveTrips();

  const { sendMessage } = useInternalMessages();
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<ActiveTrip | null>(null);
  const [routeHistory, setRouteHistory] = useState<[number, number][]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [formData, setFormData] = useState({
    event_type: '' as CommunityEventType | '',
    title: '',
    message: '',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Birthday greeting state
  const [greetingTarget, setGreetingTarget] = useState<NearbyBirthday | null>(null);
  const [greetingMessage, setGreetingMessage] = useState('');
  const [sendingGreeting, setSendingGreeting] = useState(false);
  
  // Traveler location dialog state
  const [viewingTravelerId, setViewingTravelerId] = useState<string | null>(null);

  // Fetch route history when a trip is selected
  const fetchRouteHistory = useCallback(async (tripId: string) => {
    setLoadingRoute(true);
    try {
      const { data, error } = await supabase
        .from('trip_position_history')
        .select('lat, lng, recorded_at')
        .eq('trip_id', tripId)
        .order('recorded_at', { ascending: true });
      
      if (error) throw error;
      
      const coords: [number, number][] = (data || []).map(p => [p.lat, p.lng]);
      setRouteHistory(coords);
    } catch (err) {
      console.error('Error fetching route history:', err);
      setRouteHistory([]);
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  // Fetch route when trip is selected
  useEffect(() => {
    if (selectedTrip?.id) {
      fetchRouteHistory(selectedTrip.id);
    } else {
      setRouteHistory([]);
    }
  }, [selectedTrip?.id, fetchRouteHistory]);

  // Format ETA for display - uses dynamic ETA if available
  const formatEta = (trip: typeof communityTrips[number]) => {
    try {
      // Use dynamic ETA if available (calculated from real GPS position)
      if (trip.dynamic_eta_minutes !== null && trip.dynamic_eta_minutes !== undefined) {
        const minutes = trip.dynamic_eta_minutes;

        if (minutes < 1) {
          return { text: 'Llegando...', isLate: false, isDynamic: true };
        }

        if (minutes < 60) {
          return { text: `${minutes} min`, isLate: false, isDynamic: true };
        } else {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return { text: `${hours}h ${mins > 0 ? `${mins}m` : ''}`, isLate: false, isDynamic: true };
        }
      }

      // Fallback to static ETA from database
      const etaDate = new Date(trip.eta);
      const now = new Date();

      if (!isValid(etaDate)) {
        return { text: 'ETA', isLate: false, isDynamic: false };
      }

      if (isPast(etaDate)) {
        return { text: 'Llegando...', isLate: true, isDynamic: false };
      }

      const minutesRemaining = differenceInMinutes(etaDate, now);

      if (minutesRemaining < 60) {
        return { text: `${minutesRemaining} min`, isLate: false, isDynamic: false };
      } else if (minutesRemaining < 1440) {
        const hours = Math.floor(minutesRemaining / 60);
        const mins = minutesRemaining % 60;
        return { text: `${hours}h ${mins > 0 ? `${mins}m` : ''}`, isLate: false, isDynamic: false };
      } else {
        return {
          text: formatDistanceToNow(etaDate, { addSuffix: true, locale: es }),
          isLate: false,
          isDynamic: false,
        };
      }
    } catch (e) {
      return { text: 'ETA', isLate: false, isDynamic: false };
    }
  };

  // Format distance for display
  const formatDistanceKm = (km: number) => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen debe ser menor a 5MB');
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!formData.event_type || !formData.title.trim()) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      
      // Upload image if selected
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      await createEvent({
        event_type: formData.event_type,
        title: formData.title,
        message: formData.message || undefined,
        image_url: imageUrl,
      });
      
      toast.success('Evento publicado');
      setShowNewDialog(false);
      setFormData({ event_type: '', title: '', message: '' });
      handleRemoveImage();
    } catch (err) {
      console.error('Error creating event:', err);
      toast.error('Error al publicar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return;
    
    try {
      await deleteEvent(id);
      toast.success('Evento eliminado');
    } catch (err) {
      console.error('Error deleting event:', err);
      toast.error('Error al eliminar');
    }
  };

  const handleOpenGreeting = (birthday: NearbyBirthday) => {
    setGreetingTarget(birthday);
    setGreetingMessage(`¡Feliz cumpleaños ${birthday.full_name}! 🎂🎉`);
  };

  const handleSendGreeting = async () => {
    if (!greetingTarget || !greetingMessage.trim()) return;
    
    // Don't send to yourself
    if (greetingTarget.user_id === user?.id) {
      toast.error('No puedes enviarte un mensaje a ti mismo');
      return;
    }

    setSendingGreeting(true);
    try {
      const success = await sendMessage(greetingTarget.user_id, greetingMessage.trim());
      if (success) {
        toast.success(`Felicitación enviada a ${greetingTarget.nickname}`);
        setGreetingTarget(null);
        setGreetingMessage('');
      } else {
        toast.error('Error al enviar la felicitación');
      }
    } catch (err) {
      console.error('Error sending greeting:', err);
      toast.error('Error al enviar la felicitación');
    } finally {
      setSendingGreeting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto pb-20 scrollbar-thin">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Comunidad</h1>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              onClick={() => setShowNewDialog(true)}
            >
              <MessageSquarePlus className="w-4 h-4 mr-1" />
              Publicar
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tablero" className="p-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tablero" className="text-xs">
            📋 Tablero
          </TabsTrigger>
          <TabsTrigger value="avisos" className="relative text-xs">
            🔔 Avisos
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

        {/* Tablero Tab */}
        <TabsContent value="tablero" className="mt-4 space-y-4">
          {/* Nearby Birthdays (Yesterday, Today, Tomorrow) */}
          {birthdays.length > 0 && (
            <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cake className="w-5 h-5 text-primary" />
                  Cumpleaños 🎉
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Yesterday */}
                {birthdays.filter(b => b.day_label === 'yesterday').length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Ayer</p>
                    <div className="space-y-2">
                      {birthdays.filter(b => b.day_label === 'yesterday').map((birthday) => (
                        <div 
                          key={birthday.user_id}
                          className="flex items-center gap-3 p-2 bg-background/50 rounded-lg opacity-75"
                        >
                          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-xl">
                            🎂
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{birthday.full_name}</p>
                            <p className="text-sm text-muted-foreground">@{birthday.nickname}</p>
                          </div>
                          {birthday.user_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => handleOpenGreeting(birthday)}
                            >
                              <Gift className="w-4 h-4 mr-1" />
                              Felicitar
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Today */}
                {birthdays.filter(b => b.day_label === 'today').length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-primary mb-2">¡Hoy! 🎊</p>
                    <div className="space-y-2">
                      {birthdays.filter(b => b.day_label === 'today').map((birthday) => (
                        <div 
                          key={birthday.user_id}
                          className="flex items-center gap-3 p-2 bg-primary/10 rounded-lg border border-primary/20"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl">
                            🎂
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{birthday.full_name}</p>
                            <p className="text-sm text-muted-foreground">@{birthday.nickname}</p>
                          </div>
                          {birthday.user_id !== user?.id && (
                            <Button
                              variant="default"
                              size="sm"
                              className="shrink-0"
                              onClick={() => handleOpenGreeting(birthday)}
                            >
                              <Gift className="w-4 h-4 mr-1" />
                              Felicitar
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tomorrow */}
                {birthdays.filter(b => b.day_label === 'tomorrow').length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Mañana</p>
                    <div className="space-y-2">
                      {birthdays.filter(b => b.day_label === 'tomorrow').map((birthday) => (
                        <div 
                          key={birthday.user_id}
                          className="flex items-center gap-3 p-2 bg-background/50 rounded-lg"
                        >
                          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-xl">
                            🎂
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{birthday.full_name}</p>
                            <p className="text-sm text-muted-foreground">@{birthday.nickname}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Events Feed */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Tablero de Avisos</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : events.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <MessageSquarePlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay avisos publicados</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowNewDialog(true)}
                  >
                    Publicar el primero
                  </Button>
                </CardContent>
              </Card>
            ) : (
              events.map((event) => (
                <Card 
                  key={event.id} 
                  className={cn("border-l-4", getEventTypeColor(event.event_type as CommunityEventType))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                            {getEventTypeLabel(event.event_type as CommunityEventType)}
                          </span>
                        </div>
                        <h3 className="font-medium text-foreground">{event.title}</h3>
                        {event.message && (
                          <p className="text-sm text-muted-foreground mt-1">{event.message}</p>
                        )}
                        {event.image_url && (
                          <img 
                            src={event.image_url} 
                            alt="Imagen del evento" 
                            loading="lazy"
                            decoding="async"
                            className="mt-3 w-full max-h-48 rounded-lg border border-border object-cover"
                          />
                        )}
                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(event.created_at), { 
                              addSuffix: true, 
                              locale: es 
                            })}
                          </span>
                        </div>
                      </div>
                      {event.user_id === user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(event.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Avisos/Notifications Tab */}
        <TabsContent value="avisos" className="mt-4 space-y-4">
          {/* Active Community Trips in Avisos */}
          {communityTrips.length > 0 && (
            <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Car className="w-5 h-5 text-amber-500" />
                  Viajes Activos 🚗
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {communityTrips.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {communityTrips.map((trip) => {
                  const etaInfo = formatEta(trip);
                  const hasLocation = trip.current_lat && trip.current_lng;
                  return (
                    <div 
                      key={trip.id}
                      onClick={() => setSelectedTrip(trip)}
                      className={cn(
                        "flex items-center justify-between p-2 bg-background/50 rounded-lg transition-all",
                        "hover:bg-background/80 cursor-pointer active:scale-[0.98]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl flex-shrink-0 relative">
                          {trip.transit_type === 'FLIGHT' ? '✈️' : '🚗'}
                          {hasLocation && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-safe rounded-full border-2 border-background animate-pulse" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">
                            {trip.nickname || 'Usuario'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {trip.origin} → {trip.destination}
                          </p>
                          {trip.remaining_distance_km !== null && trip.remaining_distance_km !== undefined && (
                            <p className="text-[10px] text-primary/80 mt-0.5">
                              📍 {formatDistanceKm(trip.remaining_distance_km)} restantes
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <div className="flex flex-col items-end">
                          <Badge 
                            variant={etaInfo.isLate ? "destructive" : "secondary"}
                            className={cn(
                              "text-xs",
                              !etaInfo.isLate && "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                            )}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {etaInfo.text}
                            {etaInfo.isDynamic && (
                              <span className="w-1.5 h-1.5 bg-safe rounded-full ml-1 animate-pulse" />
                            )}
                          </Badge>
                          {trip.transit_type === 'FLIGHT' && trip.flight_number && (
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {trip.airline} {trip.flight_number}
                            </span>
                          )}
                        </div>
                        <Map className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Notifications section */}
          <div className="space-y-3">
            {notifications.length > 0 && (
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-medium text-muted-foreground">Notificaciones</h2>
                <div className="flex gap-1">
                  {notifications.some(n => n.read) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deleteAllRead}
                      className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Borrar leídas
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Marcar todo leído
                  </Button>
                </div>
              </div>
            )}
            
            {notificationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 && communityTrips.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No tienes notificaciones</p>
              </div>
            ) : (
              notifications.map((notification) => {
                // Check if this is a trip-related notification that allows messaging
                const isTripNotification = notification.type.startsWith('trip_');
                const tripUserId = isTripNotification && notification.listing_id ? notification.listing_id : null;
                const canMessage = tripUserId && tripUserId !== user?.id;
                
                return (
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
                            : isTripNotification
                              ? notification.type === 'trip_overdue' 
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-500/10 text-amber-600"
                              : "bg-muted text-muted-foreground"
                        )}>
                          {notification.type === 'marketplace_contact' ? (
                            <ShoppingBag className="w-4 h-4" />
                          ) : isTripNotification ? (
                            <Car className="w-4 h-4" />
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
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { 
                                addSuffix: true,
                                locale: es 
                              })}
                            </p>
                            {canMessage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                  onClick={() => setViewingTravelerId(tripUserId)}
                                >
                                  <MapPin className="w-3 h-3 mr-1" />
                                  Ver ubicación
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    // Navigate to chat with this user
                                    window.location.href = `/?chat=${tripUserId}`;
                                  }}
                                >
                                  <MessageCircle className="w-3 h-3 mr-1" />
                                  Mensaje
                                </Button>
                              </>
                            )}
                          </div>
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
              );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* New Event Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-primary" />
              Publicar Aviso
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo de aviso *</Label>
              <Select
                value={formData.event_type || undefined}
                onValueChange={(v) => setFormData({ ...formData, event_type: v as CommunityEventType })}
                onOpenChange={(open) => {
                  // Debug for Android/WebView issues
                  console.log('[CommunityScreen] event_type Select open:', open);
                }}
              >
                <SelectTrigger
                  className="touch-manipulation"
                  onPointerDownCapture={(e) => {
                    // Helps some Android/WebView touch stacks where the scroll container steals the gesture
                    if ((e as any).pointerType === 'touch') e.preventDefault();
                  }}
                >
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent
                  className="z-[10060] bg-popover border-border max-h-[320px]"
                  position="item-aligned"
                >
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="cursor-pointer">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Cumpleaños de Juan"
                maxLength={100}
              />
            </div>

            <div>
              <Label>Mensaje (opcional)</Label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Detalles adicionales..."
                className="w-full h-24 px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none"
                maxLength={500}
              />
            </div>

            {/* Image Upload */}
            <div>
              <Label>Imagen (opcional)</Label>
              {imagePreview ? (
                <div className="relative mt-2">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-32 object-cover rounded-lg border border-border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={handleRemoveImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full h-20 mt-2 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Agregar imagen</span>
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNewDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !formData.event_type || !formData.title.trim()}
                className="flex-1"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Publicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trip Map Dialog */}
      {selectedTrip && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedTrip(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-auto bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTrip.transit_type === 'FLIGHT' ? (
                  <Plane className="w-5 h-5 text-primary" />
                ) : (
                  <Car className="w-5 h-5 text-primary" />
                )}
                Viaje de {selectedTrip.nickname || 'Usuario'}
              </DialogTitle>
            </DialogHeader>
          
            <div className="space-y-4">
              {/* Map */}
              <div className="relative">
                {loadingRoute && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/80 rounded-lg">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
                <MapErrorBoundary
                  context={{
                    feature: 'avisos_active_trip',
                    tripId: selectedTrip.id,
                    tripUserId: selectedTrip.user_id,
                  }}
                  tripData={{
                    originLat: selectedTrip.origin_lat,
                    originLng: selectedTrip.origin_lng,
                    destinationLat: selectedTrip.destination_lat,
                    destinationLng: selectedTrip.destination_lng,
                    currentLat: selectedTrip.current_lat,
                    currentLng: selectedTrip.current_lng,
                  }}
                  onClose={() => setSelectedTrip(null)}
                >
                  <TripRouteMap
                    routeCoordinates={routeHistory}
                    originCoords={
                      selectedTrip.origin_lat !== null && selectedTrip.origin_lng !== null
                        ? { lat: selectedTrip.origin_lat, lng: selectedTrip.origin_lng }
                        : null
                    }
                    destinationCoords={
                      selectedTrip.destination_lat !== null && selectedTrip.destination_lng !== null
                        ? { lat: selectedTrip.destination_lat, lng: selectedTrip.destination_lng }
                        : null
                    }
                    currentPosition={
                      selectedTrip.current_lat !== null && selectedTrip.current_lng !== null
                        ? { lat: selectedTrip.current_lat, lng: selectedTrip.current_lng }
                        : null
                    }
                    originName={selectedTrip.origin}
                    destinationName={selectedTrip.destination}
                    height="280px"
                  />
                </MapErrorBoundary>
                {/* Route info badge */}
                {routeHistory.length > 0 && (
                  <div className="absolute bottom-2 left-2 z-10">
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-xs">
                      <Route className="w-3 h-3 mr-1" />
                      {routeHistory.length} puntos
                    </Badge>
                  </div>
                )}
              </div>
              
              {/* Trip Details */}
              <div className="space-y-3">
                {/* Route Info */}
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Navigation className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedTrip.origin}</p>
                    <p className="text-xs text-muted-foreground">→ {selectedTrip.destination}</p>
                  </div>
                </div>
                
                {/* ETA */}
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <span className="text-sm">ETA</span>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const etaInfo = formatEta(selectedTrip);
                      return (
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={etaInfo.isLate ? "destructive" : "secondary"}
                            className={cn(
                              !etaInfo.isLate && "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                            )}
                          >
                            {etaInfo.text}
                            {etaInfo.isDynamic && (
                              <span className="w-1.5 h-1.5 bg-safe rounded-full ml-1 animate-pulse" />
                            )}
                          </Badge>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Remaining Distance */}
                {selectedTrip.remaining_distance_km !== null && selectedTrip.remaining_distance_km !== undefined && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      <span className="text-sm">Distancia restante</span>
                    </div>
                    <span className="font-medium">{formatDistanceKm(selectedTrip.remaining_distance_km)}</span>
                  </div>
                )}
                
                {/* Last Location Update */}
                {selectedTrip.location_updated_at && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-safe" />
                      <span className="text-sm">Última ubicación</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(selectedTrip.location_updated_at), { 
                        addSuffix: true, 
                        locale: es 
                      })}
                    </span>
                  </div>
                )}
                
                {/* No location data message */}
                {!selectedTrip.current_lat && !selectedTrip.current_lng && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Navigation className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Ubicación no disponible</p>
                    <p className="text-xs">El usuario no está compartiendo ubicación</p>
                  </div>
                )}
                
                {/* Flight Info */}
                {selectedTrip.transit_type === 'FLIGHT' && selectedTrip.flight_number && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Plane className="w-5 h-5 text-blue-500" />
                      <span className="text-sm">Vuelo</span>
                    </div>
                    <span className="font-medium">{selectedTrip.airline} {selectedTrip.flight_number}</span>
                  </div>
                )}
                
                {/* Vehicle Info */}
                {selectedTrip.transit_type === 'ROAD' && selectedTrip.plates && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Car className="w-5 h-5 text-amber-500" />
                      <span className="text-sm">Placas</span>
                    </div>
                    <span className="font-medium">{selectedTrip.plates}</span>
                  </div>
                )}
              </div>
              
              {/* Share button - only visible to trip creator */}
              {selectedTrip.share_token && selectedTrip.user_id === user?.id && (
                <div className="flex gap-2">
                  <Button 
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/trip/${selectedTrip.share_token}`;
                      if (navigator.share) {
                        navigator.share({
                          title: `Viaje de ${selectedTrip.nickname || 'usuario'}`,
                          text: `Sigue el viaje de ${selectedTrip.origin} a ${selectedTrip.destination}`,
                          url: shareUrl,
                        }).catch(() => {
                          navigator.clipboard.writeText(shareUrl);
                          toast.success('Link copiado al portapapeles');
                        });
                      } else {
                        navigator.clipboard.writeText(shareUrl);
                        toast.success('Link copiado al portapapeles');
                      }
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Compartir Viaje
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/trip/${selectedTrip.share_token}`;
                      window.open(shareUrl, '_blank');
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setSelectedTrip(null)}
              >
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Birthday Greeting Dialog */}
      <Dialog open={!!greetingTarget} onOpenChange={(open) => !open && setGreetingTarget(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Felicitar a {greetingTarget?.full_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
                🎂
              </div>
              <div>
                <p className="font-medium text-foreground">{greetingTarget?.full_name}</p>
                <p className="text-sm text-muted-foreground">@{greetingTarget?.nickname}</p>
              </div>
            </div>

            <div>
              <Label>Tu mensaje de felicitación</Label>
              <textarea
                value={greetingMessage}
                onChange={(e) => setGreetingMessage(e.target.value)}
                placeholder="Escribe tu mensaje..."
                className="w-full h-24 px-3 py-2 mt-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {greetingMessage.length}/500
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setGreetingTarget(null)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendGreeting}
                disabled={sendingGreeting || !greetingMessage.trim()}
                className="flex-1"
              >
                {sendingGreeting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Traveler Location Dialog */}
      <TravelerLocationDialog
        isOpen={!!viewingTravelerId}
        onClose={() => setViewingTravelerId(null)}
        userId={viewingTravelerId || ''}
        onSendMessage={() => {
          if (viewingTravelerId) {
            window.location.href = `/?chat=${viewingTravelerId}`;
          }
        }}
      />
    </div>
  );
};
