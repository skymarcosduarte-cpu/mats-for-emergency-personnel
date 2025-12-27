// Panic Response Hook for tracking responders to panic_events
// Similar to useEmergencyResponse but for panic events

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { playPositiveAlert } from '@/lib/alertSound';

interface ActivePanicResponse {
  panicId: string;
  panicLat: number;
  panicLng: number;
  startedAt: Date;
  responderLat: number;
  responderLng: number;
}

interface PanicResponderLocation {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  updatedAt: string;
  arrivedAt: string | null;
}

// Maximum distance in meters to allow joining a response (10km)
const MAX_RESPONSE_RADIUS = 10000;

export function usePanicResponse() {
  const { user } = useAuth();
  const [activeResponse, setActiveResponse] = useState<ActivePanicResponse | null>(null);
  const [responderLocations, setResponderLocations] = useState<Map<string, PanicResponderLocation[]>>(new Map());
  const watchIdRef = useRef<number | null>(null);
  const { showGenericNotification } = usePushNotifications();

  // Calculate distance between two points in meters
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Start responding to a panic event
  const startResponding = useCallback(async (
    panicId: string, 
    panicLat: number, 
    panicLng: number,
    skipRadiusCheck: boolean = false,
    transportMode?: string,
    estimatedEtaMinutes?: number
  ) => {
    console.log('[usePanicResponse] startResponding called', { 
      panicId, panicLat, panicLng, skipRadiusCheck, hasUser: !!user 
    });
    
    if (!user) {
      toast.error('Debes iniciar sesión para responder');
      return false;
    }

    try {
      // Get current location first
      console.log('[usePanicResponse] Getting current position...');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const responderLat = position.coords.latitude;
      const responderLng = position.coords.longitude;
      console.log('[usePanicResponse] Got position:', { responderLat, responderLng });

      // Check if user is within radius (skip for RESCATISTAS)
      if (!skipRadiusCheck) {
        const distance = calculateDistance(responderLat, responderLng, panicLat, panicLng);
        console.log('[usePanicResponse] Distance check:', { distance, maxRadius: MAX_RESPONSE_RADIUS });
        if (distance > MAX_RESPONSE_RADIUS) {
          toast.error('Estás demasiado lejos para responder a esta alerta', {
            description: `Distancia: ${(distance / 1000).toFixed(1)} km (máximo ${MAX_RESPONSE_RADIUS / 1000} km)`,
          });
          return false;
        }
      } else {
        console.log('[usePanicResponse] Skipping radius check (rescatista)');
      }

      // Insert into the panic responders table
      console.log('[usePanicResponse] Inserting into panic_event_responders...');
      const { error: responderError } = await supabase
        .from('panic_event_responders')
        .insert({
          panic_id: panicId,
          user_id: user.id,
          lat: responderLat,
          lng: responderLng,
          transport_mode: transportMode || null,
          estimated_eta_minutes: estimatedEtaMinutes || null,
        });

      if (responderError) {
        console.error('[usePanicResponse] Insert error:', responderError);
        if (responderError.code === '23505') {
          toast.error('Ya estás respondiendo a esta alerta');
          return false;
        }
        toast.error(`Error al iniciar respuesta: ${responderError.message}`);
        return false;
      }

      console.log('[usePanicResponse] Successfully inserted responder, updating panic_event...');

      // Update the panic event's responding_by field for backward compatibility
      const { error: updateError } = await supabase
        .from('panic_events')
        .update({
          responding_by: user.id,
          responding_started_at: new Date().toISOString(),
        })
        .eq('id', panicId)
        .is('responding_by', null);

      if (updateError) {
        console.warn('[usePanicResponse] Warning updating panic_event (non-fatal):', updateError);
      }

      setActiveResponse({
        panicId,
        panicLat,
        panicLng,
        startedAt: new Date(),
        responderLat,
        responderLng,
      });

      startLocationTracking(panicId);
      toast.success('¡En camino! Tu ubicación está siendo compartida');
      return true;
    } catch (error) {
      console.error('[usePanicResponse] Error:', error);
      toast.error('No se pudo obtener tu ubicación');
      return false;
    }
  }, [user]);

  // Notify the alert creator that help is on the way
  const notifyAlertCreator = useCallback((
    creatorUserId: string,
    panicId: string,
    responderCount: number = 1
  ) => {
    if (user?.id === creatorUserId) {
      playPositiveAlert();
      
      const message = responderCount > 1 
        ? `${responderCount} rescatistas están respondiendo a tu alerta.`
        : 'Un rescatista ha respondido a tu alerta y está en camino a tu ubicación.';
      
      showGenericNotification(
        '🚨 ¡Ayuda en camino!',
        message,
        `panic-response-${panicId}`
      );
      
      toast.success(responderCount > 1 ? `¡${responderCount} rescatistas en camino!` : '¡Un rescatista está en camino!', {
        description: 'Puedes ver su ubicación en el mapa',
        duration: 8000,
      });
    }
  }, [user, showGenericNotification]);

  // Notify the alert creator that a responder has arrived
  const notifyResponderArrived = useCallback((
    creatorUserId: string,
    panicId: string
  ) => {
    if (user?.id === creatorUserId) {
      playPositiveAlert();
      
      showGenericNotification(
        '✅ ¡Rescatista llegó!',
        'El rescatista ha llegado a tu ubicación. La ayuda está aquí.',
        `panic-arrived-${panicId}`
      );
      
      toast.success('¡El rescatista llegó!', {
        description: 'La ayuda está en tu ubicación',
        duration: 8000,
      });
    }
  }, [user, showGenericNotification]);

  // Mark as arrived at the emergency location
  const markAsArrived = useCallback(async () => {
    if (!activeResponse || !user) return false;

    try {
      const { error } = await supabase
        .from('panic_event_responders')
        .update({
          arrived_at: new Date().toISOString(),
        })
        .eq('panic_id', activeResponse.panicId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error marking as arrived:', error);
        toast.error('Error al marcar llegada');
        return false;
      }

      // Update legacy field
      await supabase
        .from('panic_events')
        .update({
          arrived_at: new Date().toISOString(),
        })
        .eq('id', activeResponse.panicId)
        .eq('responding_by', user.id);

      toast.success('¡Llegaste al lugar!', {
        description: 'Marca como resuelto cuando termines',
      });
      return true;
    } catch (error) {
      console.error('Error marking as arrived:', error);
      toast.error('Error al marcar llegada');
      return false;
    }
  }, [activeResponse, user]);

  // Stop responding
  const stopResponding = useCallback(async () => {
    if (!activeResponse || !user) return;

    try {
      await supabase
        .from('panic_event_responders')
        .delete()
        .eq('panic_id', activeResponse.panicId)
        .eq('user_id', user.id);

      // Check if there are other responders
      const { data: otherResponders } = await supabase
        .from('panic_event_responders')
        .select('user_id')
        .eq('panic_id', activeResponse.panicId)
        .limit(1);

      if (otherResponders && otherResponders.length > 0) {
        await supabase
          .from('panic_events')
          .update({
            responding_by: otherResponders[0].user_id,
          })
          .eq('id', activeResponse.panicId)
          .eq('responding_by', user.id);
      } else {
        await supabase
          .from('panic_events')
          .update({
            responding_by: null,
            responding_started_at: null,
          })
          .eq('id', activeResponse.panicId)
          .eq('responding_by', user.id);
      }

      stopLocationTracking();
      setActiveResponse(null);
      toast.info('Respuesta cancelada');
    } catch (error) {
      console.error('Error stopping response:', error);
    }
  }, [activeResponse, user]);

  // Track location while responding
  const startLocationTracking = useCallback((panicId?: string) => {
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        if (!user) return;

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        await supabase
          .from('user_locations')
          .upsert({
            user_id: user.id,
            lat,
            lng,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            is_online: true,
            updated_at: new Date().toISOString(),
          });

        if (panicId || activeResponse?.panicId) {
          await supabase
            .from('panic_event_responders')
            .update({
              lat,
              lng,
              updated_at: new Date().toISOString(),
            })
            .eq('panic_id', panicId || activeResponse?.panicId)
            .eq('user_id', user.id);
        }

        setActiveResponse(prev => prev ? {
          ...prev,
          responderLat: lat,
          responderLng: lng,
        } : null);
      },
      (error) => console.error('Location tracking error:', error),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  }, [user, activeResponse]);

  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Mark the panic event as resolved
  const markAsResolved = useCallback(async () => {
    if (!activeResponse || !user) return false;

    try {
      const { error } = await supabase
        .from('panic_events')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', activeResponse.panicId);

      if (error) {
        console.error('Error resolving panic:', error);
        toast.error('Error al resolver alerta');
        return false;
      }

      // Remove all responders for this panic (cleanup)
      await supabase
        .from('panic_event_responders')
        .delete()
        .eq('panic_id', activeResponse.panicId);

      stopLocationTracking();
      setActiveResponse(null);

      toast.success('¡Alerta resuelta!', {
        description: 'Gracias por tu ayuda',
      });
      return true;
    } catch (error) {
      console.error('Error resolving panic:', error);
      toast.error('Error al resolver alerta');
      return false;
    }
  }, [activeResponse, user, stopLocationTracking]);

  // Fetch all responders for a specific panic event
  const fetchResponders = useCallback(async (panicId: string) => {
    const { data: responders } = await supabase
      .from('panic_event_responders')
      .select('id, user_id, lat, lng, updated_at, arrived_at')
      .eq('panic_id', panicId);

    if (responders && responders.length > 0) {
      const locations: PanicResponderLocation[] = responders.map(r => ({
        id: r.id,
        userId: r.user_id,
        lat: r.lat || 0,
        lng: r.lng || 0,
        updatedAt: r.updated_at,
        arrivedAt: r.arrived_at,
      }));

      setResponderLocations(prev => {
        const newMap = new Map(prev);
        newMap.set(panicId, locations);
        return newMap;
      });
    } else {
      setResponderLocations(prev => {
        const newMap = new Map(prev);
        newMap.delete(panicId);
        return newMap;
      });
    }
  }, []);

  // Get responder count for a panic event
  const getResponderCount = useCallback((panicId: string): number => {
    return responderLocations.get(panicId)?.length || 0;
  }, [responderLocations]);

  // Subscribe to panic event and responder updates
  useEffect(() => {
    const panicChannel = supabase
      .channel('panic_responder_tracking')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'panic_events' },
        (payload) => {
          const updated = payload.new as { 
            id: string; 
            responding_by: string | null;
            user_id: string;
            arrived_at: string | null;
            resolved: boolean;
          };
          const previous = payload.old as { 
            responding_by: string | null;
            arrived_at: string | null;
            resolved: boolean;
          };
          
          if (updated.responding_by && !previous.responding_by) {
            const count = getResponderCount(updated.id);
            notifyAlertCreator(updated.user_id, updated.id, Math.max(count, 1));
            fetchResponders(updated.id);
          } 
          else if (updated.arrived_at && !previous.arrived_at) {
            notifyResponderArrived(updated.user_id, updated.id);
          }
          else if (updated.responding_by) {
            fetchResponders(updated.id);
          } else {
            setResponderLocations(prev => {
              const newMap = new Map(prev);
              newMap.delete(updated.id);
              return newMap;
            });
          }
        }
      )
      .subscribe();

    const respondersChannel = supabase
      .channel('panic_responders_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'panic_event_responders' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const data = payload.new as { panic_id: string; user_id: string };
            fetchResponders(data.panic_id);
            
            if (payload.eventType === 'INSERT') {
              const { data: panicEvent } = await supabase
                .from('panic_events')
                .select('user_id')
                .eq('id', data.panic_id)
                .maybeSingle();
              
              if (panicEvent && panicEvent.user_id === user?.id) {
                const count = getResponderCount(data.panic_id) + 1;
                notifyAlertCreator(panicEvent.user_id, data.panic_id, count);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const data = payload.old as { panic_id: string };
            fetchResponders(data.panic_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(panicChannel);
      supabase.removeChannel(respondersChannel);
      stopLocationTracking();
    };
  }, [fetchResponders, stopLocationTracking, notifyAlertCreator, notifyResponderArrived, getResponderCount, user]);

  // Check if user is already responding to a panic event
  useEffect(() => {
    if (!user) return;

    const checkExistingResponse = async () => {
      const { data: responderData } = await supabase
        .from('panic_event_responders')
        .select('panic_id, started_at')
        .eq('user_id', user.id)
        .limit(1);

      if (responderData && responderData.length > 0) {
        const { data: panicEvent } = await supabase
          .from('panic_events')
          .select('id, lat, lng')
          .eq('id', responderData[0].panic_id)
          .eq('resolved', false)
          .maybeSingle();

        if (panicEvent) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          }).catch(() => null);

          if (position) {
            setActiveResponse({
              panicId: panicEvent.id,
              panicLat: panicEvent.lat,
              panicLng: panicEvent.lng,
              startedAt: new Date(responderData[0].started_at),
              responderLat: position.coords.latitude,
              responderLng: position.coords.longitude,
            });
            startLocationTracking(panicEvent.id);
          }
        }
      }
    };

    checkExistingResponse();
  }, [user, startLocationTracking]);

  // Update transport mode for active response
  const updateTransportMode = useCallback(async (
    transportMode: string,
    estimatedEtaMinutes: number
  ) => {
    if (!activeResponse || !user) return false;

    try {
      const { error } = await supabase
        .from('panic_event_responders')
        .update({
          transport_mode: transportMode,
          estimated_eta_minutes: estimatedEtaMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq('panic_id', activeResponse.panicId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating transport mode:', error);
        toast.error('Error al actualizar transporte');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating transport mode:', error);
      toast.error('Error al actualizar transporte');
      return false;
    }
  }, [activeResponse, user]);

  return {
    activeResponse,
    responderLocations,
    startResponding,
    stopResponding,
    markAsArrived,
    markAsResolved,
    fetchResponders,
    getResponderCount,
    updateTransportMode,
    isResponding: activeResponse !== null,
  };
}
