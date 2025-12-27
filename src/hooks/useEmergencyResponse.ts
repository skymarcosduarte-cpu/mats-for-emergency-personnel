// Emergency Response Hook for tracking responders and routing
// Handles responding to alerts and route tracking - supports multiple responders

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { playPositiveAlert } from '@/lib/alertSound';
import { requestNotificationPermission } from '@/hooks/useInternalMessages';

interface ActiveResponse {
  requestId: string;
  requestLat: number;
  requestLng: number;
  startedAt: Date;
  responderLat: number;
  responderLng: number;
}

interface ResponderLocation {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  updatedAt: string;
  arrivedAt: string | null;
}

// Maximum distance in meters to allow joining a response (10km)
const MAX_RESPONSE_RADIUS = 10000;

export function useEmergencyResponse() {
  const { user } = useAuth();
  const [activeResponse, setActiveResponse] = useState<ActiveResponse | null>(null);
  const [responderLocations, setResponderLocations] = useState<Map<string, ResponderLocation[]>>(new Map());
  const [showThankYou, setShowThankYou] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const { showGenericNotification } = usePushNotifications();

  // Calculate distance between two points in meters
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
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

  // Start responding to a help request
  // skipRadiusCheck: if true, allows responding regardless of distance (for RESCATISTAS)
  const startResponding = useCallback(async (
    requestId: string, 
    requestLat: number, 
    requestLng: number,
    skipRadiusCheck: boolean = false,
    transportMode?: string,
    estimatedEtaMinutes?: number
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

      // Check if user is within radius (skip for RESCATISTAS)
      if (!skipRadiusCheck) {
        const distance = calculateDistance(responderLat, responderLng, requestLat, requestLng);
        if (distance > MAX_RESPONSE_RADIUS) {
          toast.error('Estás demasiado lejos para responder a esta alerta', {
            description: `Distancia: ${(distance / 1000).toFixed(1)} km (máximo ${MAX_RESPONSE_RADIUS / 1000} km)`,
          });
          return false;
        }
      }

      // Insert into the responders table
      const { error: responderError } = await supabase
        .from('help_request_responders')
        .insert({
          request_id: requestId,
          user_id: user.id,
          lat: responderLat,
          lng: responderLng,
          transport_mode: transportMode || null,
          estimated_eta_minutes: estimatedEtaMinutes || null,
        });

      if (responderError) {
        // Check if already responding
        if (responderError.code === '23505') {
          toast.error('Ya estás respondiendo a esta alerta');
          return false;
        }
        console.error('Error starting response:', responderError);
        toast.error('Error al iniciar respuesta');
        return false;
      }

      // Also update the legacy responding_by field for backward compatibility
      // (only if no one else is responding yet)
      await supabase
        .from('help_requests')
        .update({
          responding_by: user.id,
          responding_started_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .is('responding_by', null);

      setActiveResponse({
        requestId,
        requestLat,
        requestLng,
        startedAt: new Date(),
        responderLat,
        responderLng,
      });

      // Start tracking location
      startLocationTracking(requestId);

      // Request notification permission for direct messages from the alert creator
      requestNotificationPermission().then(granted => {
        if (granted) {
          console.log('[EmergencyResponse] Notification permission granted for responder');
        }
      });

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
    requestId: string,
    responderCount: number = 1
  ) => {
    // Only notify if we're the alert creator
    if (user?.id === creatorUserId) {
      // Play positive sound and vibration for reassurance
      playPositiveAlert();
      
      const message = responderCount > 1 
        ? `${responderCount} rescatistas están respondiendo a tu alerta.`
        : 'Un rescatista ha respondido a tu alerta y está en camino a tu ubicación.';
      
      showGenericNotification(
        '🚨 ¡Ayuda en camino!',
        message,
        `response-${requestId}`
      );
      
      // Also show a toast for in-app notification
      toast.success(responderCount > 1 ? `¡${responderCount} rescatistas en camino!` : '¡Un rescatista está en camino!', {
        description: 'Puedes ver su ubicación en el mapa',
        duration: 8000,
      });
    }
  }, [user, showGenericNotification]);

  // Notify the alert creator that a responder has arrived
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
      // Update in the responders table
      const { error } = await supabase
        .from('help_request_responders')
        .update({
          arrived_at: new Date().toISOString(),
        })
        .eq('request_id', activeResponse.requestId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error marking as arrived:', error);
        toast.error('Error al marcar llegada');
        return false;
      }

      // Also update the legacy field if this user is the primary responder
      await supabase
        .from('help_requests')
        .update({
          arrived_at: new Date().toISOString(),
        })
        .eq('id', activeResponse.requestId)
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
      // Remove from responders table
      await supabase
        .from('help_request_responders')
        .delete()
        .eq('request_id', activeResponse.requestId)
        .eq('user_id', user.id);

      // If this user was the primary responder, try to assign another
      const { data: otherResponders } = await supabase
        .from('help_request_responders')
        .select('user_id')
        .eq('request_id', activeResponse.requestId)
        .limit(1);

      if (otherResponders && otherResponders.length > 0) {
        // Assign the next responder as primary
        await supabase
          .from('help_requests')
          .update({
            responding_by: otherResponders[0].user_id,
          })
          .eq('id', activeResponse.requestId)
          .eq('responding_by', user.id);
      } else {
        // No other responders, clear the field
        await supabase
          .from('help_requests')
          .update({
            responding_by: null,
            responding_started_at: null,
          })
          .eq('id', activeResponse.requestId)
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
  const startLocationTracking = useCallback((requestId?: string) => {
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

        // Also update the responder record with current location
        if (requestId || activeResponse?.requestId) {
          await supabase
            .from('help_request_responders')
            .update({
              lat,
              lng,
              updated_at: new Date().toISOString(),
            })
            .eq('request_id', requestId || activeResponse?.requestId)
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
        .eq('id', activeResponse.requestId);

      if (error) {
        console.error('Error resolving alert:', error);
        toast.error('Error al resolver alerta');
        return false;
      }

      // Remove all responders for this request (cleanup)
      await supabase
        .from('help_request_responders')
        .delete()
        .eq('request_id', activeResponse.requestId);

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

  // Fetch all responders for a specific request
  const fetchResponders = useCallback(async (requestId: string) => {
    const { data: responders } = await supabase
      .from('help_request_responders')
      .select('id, user_id, lat, lng, updated_at, arrived_at')
      .eq('request_id', requestId);

    if (responders && responders.length > 0) {
      const locations: ResponderLocation[] = responders.map(r => ({
        id: r.id,
        userId: r.user_id,
        lat: r.lat || 0,
        lng: r.lng || 0,
        updatedAt: r.updated_at,
        arrivedAt: r.arrived_at,
      }));

      setResponderLocations(prev => {
        const newMap = new Map(prev);
        newMap.set(requestId, locations);
        return newMap;
      });
    } else {
      // Fallback to legacy responding_by field
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
            newMap.set(requestId, [{
              id: `legacy-${request.responding_by}`,
              userId: request.responding_by,
              lat: location.lat,
              lng: location.lng,
              updatedAt: location.updated_at || new Date().toISOString(),
              arrivedAt: null,
            }]);
            return newMap;
          });
        }
      }
    }
  }, []);

  // Get responder count for a request
  const getResponderCount = useCallback((requestId: string): number => {
    return responderLocations.get(requestId)?.length || 0;
  }, [responderLocations]);

  // Subscribe to help request and responder updates
  useEffect(() => {
    const helpRequestChannel = supabase
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
            const count = getResponderCount(updated.id);
            notifyAlertCreator(updated.user_id, updated.id, Math.max(count, 1));
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

    // Also subscribe to the responders table for real-time updates
    const respondersChannel = supabase
      .channel('responders_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'help_request_responders' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const data = payload.new as { request_id: string; user_id: string };
            fetchResponders(data.request_id);
            
            // If this is a new responder for an alert we created, notify us
            if (payload.eventType === 'INSERT') {
              const { data: request } = await supabase
                .from('help_requests')
                .select('user_id')
                .eq('id', data.request_id)
                .maybeSingle();
              
              if (request && request.user_id === user?.id) {
                const count = getResponderCount(data.request_id) + 1;
                notifyAlertCreator(request.user_id, data.request_id, count);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const data = payload.old as { request_id: string };
            fetchResponders(data.request_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(helpRequestChannel);
      supabase.removeChannel(respondersChannel);
      stopLocationTracking();
    };
  }, [fetchResponders, stopLocationTracking, notifyAlertCreator, notifyResponderArrived, notifyAlertResolved, getResponderCount, user]);

  // Check if user is already responding to something
  useEffect(() => {
    if (!user) return;

    const checkExistingResponse = async () => {
      // First check the new responders table
      const { data: responderData } = await supabase
        .from('help_request_responders')
        .select('request_id, started_at')
        .eq('user_id', user.id)
        .limit(1);

      if (responderData && responderData.length > 0) {
        const { data: request } = await supabase
          .from('help_requests')
          .select('id, lat, lng')
          .eq('id', responderData[0].request_id)
          .eq('resolved', false)
          .maybeSingle();

        if (request) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          }).catch(() => null);

          if (position) {
            setActiveResponse({
              requestId: request.id,
              requestLat: request.lat,
              requestLng: request.lng,
              startedAt: new Date(responderData[0].started_at),
              responderLat: position.coords.latitude,
              responderLng: position.coords.longitude,
            });
            startLocationTracking(request.id);
          }
          return;
        }
      }

      // Fallback to legacy check
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
          startLocationTracking(data.id);
        }
      }
    };

    checkExistingResponse();
  }, [user, startLocationTracking]);

  const dismissThankYou = useCallback(() => {
    setShowThankYou(false);
  }, []);

  // Update transport mode for active response
  const updateTransportMode = useCallback(async (
    transportMode: string,
    estimatedEtaMinutes: number
  ) => {
    if (!activeResponse || !user) return false;

    try {
      const { error } = await supabase
        .from('help_request_responders')
        .update({
          transport_mode: transportMode,
          estimated_eta_minutes: estimatedEtaMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', activeResponse.requestId)
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
    showThankYou,
    dismissThankYou,
  };
}
