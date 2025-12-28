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

// Proximity threshold for "almost arrived" notification (in meters)
const PROXIMITY_THRESHOLD_METERS = 500;

export function usePanicResponse() {
  const { user } = useAuth();
  const [activeResponse, setActiveResponse] = useState<ActivePanicResponse | null>(null);
  const [responderLocations, setResponderLocations] = useState<Map<string, PanicResponderLocation[]>>(new Map());
  const watchIdRef = useRef<number | null>(null);
  const proximityNotifiedRef = useRef<Set<string>>(new Set()); // Track which alerts we've sent proximity notifications for
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
      // First, verify that the panic event exists
      console.log('[usePanicResponse] Verifying panic event exists...');
      const { data: existingPanic, error: checkError } = await supabase
        .from('panic_events')
        .select('id, user_id, resolved')
        .eq('id', panicId)
        .maybeSingle();
      
      if (checkError) {
        console.error('[usePanicResponse] Error checking panic event:', checkError);
        toast.error('Error al verificar la alerta');
        return false;
      }
      
      if (!existingPanic) {
        console.error('[usePanicResponse] Panic event not found:', panicId);
        toast.error('La alerta no existe o ha sido eliminada');
        return false;
      }
      
      if (existingPanic.resolved) {
        toast.info('Esta alerta ya fue resuelta');
        return false;
      }
      
      console.log('[usePanicResponse] Panic event verified:', existingPanic);

      // Get current location first
      console.log('[usePanicResponse] Getting current position...');
      let responderLat: number;
      let responderLng: number;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        responderLat = position.coords.latitude;
        responderLng = position.coords.longitude;
        console.log('[usePanicResponse] Got position:', { responderLat, responderLng });
      } catch (geoError: any) {
        console.error('[usePanicResponse] Geolocation error:', geoError);
        if (geoError?.code === 1) {
          // PERMISSION_DENIED
          toast.error('Permiso de ubicación denegado', {
            description: 'Necesitas habilitar la ubicación para responder a alertas.',
            duration: 10000,
            action: {
              label: 'Solicitar permiso',
              onClick: () => {
                // Re-request location permission
                navigator.geolocation.getCurrentPosition(
                  () => {
                    toast.success('¡Ubicación habilitada!', {
                      description: 'Ahora puedes intentar responder de nuevo.',
                    });
                  },
                  (err) => {
                    if (err.code === 1) {
                      toast.error('Permiso denegado', {
                        description: 'Ve a Configuración de tu navegador > Permisos > Ubicación para habilitarlo manualmente.',
                        duration: 10000,
                      });
                    }
                  },
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              },
            },
          });
        } else if (geoError?.code === 2) {
          // POSITION_UNAVAILABLE
          toast.error('Ubicación no disponible', {
            description: 'No se pudo obtener tu ubicación. Verifica que el GPS esté activado.',
            duration: 8000,
            action: {
              label: 'Reintentar',
              onClick: () => {
                navigator.geolocation.getCurrentPosition(
                  () => toast.success('¡Ubicación obtenida!'),
                  () => toast.error('Aún no se puede obtener ubicación'),
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              },
            },
          });
        } else if (geoError?.code === 3) {
          // TIMEOUT
          toast.error('Tiempo de espera agotado', {
            description: 'La obtención de ubicación tardó demasiado.',
            duration: 5000,
            action: {
              label: 'Reintentar',
              onClick: () => {
                navigator.geolocation.getCurrentPosition(
                  () => toast.success('¡Ubicación obtenida!'),
                  () => toast.error('Tiempo agotado nuevamente'),
                  { enableHighAccuracy: true, timeout: 15000 }
                );
              },
            },
          });
        } else {
          toast.error('No se pudo obtener tu ubicación');
        }
        return false;
      }

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

      // Get panic event to find creator and notify them
      const { data: panicEvent } = await supabase
        .from('panic_events')
        .select('user_id')
        .eq('id', panicId)
        .maybeSingle();

      if (panicEvent && panicEvent.user_id !== user.id) {
        // Count current responders
        const { count } = await supabase
          .from('panic_event_responders')
          .select('*', { count: 'exact', head: true })
          .eq('panic_id', panicId);

        // Notify the creator via edge function with ETA and transport mode
        supabase.functions.invoke('notify-responder-coming', {
          body: {
            alertId: panicId,
            alertType: 'panic',
            creatorUserId: panicEvent.user_id,
            responderUserId: user.id,
            responderCount: count || 1,
            eventType: 'responding',
            estimatedEtaMinutes: estimatedEtaMinutes || null,
            transportMode: transportMode || null
          }
        }).catch(err => console.warn('Failed to notify creator:', err));
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
      // Only show error if not already handled by geolocation error handler
      if (error instanceof Error && !error.message.includes('ubicación')) {
        toast.error('Error al iniciar respuesta', {
          description: error.message,
        });
      }
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

      // Get panic event to find creator and notify them
      const { data: panicEvent } = await supabase
        .from('panic_events')
        .select('user_id')
        .eq('id', activeResponse.panicId)
        .maybeSingle();

      if (panicEvent && panicEvent.user_id !== user.id) {
        supabase.functions.invoke('notify-responder-coming', {
          body: {
            alertId: activeResponse.panicId,
            alertType: 'panic',
            creatorUserId: panicEvent.user_id,
            responderUserId: user.id,
            responderCount: 1,
            eventType: 'arrived'
          }
        }).catch(err => console.warn('Failed to notify arrival:', err));
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

        // Update user_locations - don't let errors stop the flow
        try {
          const { error: locationError } = await supabase
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
          
          if (locationError) {
            console.warn('[usePanicResponse] Error updating user_locations (non-fatal):', locationError);
          }
        } catch (err) {
          console.warn('[usePanicResponse] Exception updating user_locations:', err);
        }

        // Update responder position - this is more important
        const currentPanicId = panicId || activeResponse?.panicId;
        if (currentPanicId) {
          try {
            await supabase
              .from('panic_event_responders')
              .update({
                lat,
                lng,
                updated_at: new Date().toISOString(),
              })
              .eq('panic_id', currentPanicId)
              .eq('user_id', user.id);
            
            // Check proximity and send notification if within 500m
            if (activeResponse && !proximityNotifiedRef.current.has(currentPanicId)) {
              const distanceMeters = calculateDistance(lat, lng, activeResponse.panicLat, activeResponse.panicLng);
              
              if (distanceMeters <= PROXIMITY_THRESHOLD_METERS) {
                console.log(`[usePanicResponse] Within ${PROXIMITY_THRESHOLD_METERS}m - sending proximity notification`);
                proximityNotifiedRef.current.add(currentPanicId);
                
                // Get panic event to find creator
                const { data: panicEvent } = await supabase
                  .from('panic_events')
                  .select('user_id')
                  .eq('id', currentPanicId)
                  .maybeSingle();
                
                if (panicEvent && panicEvent.user_id !== user.id) {
                  // Notify the creator via edge function
                  supabase.functions.invoke('notify-responder-coming', {
                    body: {
                      alertId: currentPanicId,
                      alertType: 'panic',
                      creatorUserId: panicEvent.user_id,
                      responderUserId: user.id,
                      eventType: 'proximity',
                      responderLat: lat,
                      responderLng: lng,
                    }
                  }).catch(err => console.warn('Failed to send proximity notification:', err));
                }
              }
            }
          } catch (err) {
            console.warn('[usePanicResponse] Error updating responder position:', err);
          }
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
