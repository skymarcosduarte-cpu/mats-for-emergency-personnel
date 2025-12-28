// Hook to fetch active trips from all community members

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  // Joined from profiles_public
  nickname?: string | null;
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
          flight_number
        `)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (tripsError) throw tripsError;

      if (!tripsData || tripsData.length === 0) {
        setTrips([]);
        return;
      }

      // Get unique user IDs to fetch nicknames
      const userIds = [...new Set(tripsData.map(t => t.user_id))];

      // Fetch nicknames from profiles_public
      const { data: profilesData } = await supabase
        .from('profiles_public')
        .select('user_id, nickname')
        .in('user_id', userIds);

      const nicknameMap = new Map(
        profilesData?.map(p => [p.user_id, p.nickname]) || []
      );

      // Merge nicknames into trips
      const tripsWithNicknames: ActiveTrip[] = tripsData.map(trip => ({
        ...trip,
        transit_type: trip.transit_type as 'ROAD' | 'FLIGHT',
        nickname: nicknameMap.get(trip.user_id) || null,
      }));

      setTrips(tripsWithNicknames);
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

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('active_trips_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transit_trips',
        },
        (payload) => {
          console.log('[useActiveTrips] Realtime update:', payload.eventType);
          fetchActiveTrips();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveTrips]);

  return {
    trips,
    loading,
    error,
    refresh: fetchActiveTrips,
  };
}
