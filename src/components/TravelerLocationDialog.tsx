import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock, Loader2, X, MessageCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import MapErrorBoundary from './MapErrorBoundary';
import { MiniMap } from './MiniMap';

interface TravelerLocation {
  lat: number;
  lng: number;
  updated_at: string;
  speed: number | null;
  heading: number | null;
  is_online: boolean;
}

interface TravelerProfile {
  nickname: string;
  full_name: string;
}

interface TravelerLocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSendMessage?: () => void;
}

export function TravelerLocationDialog({
  isOpen,
  onClose,
  userId,
  onSendMessage,
}: TravelerLocationDialogProps) {
  const [location, setLocation] = useState<TravelerLocation | null>(null);
  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch location and profile in parallel
        const [locationResult, profileResult] = await Promise.all([
          supabase
            .from('user_locations')
            .select('lat, lng, updated_at, speed, heading, is_online')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('profiles_public')
            .select('nickname')
            .eq('user_id', userId)
            .maybeSingle(),
        ]);

        if (locationResult.error) throw locationResult.error;
        
        if (locationResult.data) {
          setLocation(locationResult.data);
        } else {
          setError('No se encontró la ubicación del usuario');
        }

        if (profileResult.data) {
          setProfile({ 
            nickname: profileResult.data.nickname || 'Usuario', 
            full_name: profileResult.data.nickname || 'Usuario' 
          });
        }
      } catch (err) {
        console.error('[TravelerLocationDialog] Error fetching data:', err);
        setError('Error al cargar la ubicación');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, userId]);

  // Subscribe to real-time location updates
  useEffect(() => {
    if (!isOpen || !userId) return;

    const channel = supabase
      .channel(`traveler-location-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_locations',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newLocation = payload.new as TravelerLocation;
          setLocation(newLocation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, userId]);

  const openInGoogleMaps = () => {
    if (location) {
      window.open(`https://maps.google.com/?q=${location.lat},${location.lng}`, '_blank');
    }
  };

  const formatSpeed = (speed: number | null) => {
    if (speed === null || speed === undefined) return null;
    const kmh = speed * 3.6; // Convert m/s to km/h
    return `${Math.round(kmh)} km/h`;
  };

  const getLastUpdateText = () => {
    if (!location?.updated_at) return 'Desconocido';
    return formatDistanceToNow(new Date(location.updated_at), {
      addSuffix: true,
      locale: es,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" />
            Ubicación en Tiempo Real
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : location ? (
            <>
              {/* User info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                    🚗
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {profile?.nickname || 'Viajero'}
                    </p>
                    <div className="flex items-center gap-2">
                      {location.is_online ? (
                        <Badge variant="secondary" className="text-xs bg-safe/20 text-safe">
                          <span className="w-1.5 h-1.5 rounded-full bg-safe mr-1 animate-pulse" />
                          En línea
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Desconectado
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Map */}
              <div className="rounded-lg overflow-hidden border border-border h-[200px]">
                <MapErrorBoundary>
                  <MiniMap
                    lat={location.lat}
                    lng={location.lng}
                    zoom={15}
                  />
                </MapErrorBoundary>
              </div>

              {/* Location details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Última actualización</p>
                  <p className="text-sm font-medium flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {getLastUpdateText()}
                  </p>
                </div>
                {location.speed !== null && location.speed > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Velocidad</p>
                    <p className="text-sm font-medium flex items-center gap-1 mt-1">
                      <Navigation className="w-3 h-3" />
                      {formatSpeed(location.speed)}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={openInGoogleMaps}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir en Maps
                </Button>
                {onSendMessage && (
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={onSendMessage}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Enviar mensaje
                  </Button>
                )}
              </div>

              {/* Real-time indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
                Actualización en tiempo real activa
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
