// Emergency Response Hook for tracking responders and routing
// Handles responding to alerts and route tracking

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { playPositiveAlert } from '@/lib/alertSound';

interface ActiveResponse {
  requestId: string;
  requestLat: number;
  requestLng: number;
  startedAt: Date;
  responderLat: number;
  responderLng: number;
}

interface ResponderLocation {
  userId: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export function useEmergencyResponse() {
  const { user } = useAuth();
  const [activeResponse, setActiveResponse] = useState<ActiveResponse | null>(null);
  const [responderLocations, setResponderLocations] = useState<Map<string, ResponderLocation>>(new Map());
  const [showThankYou, setShowThankYou] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const { showGenericNotification } = usePushNotifications();

  // Start responding to a help request
  const startResponding = useCallback(async (
    requestId: string, 
    requestLat: number, 
    requestLng: number
  ) => {
    if (!user) {
      toast.error('Debes iniciar sesión para responder');
      return false;
    }

    try {
      // Get current location first
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const responderLat = position.coords.latitude;
      const responderLng = position.coords.longitude;

      // Update the help request with responding_by
      const { error } = await supabase
        .from('help_requests')
        .update({
          responding_by: user.id,
          responding_started_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error starting response:', error);
        toast.error('Error al iniciar respuesta');
        return false;
      }

      setActiveResponse({
        requestId,
        requestLat,
        requestLng,
        startedAt: new Date(),
        responderLat,
        responderLng,
      });

      // Start tracking location
      startLocationTracking();

      toast.success('¡En camino! Tu ubicación está siendo compartida');
      return true;
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('No se pudo obtener tu ubicación');
      return false;
    }
  }, [user]);

  // Notify the alert creator that help is on the way (called from realtime subscription)
  const notifyAlertCreator = useCallback((
    creatorUserId: string,
    requestId: string
  ) => {
    // Only notify if we're the alert creator
    if (user?.id === creatorUserId) {
      // Play positive sound and vibration for reassurance
      playPositiveAlert();
      
      showGenericNotification(
        '🚨 ¡Ayuda en camino!',
        'Un rescatista ha respondido a tu alerta y está en camino a tu ubicación.',
        `response-${requestId}`
      );
      
      // Also show a toast for in-app notification
      toast.success('¡Un rescatista está en camino!', {
        description: 'Puedes ver su ubicación en el mapa',
        duration: 8000,
      });
    }
  }, [user, showGenericNotification]);

  // Notify the alert creator that the responder has arrived
  const notifyResponderArrived = useCallback((
    creatorUserId: string,
    requestId: string
  ) => {
    // Only notify if we're the alert creator
    if (user?.id === creatorUserId) {
      // Play positive sound and vibration
      playPositiveAlert();
      
      showGenericNotification(
        '✅ ¡Rescatista llegó!',
        'El rescatista ha llegado a tu ubicación. La ayuda está aquí.',
        `arrived-${requestId}`
      );
      
      // Also show a toast for in-app notification
      toast.success('¡El rescatista llegó!', {
        description: 'La ayuda está en tu ubicación',
        duration: 8000,
      });
    }
  }, [user, showGenericNotification]);

  // Notify the alert creator that their alert was resolved and show thank you
  const notifyAlertResolved = useCallback((
    creatorUserId: string,
    requestId: string
  ) => {
    // Only notify if we're the alert creator
    if (user?.id === creatorUserId) {
      // Play positive sound and vibration
      playPositiveAlert();
      
      showGenericNotification(
        '🎉 ¡Alerta resuelta!',
        'Tu solicitud de ayuda ha sido atendida exitosamente.',
        `resolved-${requestId}`
      );
      
      // Show thank you dialog
      setShowThankYou(true);
    }
  }, [user, showGenericNotification]);

  // Mark as arrived at the emergency location
  const markAsArrived = useCallback(async () => {
    if (!activeResponse || !user) return false;

    try {
      const { error } = await supabase
        .from('help_requests')
        .update({
          arrived_at: new Date().toISOString(),
        })
        .eq('id', activeResponse.requestId)
        .eq('responding_by', user.id);

      if (error) {
        console.error('Error marking as arrived:', error);
        toast.error('Error al marcar llegada');
        return false;
      }

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
      // Clear responding_by from the request
      await supabase
        .from('help_requests')
        .update({
          responding_by: null,
          responding_started_at: null,
        })
        .eq('id', activeResponse.requestId)
        .eq('responding_by', user.id);

      stopLocationTracking();
      setActiveResponse(null);
      toast.info('Respuesta cancelada');
    } catch (error) {
      console.error('Error stopping response:', error);
    }
  }, [activeResponse, user]);

  // Track location while responding
  const startLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        if (!user) return;

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Update user location in database
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
  }, [user]);

  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Mark the alert as resolved/complete (after arriving)
  const markAsResolved = useCallback(async () => {
    if (!activeResponse || !user) return false;

    try {
      const { error } = await supabase
        .from('help_requests')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', activeResponse.requestId)
        .eq('responding_by', user.id);

      if (error) {
        console.error('Error resolving alert:', error);
        toast.error('Error al resolver alerta');
        return false;
      }

      // Stop location tracking
      stopLocationTracking();
      setActiveResponse(null);

      toast.success('¡Alerta resuelta!', {
        description: 'Gracias por tu ayuda',
      });
      return true;
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Error al resolver alerta');
      return false;
    }
  }, [activeResponse, user, stopLocationTracking]);

  // Fetch responders for a specific request
  const fetchResponders = useCallback(async (requestId: string) => {
    const { data: request } = await supabase
      .from('help_requests')
      .select('responding_by')
      .eq('id', requestId)
      .maybeSingle();

    if (request?.responding_by) {
      const { data: location } = await supabase
        .from('user_locations')
        .select('*')
        .eq('user_id', request.responding_by)
        .maybeSingle();

      if (location) {
        setResponderLocations(prev => {
          const newMap = new Map(prev);
          newMap.set(requestId, {
            userId: request.responding_by,
            lat: location.lat,
            lng: location.lng,
            updatedAt: location.updated_at,
          });
          return newMap;
        });
      }
    }
  }, []);

  // Subscribe to help request updates for responder tracking
  useEffect(() => {
    const channel = supabase
      .channel('responder_tracking')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'help_requests' },
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
          
          // Check if alert was just resolved
          if (updated.resolved && !previous.resolved) {
            // Notify the alert creator with thank you dialog
            notifyAlertResolved(updated.user_id, updated.id);
          }
          // Check if someone just started responding (responding_by changed from null to a value)
          else if (updated.responding_by && !previous.responding_by) {
            // Notify the alert creator
            notifyAlertCreator(updated.user_id, updated.id);
            fetchResponders(updated.id);
          } 
          // Check if responder just arrived (arrived_at changed from null to a value)
          else if (updated.arrived_at && !previous.arrived_at) {
            // Notify the alert creator that responder has arrived
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

    return () => {
      supabase.removeChannel(channel);
      stopLocationTracking();
    };
  }, [fetchResponders, stopLocationTracking, notifyAlertCreator, notifyResponderArrived, notifyAlertResolved]);

  // Check if user is already responding to something
  useEffect(() => {
    if (!user) return;

    const checkExistingResponse = async () => {
      const { data } = await supabase
        .from('help_requests')
        .select('id, lat, lng, responding_started_at')
        .eq('responding_by', user.id)
        .eq('resolved', false)
        .maybeSingle();

      if (data) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        }).catch(() => null);

        if (position) {
          setActiveResponse({
            requestId: data.id,
            requestLat: data.lat,
            requestLng: data.lng,
            startedAt: new Date(data.responding_started_at || Date.now()),
            responderLat: position.coords.latitude,
            responderLng: position.coords.longitude,
          });
          startLocationTracking();
        }
      }
    };

    checkExistingResponse();
  }, [user, startLocationTracking]);

  const dismissThankYou = useCallback(() => {
    setShowThankYou(false);
  }, []);

  return {
    activeResponse,
    responderLocations,
    startResponding,
    stopResponding,
    markAsArrived,
    markAsResolved,
    fetchResponders,
    isResponding: activeResponse !== null,
    showThankYou,
    dismissThankYou,
  };
}
