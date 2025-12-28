// Hook to fetch active trips from all community members with real-time location

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance } from '@/hooks/useLocation';

export interface ActiveTrip {
  id: string;
  user_id: string;
  transit_type: 'ROAD' | 'FLIGHT';
  origin: string;
  destination: string;
  eta: string;
  created_at: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  vehicle_type: string | null;
  plates: string | null;
  companions: string | null;
  airline: string | null;
  flight_number: string | null;
  share_token: string | null;
  // Joined from profiles_public
  nickname?: string | null;
  // Current user location (if sharing)
  current_lat?: number | null;
  current_lng?: number | null;
  current_speed?: number | null;
  location_updated_at?: string | null;
  // Calculated fields
  remaining_distance_km?: number | null;
  dynamic_eta_minutes?: number | null;
}

export function useActiveTrips() {
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveTrips = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch active trips (RLS allows viewing trips with status='ACTIVE')
      const { data: tripsData, error: tripsError } = await supabase
        .from('transit_trips')
        .select(`
          id,
          user_id,
          transit_type,
          origin,
          destination,
          eta,
          created_at,
          origin_lat,
          origin_lng,
          destination_lat,
          destination_lng,
          vehicle_type,
          plates,
          companions,
          airline,
          flight_number,
          share_token
        `)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (tripsError) throw tripsError;

      if (!tripsData || tripsData.length === 0) {
        setTrips([]);
        return;
      }

      // Get unique user IDs to fetch nicknames and locations
      const userIds = [...new Set(tripsData.map(t => t.user_id))];

      // Fetch nicknames from profiles_public and current locations in parallel
      const [profilesResult, locationsResult] = await Promise.all([
        supabase
          .from('profiles_public')
          .select('user_id, nickname')
          .in('user_id', userIds),
        supabase
          .from('user_locations')
          .select('user_id, lat, lng, speed, updated_at')
          .in('user_id', userIds)
          .eq('is_online', true)
      ]);

      const nicknameMap = new Map(
        profilesResult.data?.map(p => [p.user_id, p.nickname]) || []
      );

      const locationMap = new Map(
        locationsResult.data?.map(l => [l.user_id, { 
          lat: l.lat, 
          lng: l.lng, 
          speed: l.speed,
          updated_at: l.updated_at 
        }]) || []
      );

      // Merge data and calculate dynamic ETA
      const tripsWithDetails: ActiveTrip[] = tripsData.map(trip => {
        const location = locationMap.get(trip.user_id);
        let remainingDistanceKm: number | null = null;
        let dynamicEtaMinutes: number | null = null;

        // Calculate remaining distance if we have current location and destination
        if (location && trip.destination_lat && trip.destination_lng) {
          remainingDistanceKm = calculateDistance(
            location.lat,
            location.lng,
            trip.destination_lat,
            trip.destination_lng
          );

          // Calculate dynamic ETA based on speed or default 60 km/h
          const speedKmh = location.speed ? location.speed * 3.6 : null;
          const effectiveSpeed = speedKmh && speedKmh > 5 ? speedKmh : 60;
          dynamicEtaMinutes = Math.round((remainingDistanceKm / effectiveSpeed) * 60);
        }

        return {
          ...trip,
          transit_type: trip.transit_type as 'ROAD' | 'FLIGHT',
          nickname: nicknameMap.get(trip.user_id) || null,
          current_lat: location?.lat || null,
          current_lng: location?.lng || null,
          current_speed: location?.speed || null,
          location_updated_at: location?.updated_at || null,
          remaining_distance_km: remainingDistanceKm,
          dynamic_eta_minutes: dynamicEtaMinutes,
        };
      });

      setTrips(tripsWithDetails);
    } catch (err) {
      console.error('[useActiveTrips] Error fetching trips:', err);
      setError('Error al cargar viajes activos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchActiveTrips();
  }, [fetchActiveTrips]);

  // Track user IDs with active trips for location updates
  const activeUserIds = useMemo(() => {
    return new Set(trips.map(t => t.user_id));
  }, [trips]);

  // Subscribe to realtime updates for trips
  useEffect(() => {
    const tripsChannel = supabase
      .channel('active_trips_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transit_trips',
        },
        () => {
          fetchActiveTrips();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tripsChannel);
    };
  }, [fetchActiveTrips]);

  // Separate subscription for location updates with throttling
  useEffect(() => {
    if (activeUserIds.size === 0) return;

    let lastFetchTime = 0;
    const minInterval = 30000; // Throttle to max once per 30 seconds

    const locationsChannel = supabase
      .channel('active_trips_locations')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_locations',
        },
        (payload) => {
          const userId = (payload.new as { user_id?: string })?.user_id;
          if (userId && activeUserIds.has(userId)) {
            const now = Date.now();
            if (now - lastFetchTime >= minInterval) {
              lastFetchTime = now;
              fetchActiveTrips();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(locationsChannel);
    };
  }, [fetchActiveTrips, activeUserIds]);

  return {
    trips,
    loading,
    error,
    refresh: fetchActiveTrips,
  };
}
