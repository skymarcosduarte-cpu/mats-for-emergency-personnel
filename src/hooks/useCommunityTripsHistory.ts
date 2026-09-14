// Hook to fetch community trips history (last 24 hours) including active, delayed, and completed trips

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CommunityTripHistory {
  id: string;
  user_id: string;
  transit_type: 'ROAD' | 'FLIGHT' | 'HELICOPTER';
  origin: string;
  destination: string;
  eta: string;
  status: string;
  created_at: string;
  arrived_at: string | null;
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
  // Calculated
  is_delayed?: boolean;
}

const HISTORY_HOURS = 24;

export function useCommunityTripsHistory() {
  const [trips, setTrips] = useState<CommunityTripHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCleared, setLastCleared] = useState<Date>(new Date());

  const fetchCommunityTrips = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);

      // Calculate the cutoff time (24 hours ago)
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - HISTORY_HOURS);
      const cutoffIso = cutoffTime.toISOString();

      // Fetch community trips (active + last 24h completed/cancelled) via
      // a SECURITY DEFINER RPC that returns only safe columns.
      const { data: rpcData, error: rpcError } = await rpcWithAuthRetry<any[]>('get_community_trips');

      if (rpcError) throw rpcError;

      const combined = (rpcData ?? []).filter((t: any) => {
        if (t.status === 'ACTIVE') {
          return new Date(t.created_at).getTime() >= cutoffTime.getTime();
        }
        return t.arrived_at && new Date(t.arrived_at).getTime() >= cutoffTime.getTime();
      });

      // De-duplicate by id (defensive)
      const seen = new Set<string>();
      const tripsData = combined.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      // Sort newest first using arrived_at if present, otherwise created_at
      tripsData.sort((a, b) => {
        const aTime = new Date((a.arrived_at ?? a.created_at) as string).getTime();
        const bTime = new Date((b.arrived_at ?? b.created_at) as string).getTime();
        return bTime - aTime;
      });

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

      const now = new Date();

      // Merge data and determine delayed status
      const tripsWithDetails: CommunityTripHistory[] = tripsData.map(trip => {
        const etaDate = new Date(trip.eta);
        // Trip is delayed if ETA has passed and it's still active
        const isDelayed = trip.status === 'ACTIVE' && etaDate < now;

        return {
          ...trip,
          transit_type: trip.transit_type as 'ROAD' | 'FLIGHT' | 'HELICOPTER',
          nickname: nicknameMap.get(trip.user_id) || null,
          is_delayed: isDelayed,
        };
      });

      // Filter to only show:
      // 1. Active trips (always show within 24h of creation)
      // 2. Arrived/Cancelled trips from the last 24 hours
      const filteredTrips = tripsWithDetails.filter(trip => {
        if (trip.status === 'ACTIVE') {
          // Show active trips created in last 24 hours
          const createdAt = new Date(trip.created_at);
          return createdAt >= cutoffTime;
        }
        // For completed/cancelled, already filtered by arrived_at in the query
        return true;
      });

      setTrips(filteredTrips);
      console.log('[useCommunityTripsHistory] Loaded', filteredTrips.length, 'trips from last 24 hours', {
        activeCount: filteredTrips.filter(t => t.status === 'ACTIVE').length,
        completedCount: filteredTrips.filter(t => t.status !== 'ACTIVE').length,
        cutoffIso,
        arrivedStatuses: filteredTrips.filter(t => t.status === 'ARRIVED').map(t => ({ id: t.id.slice(0,8), arrived: t.arrived_at }))
      });
    } catch (err) {
      console.error('[useCommunityTripsHistory] Error fetching trips:', err);
      setError('Error al cargar historial de viajes');
    } finally {
      setLoading(false);
    }
  }, []);

  // Wrapper for button onClick handlers
  const refresh = useCallback(() => {
    fetchCommunityTrips(false);
  }, [fetchCommunityTrips]);

  // Clear old data and refresh every 24 hours
  useEffect(() => {
    const checkAndClear = () => {
      const now = new Date();
      const hoursSinceLastClear = (now.getTime() - lastCleared.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastClear >= HISTORY_HOURS) {
        console.log('[useCommunityTripsHistory] Clearing history after 24 hours');
        setTrips([]);
        setLastCleared(now);
        fetchCommunityTrips(false);
      }
    };

    // Check every minute
    const intervalId = setInterval(checkAndClear, 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [lastCleared, fetchCommunityTrips]);

  // Initial fetch
  useEffect(() => {
    fetchCommunityTrips();
  }, [fetchCommunityTrips]);

  // Subscribe to realtime updates for trips
  useEffect(() => {
    const tripsChannel = supabase
      .channel('community_trips_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transit_trips',
        },
        () => {
          fetchCommunityTrips(true); // Background refresh
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tripsChannel);
    };
  }, [fetchCommunityTrips]);

  return {
    trips,
    loading,
    error,
    refresh,
    lastCleared,
  };
}
