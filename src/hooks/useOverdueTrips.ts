// Hook for detecting overdue trips and sending notifications
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const OVERDUE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

interface OverdueTrip {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  eta: string;
  overdueMinutes: number;
}

export function useOverdueTrips() {
  const [overdueTrip, setOverdueTrip] = useState<OverdueTrip | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const notifiedTripsRef = useRef<Set<string>>(new Set());
  const contactsNotifiedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const safeConfirmedRef = useRef<Set<string>>(new Set()); // Tracks trips where user confirmed safe

  // Notify emergency contacts about overdue trip
  const notifyContactsOverdue = useCallback(async (trip: {
    id: string;
    user_id: string;
    origin: string;
    destination: string;
    eta: string;
  }, overdueMinutes: number) => {
    if (contactsNotifiedRef.current.has(trip.id)) {
      return;
    }

    try {
      console.log('[useOverdueTrips] Notifying contacts about overdue trip:', trip.id);
      
      const { data, error } = await supabase.functions.invoke('notify-trip-update', {
        body: {
          tripId: trip.id,
          tripUserId: trip.user_id,
          eventType: 'overdue',
          origin: trip.origin,
          destination: trip.destination,
          eta: trip.eta,
          overdueMinutes: Math.round(overdueMinutes),
        }
      });

      if (error) {
        console.error('[useOverdueTrips] Error notifying contacts:', error);
        return;
      }

      contactsNotifiedRef.current.add(trip.id);
      console.log('[useOverdueTrips] Contacts notified:', data);
    } catch (error) {
      console.error('[useOverdueTrips] Error calling notify-trip-update:', error);
    }
  }, []);

  const checkOverdueTrips = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: trips, error } = await supabase
        .from('transit_trips')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

      if (error) {
        console.error('[useOverdueTrips] Error fetching trips:', error);
        return;
      }

      const now = Date.now();

      trips?.forEach((trip) => {
        const etaDate = new Date(trip.eta);
        const overdueMs = now - etaDate.getTime();

        if (overdueMs >= OVERDUE_THRESHOLD_MS) {
          const tripKey = trip.id;
          const overdueMinutes = Math.floor(overdueMs / 60000);
          
          // Skip if user already confirmed safe for this trip recently
          if (safeConfirmedRef.current.has(tripKey)) {
            return;
          }
          
          // Only show dialog/notify once per trip
          if (!notifiedTripsRef.current.has(tripKey)) {
            notifiedTripsRef.current.add(tripKey);
            
            // Set the overdue trip to show dialog
            setOverdueTrip({
              id: trip.id,
              user_id: trip.user_id,
              origin: trip.origin,
              destination: trip.destination,
              eta: trip.eta,
              overdueMinutes,
            });

            sendBrowserNotification(trip);
            notifyContactsOverdue(trip, overdueMinutes);

            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200, 100, 200]);
            }

            console.log('[useOverdueTrips] Overdue trip detected:', trip.id);
          }
        }
      });
    } catch (error) {
      console.error('[useOverdueTrips] Error checking overdue trips:', error);
    }
  }, [notifyContactsOverdue]);

  // Confirm user is safe but still traveling
  const confirmSafe = useCallback(async () => {
    if (!overdueTrip) return;
    
    setIsUpdating(true);
    try {
      // Mark as safe confirmed - won't show dialog again for 30 minutes
      safeConfirmedRef.current.add(overdueTrip.id);
      
      // Clear after 30 minutes to check again
      setTimeout(() => {
        safeConfirmedRef.current.delete(overdueTrip.id);
        notifiedTripsRef.current.delete(overdueTrip.id);
      }, 30 * 60 * 1000);
      
      // Notify community that user confirmed safe
      await supabase.functions.invoke('notify-trip-update', {
        body: {
          tripId: overdueTrip.id,
          tripUserId: overdueTrip.user_id,
          eventType: 'confirmed_safe',
          origin: overdueTrip.origin,
          destination: overdueTrip.destination,
          eta: overdueTrip.eta,
        }
      });
      
      toast.success('¡Gracias por confirmar! Tu comunidad ha sido notificada.');
      setOverdueTrip(null);
    } catch (error) {
      console.error('[useOverdueTrips] Error confirming safe:', error);
      toast.error('Error al confirmar');
    } finally {
      setIsUpdating(false);
    }
  }, [overdueTrip]);

  // Mark trip as arrived (with delay info if applicable)
  const confirmArrived = useCallback(async () => {
    if (!overdueTrip) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('transit_trips')
        .update({ 
          status: 'ARRIVED', 
          arrived_at: new Date().toISOString() 
        })
        .eq('id', overdueTrip.id);

      if (error) throw error;
      
      // Send arrived_delayed event with delay info since trip was overdue
      await supabase.functions.invoke('notify-trip-update', {
        body: {
          tripId: overdueTrip.id,
          tripUserId: overdueTrip.user_id,
          eventType: 'arrived_delayed',
          origin: overdueTrip.origin,
          destination: overdueTrip.destination,
          overdueMinutes: overdueTrip.overdueMinutes,
        }
      });
      
      toast.success('¡Viaje completado! Tu comunidad ha sido notificada.');
      notifiedTripsRef.current.delete(overdueTrip.id);
      contactsNotifiedRef.current.delete(overdueTrip.id);
      safeConfirmedRef.current.delete(overdueTrip.id);
      setOverdueTrip(null);
    } catch (error) {
      console.error('[useOverdueTrips] Error marking arrived:', error);
      toast.error('Error al actualizar viaje');
    } finally {
      setIsUpdating(false);
    }
  }, [overdueTrip]);

  // Extend ETA by given minutes
  const extendEta = useCallback(async (additionalMinutes: number) => {
    if (!overdueTrip) return;
    
    setIsUpdating(true);
    try {
      const currentEta = new Date(overdueTrip.eta);
      const newEta = new Date(Date.now() + additionalMinutes * 60 * 1000);
      
      const { error } = await supabase
        .from('transit_trips')
        .update({ eta: newEta.toISOString() })
        .eq('id', overdueTrip.id);

      if (error) throw error;
      
      await supabase.functions.invoke('notify-trip-update', {
        body: {
          tripId: overdueTrip.id,
          tripUserId: overdueTrip.user_id,
          eventType: 'eta_updated',
          origin: overdueTrip.origin,
          destination: overdueTrip.destination,
          eta: newEta.toISOString(),
          oldEta: overdueTrip.eta,
        }
      });
      
      toast.success(`ETA actualizado: +${additionalMinutes} minutos`);
      notifiedTripsRef.current.delete(overdueTrip.id);
      contactsNotifiedRef.current.delete(overdueTrip.id);
      safeConfirmedRef.current.delete(overdueTrip.id);
      setOverdueTrip(null);
    } catch (error) {
      console.error('[useOverdueTrips] Error extending ETA:', error);
      toast.error('Error al actualizar ETA');
    } finally {
      setIsUpdating(false);
    }
  }, [overdueTrip]);

  // Dismiss dialog without action
  const dismissDialog = useCallback(() => {
    setOverdueTrip(null);
  }, []);

  const sendBrowserNotification = async (trip: { 
    id: string; 
    origin: string; 
    destination: string;
    eta: string;
  }) => {
    if (!('Notification' in window)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const etaDate = new Date(trip.eta);
      const overdueMinutes = Math.floor((Date.now() - etaDate.getTime()) / 60000);

      new Notification('⚠️ Viaje Atrasado - M.A.T.S.', {
        body: `Tu viaje ${trip.origin} → ${trip.destination} está atrasado por ${overdueMinutes} minutos. ¿Estás bien?`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `overdue-trip-${trip.id}`,
        requireInteraction: true,
      });
    } catch (error) {
      console.error('[useOverdueTrips] Error sending notification:', error);
    }
  };

  useEffect(() => {
    checkOverdueTrips();
    intervalRef.current = setInterval(checkOverdueTrips, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkOverdueTrips]);

  return { 
    checkOverdueTrips,
    overdueTrip,
    isUpdating,
    confirmSafe,
    confirmArrived,
    extendEta,
    dismissDialog,
  };
}
