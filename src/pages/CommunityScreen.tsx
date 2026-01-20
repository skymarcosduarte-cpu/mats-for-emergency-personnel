// Community Events Screen for COMUNIDAD EX SOS
// Message board for birthdays, health notices, hospital support, announcements + Breaking News + Market

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cake, Heart, MessageSquarePlus, Loader2, RefreshCw, 
  Clock, User, AlertTriangle, Megaphone, Trash2, Bell, Check, ShoppingBag, Car, Plane, MapPin, Navigation, Map, Route, Share2, Copy, ExternalLink, ImagePlus, X, Send, Gift, MessageCircle, ZoomIn, ChevronLeft, ChevronRight, Newspaper, ArrowLeft, Clipboard, Link, Video, Play, Pencil
} from 'lucide-react';
import { ImageGalleryViewer } from '@/components/ImageGalleryViewer';
import { MarketScreen } from '@/pages/MarketScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserRole } from '@/types';
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
// Tabs removed - using conditional rendering based on activeSection
import { useCommunityEvents, CommunityEventType, CommunityEvent } from '@/hooks/useCommunityEvents';
import { useActiveTrips, ActiveTrip } from '@/hooks/useActiveTrips';
import TripRouteMap from '@/components/TripRouteMap';
import MapErrorBoundary from '@/components/MapErrorBoundary';
import { TravelerLocationDialog } from '@/components/TravelerLocationDialog';
import { BreakingNewsSection } from '@/components/BreakingNewsSection';
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
  { value: 'NEWS', label: '📰 Noticia Relevante' },
  { value: 'OTHER', label: '📝 Otro' },
];

interface CommunityScreenProps {
  userRole?: UserRole;
}

export const CommunityScreen: React.FC<CommunityScreenProps> = ({ userRole = 'SOS_ACTIVO' }) => {
  const { user } = useAuth();
  const { 
    events, 
    birthdays, 
    loading, 
    createEvent, 
    updateEvent,
    deleteEvent,
    uploadImage,
    uploadVideo,
    refresh,
    getEventTypeLabel,
    getEventTypeColor,
  } = useCommunityEvents();

  const {
    trips: communityTrips,
    loading: tripsLoading,
  } = useActiveTrips();

  const { sendMessage } = useInternalMessages();
  
  // Landing view state - shows big buttons before entering a subsection
  const [showLanding, setShowLanding] = useState(true);
  const [activeSection, setActiveSection] = useState<'tablero' | 'noticias' | 'market'>('tablero');
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CommunityEvent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<ActiveTrip | null>(null);
  const [routeHistory, setRouteHistory] = useState<[number, number][]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [formData, setFormData] = useState({
    event_type: '' as CommunityEventType | '',
    title: '',
    message: '',
    link_url: '',
  });
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  
  // Birthday greeting state
  const [greetingTarget, setGreetingTarget] = useState<NearbyBirthday | null>(null);
  const [greetingMessage, setGreetingMessage] = useState('');
  const [sendingGreeting, setSendingGreeting] = useState(false);
  
  // Traveler location dialog state
  const [viewingTravelerId, setViewingTravelerId] = useState<string | null>(null);
  
  // Image zoom state for community events with gallery support
  const [zoomImages, setZoomImages] = useState<{ images: string[]; index: number } | null>(null);

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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Limit to 5 images
    if (selectedImages.length + files.length > 5) {
      toast.error('Máximo 5 imágenes por publicación');
      return;
    }
    
    const validFiles: File[] = [];
    const newPreviews: string[] = [];
    
    for (const file of files) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Cada imagen debe ser menor a 5MB');
        continue;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }
    
    setSelectedImages(prev => [...prev, ...validFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearImages = () => {
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setSelectedImages([]);
    setImagePreviews([]);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error('Solo se permiten videos');
      return;
    }
    
    // Validate size (10MB max)
    const MAX_VIDEO_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error('El video debe ser menor a 10MB');
      return;
    }
    
    // Clear previous preview
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    
    setSelectedVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleClearVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setSelectedVideo(null);
    setVideoPreview(null);
    setExistingVideoUrl(null);
  };

  // Open edit dialog with event data
  const handleEdit = (event: CommunityEvent) => {
    setEditingEvent(event);
    setFormData({
      event_type: event.event_type,
      title: event.title,
      message: event.message || '',
      link_url: event.link_url || '',
    });
    setExistingVideoUrl(event.video_url);
    setShowNewDialog(true);
  };

  // Reset form state
  const resetForm = () => {
    setFormData({ event_type: '', title: '', message: '', link_url: '' });
    handleClearImages();
    handleClearVideo();
    setEditingEvent(null);
    setExistingVideoUrl(null);
  };

  const handleSubmit = async () => {
    if (!formData.event_type || !formData.title.trim()) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    // Validate link URL if provided
    if (formData.link_url.trim()) {
      try {
        new URL(formData.link_url.trim());
      } catch {
        toast.error('La URL del enlace no es válida');
        return;
      }
    }

    setSubmitting(true);
    try {
      // If editing an existing event
      if (editingEvent) {
        let videoUrl: string | null = existingVideoUrl;
        
        // Upload new video if selected
        if (selectedVideo) {
          setUploadingVideo(true);
          try {
            videoUrl = await uploadVideo(selectedVideo);
          } finally {
            setUploadingVideo(false);
          }
        }

        await updateEvent(editingEvent.id, {
          title: formData.title,
          message: formData.message || null,
          link_url: formData.link_url.trim() || null,
          video_url: videoUrl,
        });
        
        toast.success('Aviso actualizado');
        setShowNewDialog(false);
        resetForm();
        return;
      }

      // Creating a new event
      let imageUrls: string[] = [];
      let videoUrl: string | undefined;
      
      // Upload all images
      for (const file of selectedImages) {
        const url = await uploadImage(file);
        imageUrls.push(url);
      }

      // Upload video if selected
      if (selectedVideo) {
        setUploadingVideo(true);
        try {
          videoUrl = await uploadVideo(selectedVideo);
        } finally {
          setUploadingVideo(false);
        }
      }

      await createEvent({
        event_type: formData.event_type,
        title: formData.title,
        message: formData.message || undefined,
        image_url: imageUrls[0], // Keep first image for backwards compatibility
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
        link_url: formData.link_url.trim() || undefined,
        video_url: videoUrl,
      });
      
      toast.success('Evento publicado');
      setShowNewDialog(false);
      resetForm();
    } catch (err) {
      console.error('Error saving event:', err);
      toast.error(editingEvent ? 'Error al actualizar' : 'Error al publicar');
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

  // Handler to enter a specific section from landing
  const handleEnterSection = (section: 'tablero' | 'noticias' | 'market') => {
    setActiveSection(section);
    setShowLanding(false);
  };

  // Get section title based on current section
  const getSectionTitle = () => {
    switch (activeSection) {
      case 'tablero': return 'Avisos';
      case 'noticias': return 'Últimas Noticias';
      case 'market': return 'Marketplace';
      default: return 'Comunidad';
    }
  };

  // Landing view with large buttons
  if (showLanding) {
    return (
      <div className="flex-1 overflow-auto pb-20">
        {/* Header */}
        <div className="p-4 space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Comunidad</h1>
          <p className="text-sm text-muted-foreground">Tablero de avisos, noticias y marketplace</p>
        </div>

        {/* Large Button Cards */}
        <div className="px-4 space-y-3">
          {/* Avisos Button */}
          <button
            onClick={() => handleEnterSection('tablero')}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl",
              "bg-card border border-border/50",
              "hover:bg-muted/50 active:scale-[0.98]",
              "transition-all duration-200"
            )}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-primary/20 text-primary">
              <Clipboard className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-semibold text-foreground text-base">Avisos</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                Cumpleaños, eventos y anuncios de la comunidad
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>

          {/* Últimas Noticias Button */}
          <button
            onClick={() => handleEnterSection('noticias')}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl",
              "bg-card border border-border/50",
              "hover:bg-muted/50 active:scale-[0.98]",
              "transition-all duration-200"
            )}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-destructive/20 text-destructive">
              <Newspaper className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-semibold text-foreground text-base">Últimas Noticias</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                Viajes activos y noticias de última hora
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>

          {/* Marketplace Button */}
          <button
            onClick={() => handleEnterSection('market')}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl",
              "bg-card border border-border/50",
              "hover:bg-muted/50 active:scale-[0.98]",
              "transition-all duration-200"
            )}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-pink-500/20 text-pink-400">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-semibold text-foreground text-base">Marketplace</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                Compra y vende productos en la comunidad
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>
        </div>

        {/* Dialogs still need to be rendered */}
        {/* New Event Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-primary" />
                Publicar Aviso
              </DialogTitle>
            </DialogHeader>
            {/* Dialog content handled elsewhere */}
          </DialogContent>
        </Dialog>

        {/* Birthday Greeting Dialog */}
        <Dialog open={!!greetingTarget} onOpenChange={(open) => !open && setGreetingTarget(null)}>
          {/* Dialog content handled in main view */}
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

        {/* Image Gallery Viewer for Community Events */}
        <ImageGalleryViewer
          images={zoomImages?.images || []}
          initialIndex={zoomImages?.index || 0}
          open={!!zoomImages}
          onOpenChange={(open) => !open && setZoomImages(null)}
        />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="px-4 pt-4">
        {/* Sticky Community sub-header */}
        <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLanding(true)}
                className="h-8 w-8"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold text-foreground">{getSectionTitle()}</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
                <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
              </Button>
              {activeSection === 'tablero' && (
                <Button size="sm" onClick={() => setShowNewDialog(true)}>
                  <MessageSquarePlus className="w-4 h-4 mr-1" />
                  Publicar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tablero/Avisos Section */}
        {activeSection === 'tablero' && (
          <div className="mt-4 space-y-4">
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
                        
                        {/* Link URL */}
                        {event.link_url && (
                          <a
                            href={event.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 mt-2 text-sm text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link className="w-4 h-4" />
                            <span className="truncate">{new URL(event.link_url).hostname}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        )}
                        
                        {/* Video */}
                        {event.video_url && (
                          <div className="mt-3">
                            <video
                              src={event.video_url}
                              controls
                              className="w-full rounded-lg border border-border max-h-64"
                              preload="metadata"
                            >
                              Tu navegador no soporta videos.
                            </video>
                          </div>
                        )}
                        {/* Image Gallery - support multiple images */}
                        {(() => {
                          const images = (event as any).image_urls?.length > 0 
                            ? (event as any).image_urls 
                            : event.image_url 
                              ? [event.image_url] 
                              : [];
                          if (images.length === 0) return null;
                          
                          return (
                            <div className="mt-3 space-y-2">
                              {/* Main image */}
                              <div 
                                className="relative cursor-pointer group"
                                onClick={() => setZoomImages({ images, index: 0 })}
                              >
                                <img 
                                  src={images[0]} 
                                  alt="Imagen del evento" 
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full rounded-lg border border-border object-contain max-h-80"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                                {images.length > 1 && (
                                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded-full text-white text-xs">
                                    +{images.length - 1}
                                  </div>
                                )}
                              </div>
                              
                              {/* Thumbnail strip for multiple images */}
                              {images.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {images.slice(1, 4).map((img: string, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() => setZoomImages({ images, index: idx + 1 })}
                                      className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border border-border hover:border-primary transition-colors"
                                    >
                                      <img 
                                        src={img} 
                                        alt={`Imagen ${idx + 2}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ))}
                                  {images.length > 4 && (
                                    <button
                                      onClick={() => setZoomImages({ images, index: 4 })}
                                      className="w-16 h-16 rounded-md flex-shrink-0 border border-border bg-muted flex items-center justify-center text-sm text-muted-foreground hover:border-primary transition-colors"
                                    >
                                      +{images.length - 4}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handleEdit(event)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          </div>
        )}

        {/* Noticias Section */}
        {activeSection === 'noticias' && (
          <div className="mt-4 space-y-4">
          {/* Active Community Trips */}
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

          {/* Breaking News Section */}
          <BreakingNewsSection />
          </div>
        )}

        {/* Market Section */}
        {activeSection === 'market' && (
          <div className="mt-4">
            <MarketScreen userRole={userRole} />
          </div>
        )}
      </div>

      {/* New Event Dialog */}
      <Dialog open={showNewDialog} onOpenChange={(open) => {
        setShowNewDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingEvent ? (
                <>
                  <Pencil className="w-5 h-5 text-primary" />
                  Editar Aviso
                </>
              ) : (
                <>
                  <MessageSquarePlus className="w-5 h-5 text-primary" />
                  Publicar Aviso
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo de aviso *</Label>
              <Select
                value={formData.event_type || undefined}
                onValueChange={(v) => setFormData({ ...formData, event_type: v as CommunityEventType })}
                disabled={!!editingEvent} // Can't change type when editing
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

            {/* Link URL */}
            <div>
              <Label className="flex items-center gap-2">
                <Link className="w-4 h-4" />
                Enlace web (opcional)
              </Label>
              <Input
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                placeholder="https://ejemplo.com"
                type="url"
              />
            </div>

            {/* Video Upload */}
            <div>
              <Label className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                Video (opcional, máx. 10 MB)
              </Label>
              
              {videoPreview || existingVideoUrl ? (
                <div className="relative mt-2">
                  <video
                    src={videoPreview || existingVideoUrl || ''}
                    className="w-full h-32 object-cover rounded-lg border border-border"
                    controls
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1 -right-1 h-6 w-6"
                    onClick={handleClearVideo}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full h-16 mt-2 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoSelect}
                  />
                  <Video className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Agregar video</span>
                </label>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Tamaño máximo: 10 MB
              </p>
            </div>

            {/* Image Upload - Multiple (only for new events, not editable) */}
            {!editingEvent && (
              <div>
                <Label>Imágenes (opcional, máx. 5)</Label>
                
                {/* Selected images preview */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {imagePreviews.map((preview, idx) => (
                      <div key={idx} className="relative">
                        <img 
                          src={preview} 
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5"
                          onClick={() => handleRemoveImage(idx)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add more images button */}
                {imagePreviews.length < 5 && (
                  <label className="flex items-center justify-center gap-2 w-full h-16 mt-2 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {imagePreviews.length === 0 ? 'Agregar imágenes' : 'Agregar más'}
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* Note about images in edit mode */}
            {editingEvent && (
              <p className="text-xs text-muted-foreground italic">
                Las imágenes no se pueden modificar. Para cambiarlas, elimina el aviso y crea uno nuevo.
              </p>
            )}

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
                disabled={submitting || uploadingVideo || !formData.event_type || !formData.title.trim()}
                className="flex-1"
              >
                {(submitting || uploadingVideo) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {uploadingVideo ? 'Subiendo video...' : editingEvent ? 'Guardar' : 'Publicar'}
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

      {/* Image Gallery Viewer for Community Events */}
      <ImageGalleryViewer
        images={zoomImages?.images || []}
        initialIndex={zoomImages?.index || 0}
        open={!!zoomImages}
        onOpenChange={(open) => !open && setZoomImages(null)}
      />
    </div>
  );
};
