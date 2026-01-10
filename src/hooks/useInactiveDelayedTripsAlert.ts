// Hook to monitor delayed trips with inactive location updates
// Triggers audio alert when a delayed traveler hasn't updated location in 30+ minutes
// Excludes flights since they don't update location during flight

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { toast } from 'sonner';

const LOCATION_INACTIVE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const OVERDUE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes overdue
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

export interface InactiveDelayedTrip {
  tripId: string;
  userId: string;
  nickname: string;
  origin: string;
  destination: string;
  overdueMinutes: number;
  lastLocationUpdate: string;
  minutesSinceUpdate: number;
}

export function useInactiveDelayedTripsAlert() {
  // State to expose the current inactive trip for UI display
  const [pendingInactiveTrip, setPendingInactiveTrip] = useState<InactiveDelayedTrip | null>(null);
  const alertedTripsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkInactiveDelayedTrips = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = Date.now();

      // Fetch all active trips (not flights) that are overdue
      const { data: trips, error: tripsError } = await supabase
        .from('transit_trips')
        .select(`
          id,
          user_id,
          transit_type,
          origin,
          destination,
          eta
        `)
        .eq('status', 'ACTIVE')
        .neq('user_id', user.id) // Don't alert about own trips
        .neq('transit_type', 'FLIGHT'); // Exclude flights

      if (tripsError) {
        console.error('[useInactiveDelayedTripsAlert] Error fetching trips:', tripsError);
        return;
      }

      if (!trips || trips.length === 0) return;

      // Filter to only overdue trips
      const overdueTrips = trips.filter(trip => {
        const etaDate = new Date(trip.eta);
        const overdueMs = now - etaDate.getTime();
        return overdueMs >= OVERDUE_THRESHOLD_MS;
      });

      if (overdueTrips.length === 0) return;

      // Get user IDs from overdue trips
      const userIds = [...new Set(overdueTrips.map(t => t.user_id))];

      // Fetch locations for these users
      const { data: locations, error: locError } = await supabase
        .from('user_locations')
        .select('user_id, updated_at')
        .in('user_id', userIds);

      if (locError) {
        console.error('[useInactiveDelayedTripsAlert] Error fetching locations:', locError);
        return;
      }

      // Fetch nicknames
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, nickname')
        .in('user_id', userIds);

      const locationMap = new Map(locations?.map(l => [l.user_id, l.updated_at]) || []);
      const nicknameMap = new Map(profiles?.map(p => [p.user_id, p.nickname]) || []);

      // Find trips with inactive location
      const inactiveTrips: InactiveDelayedTrip[] = [];

      for (const trip of overdueTrips) {
        const lastUpdate = locationMap.get(trip.user_id);
        
        if (!lastUpdate) {
          // No location data at all - very concerning
          const etaDate = new Date(trip.eta);
          const overdueMinutes = Math.floor((now - etaDate.getTime()) / 60000);
          
          inactiveTrips.push({
            tripId: trip.id,
            userId: trip.user_id,
            nickname: nicknameMap.get(trip.user_id) || 'Usuario',
            origin: trip.origin,
            destination: trip.destination,
            overdueMinutes,
            lastLocationUpdate: 'nunca',
            minutesSinceUpdate: 999,
          });
          continue;
        }

        const lastUpdateDate = new Date(lastUpdate);
        const msSinceUpdate = now - lastUpdateDate.getTime();

        if (msSinceUpdate >= LOCATION_INACTIVE_THRESHOLD_MS) {
          const etaDate = new Date(trip.eta);
          const overdueMinutes = Math.floor((now - etaDate.getTime()) / 60000);
          const minutesSinceUpdate = Math.floor(msSinceUpdate / 60000);

          inactiveTrips.push({
            tripId: trip.id,
            userId: trip.user_id,
            nickname: nicknameMap.get(trip.user_id) || 'Usuario',
            origin: trip.origin,
            destination: trip.destination,
            overdueMinutes,
            lastLocationUpdate: lastUpdate,
            minutesSinceUpdate,
          });
        }
      }

      // Trigger alerts for new inactive trips
      for (const trip of inactiveTrips) {
        const alertKey = `${trip.tripId}-inactive`;
        
        if (!alertedTripsRef.current.has(alertKey)) {
          alertedTripsRef.current.add(alertKey);
          
          console.log('[useInactiveDelayedTripsAlert] Inactive delayed trip detected:', trip);
          
          // Set the pending trip so UI can handle it
          setPendingInactiveTrip(trip);
          
          // Show toast notification silently (no sound/vibration) with action
          toast.warning(`⚠️ ${trip.nickname} sin actualización`, {
            description: `Viaje a ${trip.destination} retrasado ${trip.overdueMinutes} min. Sin actualización de ubicación por ${trip.minutesSinceUpdate} min.`,
            duration: 15000,
            action: {
              label: 'Ver',
              onClick: () => {
                setPendingInactiveTrip(trip);
              },
            },
          });
          
          // Don't clear the alert - only notify once per trip
          // The alert will only be cleared when the trip is completed/cancelled
        }
      }

    } catch (error) {
      console.error('[useInactiveDelayedTripsAlert] Error:', error);
    }
  }, []);

  // Dismiss the pending inactive trip alert
  const dismissInactiveTrip = useCallback(() => {
    setPendingInactiveTrip(null);
  }, []);

  useEffect(() => {
    // Initial check
    checkInactiveDelayedTrips();

    // Set up interval
    intervalRef.current = setInterval(checkInactiveDelayedTrips, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkInactiveDelayedTrips]);

  return { 
    checkInactiveDelayedTrips,
    pendingInactiveTrip,
    dismissInactiveTrip,
  };
}
