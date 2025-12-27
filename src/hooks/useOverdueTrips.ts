// Hook for detecting overdue trips and sending notifications
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const OVERDUE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

export function useOverdueTrips() {
  const notifiedTripsRef = useRef<Set<string>>(new Set());
  const contactsNotifiedRef = useRef<Set<string>>(new Set()); // Track trips where contacts were notified
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Notify emergency contacts about overdue trip
  const notifyContactsOverdue = useCallback(async (trip: {
    id: string;
    user_id: string;
    origin: string;
    destination: string;
    eta: string;
  }, overdueMinutes: number) => {
    // Only notify contacts once per trip
    if (contactsNotifiedRef.current.has(trip.id)) {
      console.log('[useOverdueTrips] Contacts already notified for trip:', trip.id);
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
      
      if (data?.contactsNotified > 0) {
        toast.info(`Tus ${data.contactsNotified} contacto(s) de emergencia fueron notificados de tu retraso`);
      }
      
      console.log('[useOverdueTrips] Contacts notified:', data);
    } catch (error) {
      console.error('[useOverdueTrips] Error calling notify-trip-update:', error);
    }
  }, []);

  const checkOverdueTrips = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch active trips for the current user
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

        // Check if trip is overdue by 30+ minutes
        if (overdueMs >= OVERDUE_THRESHOLD_MS) {
          const tripKey = trip.id;
          const overdueMinutes = Math.floor(overdueMs / 60000);
          
          // Only notify once per trip
          if (!notifiedTripsRef.current.has(tripKey)) {
            notifiedTripsRef.current.add(tripKey);
            
            // Show persistent warning toast
            toast.warning(
              `⚠️ Viaje atrasado: ${trip.origin} → ${trip.destination}`,
              {
                description: 'Han pasado más de 30 minutos desde tu hora estimada de llegada. ¿Estás bien?',
                duration: Infinity,
                action: {
                  label: '✓ Llegué',
                  onClick: () => markTripArrived(trip.id, trip.user_id, trip.origin, trip.destination),
                },
              }
            );

            // Send browser notification if permitted
            sendBrowserNotification(trip);

            // Notify emergency contacts
            notifyContactsOverdue(trip, overdueMinutes);

            // Vibrate if supported
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

  const markTripArrived = async (tripId: string, userId: string, origin: string, destination: string) => {
    try {
      const { error } = await supabase
        .from('transit_trips')
        .update({ 
          status: 'COMPLETED', 
          arrived_at: new Date().toISOString() 
        })
        .eq('id', tripId);

      if (error) throw error;
      
      // Notify contacts about arrival
      try {
        await supabase.functions.invoke('notify-trip-update', {
          body: {
            tripId,
            tripUserId: userId,
            eventType: 'arrived',
            origin,
            destination,
          }
        });
      } catch (notifyError) {
        console.error('[useOverdueTrips] Error notifying contacts of arrival:', notifyError);
      }
      
      toast.success('¡Viaje completado! Tu comunidad ha sido notificada.');
      notifiedTripsRef.current.delete(tripId);
      contactsNotifiedRef.current.delete(tripId);
    } catch (error) {
      console.error('[useOverdueTrips] Error marking trip arrived:', error);
      toast.error('Error al actualizar viaje');
    }
  };

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
    // Initial check
    checkOverdueTrips();

    // Set up interval for periodic checks
    intervalRef.current = setInterval(checkOverdueTrips, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkOverdueTrips]);

  return { checkOverdueTrips };
}
