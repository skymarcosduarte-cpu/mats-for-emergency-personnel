// Hook to auto-detect arrival at destination via GPS and mark trip as completed
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calculateDistance } from './useLocation';

// Arrival detection radius in kilometers
const ARRIVAL_RADIUS_KM = 0.3; // 300 meters

interface ActiveTrip {
  id: string;
  user_id: string;
  destination: string;
  destination_lat: number | null;
  destination_lng: number | null;
  eta: string;
  origin: string;
}

export function useAutoArrivalDetection() {
  const checkedRef = useRef(false);
  const processingRef = useRef(false);

  // Check if user has arrived at destination based on GPS
  const checkArrival = useCallback(async () => {
    if (checkedRef.current || processingRef.current) return;
    processingRef.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        processingRef.current = false;
        return;
      }

      // Get user's active trips
      const { data: trips, error: tripsError } = await supabase
        .from('transit_trips')
        .select('id, user_id, destination, destination_lat, destination_lng, eta, origin')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

      if (tripsError || !trips || trips.length === 0) {
        processingRef.current = false;
        return;
      }

      // Filter trips that have destination coordinates and ETA has passed
      const now = Date.now();
      const overdueTrips = trips.filter(trip => {
        const etaDate = new Date(trip.eta);
        return etaDate.getTime() < now && trip.destination_lat && trip.destination_lng;
      }) as ActiveTrip[];

      if (overdueTrips.length === 0) {
        processingRef.current = false;
        return;
      }

      // Get current GPS position
      if (!navigator.geolocation) {
        processingRef.current = false;
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;

          for (const trip of overdueTrips) {
            if (!trip.destination_lat || !trip.destination_lng) continue;

            const distance = calculateDistance(
              userLat,
              userLng,
              trip.destination_lat,
              trip.destination_lng
            );

            console.log(`[AutoArrival] Trip ${trip.id}: Distance to destination = ${distance.toFixed(2)} km`);

            if (distance <= ARRIVAL_RADIUS_KM) {
              // User is at destination! Auto-mark as arrived
              console.log(`[AutoArrival] User is at destination, auto-completing trip ${trip.id}`);
              
              const { error: updateError } = await supabase
                .from('transit_trips')
                .update({
                  status: 'ARRIVED',
                  arrived_at: new Date().toISOString(),
                })
                .eq('id', trip.id);

              if (!updateError) {
                toast.success(
                  `✅ ¡Llegada detectada! Tu viaje a ${trip.destination} se marcó como completado automáticamente.`,
                  { duration: 6000 }
                );

                // Notify community about arrival
                try {
                  await supabase.functions.invoke('notify-trip-update', {
                    body: {
                      tripId: trip.id,
                      tripUserId: trip.user_id,
                      eventType: 'auto_arrived',
                      origin: trip.origin,
                      destination: trip.destination,
                    },
                  });
                } catch (notifyError) {
                  console.error('[AutoArrival] Error notifying community:', notifyError);
                }
              } else {
                console.error('[AutoArrival] Error updating trip:', updateError);
              }
            }
          }

          checkedRef.current = true;
          processingRef.current = false;
        },
        (error) => {
          console.warn('[AutoArrival] GPS error:', error.message);
          processingRef.current = false;
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        }
      );
    } catch (error) {
      console.error('[AutoArrival] Error:', error);
      processingRef.current = false;
    }
  }, []);

  // Run check on mount (when app opens)
  useEffect(() => {
    // Small delay to let auth settle
    const timer = setTimeout(() => {
      checkArrival();
    }, 2000);

    return () => clearTimeout(timer);
  }, [checkArrival]);

  return { checkArrival };
}
