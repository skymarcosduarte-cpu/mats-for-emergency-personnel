// Hook to fetch active trips from all community members with real-time location

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance } from '@/hooks/useLocation';
import { getCachedCommunityTrips, cacheCommunityTrips } from '@/lib/offlineDataCache';
import { applyPositionEstimation, type EstimatedPosition, type PositionHistoryPoint } from '@/hooks/usePositionEstimation';

export interface ActiveTrip {
  id: string;
  user_id: string;
  transit_type: 'ROAD' | 'FLIGHT' | 'HELICOPTER';
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
  full_name?: string | null;
  // Current user location (if sharing)
  current_lat?: number | null;
  current_lng?: number | null;
  current_speed?: number | null;
  location_updated_at?: string | null;
  // Calculated fields
  remaining_distance_km?: number | null;
  dynamic_eta_minutes?: number | null;
  // Position estimation fields
  estimated_position?: EstimatedPosition | null;
  display_lat?: number | null;
  display_lng?: number | null;
  is_position_estimated?: boolean;
}

export function useActiveTrips() {
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Recompute estimated/display positions as time passes (even if no new GPS updates arrive).
  // This prevents travelers from looking "frozen" when their last update is stale.
  const recomputeDerivedForTrip = useCallback((trip: ActiveTrip): ActiveTrip => {
    if (!trip.current_lat || !trip.current_lng) return trip;

    const estimatedPosition = applyPositionEstimation(
      {
        current_lat: trip.current_lat,
        current_lng: trip.current_lng,
        current_speed: trip.current_speed,
        location_updated_at: trip.location_updated_at,
        destination_lat: trip.destination_lat,
        destination_lng: trip.destination_lng,
      },
      // No fresh history here; estimation will use last known speed / defaults.
      undefined
    );

    const isEstimated = estimatedPosition?.isEstimated || false;
    const displayLat = isEstimated ? estimatedPosition!.lat : (trip.current_lat ?? null);
    const displayLng = isEstimated ? estimatedPosition!.lng : (trip.current_lng ?? null);

    // Recalculate remaining distance & ETA based on display position
    let remainingDistanceKm: number | null = null;
    let dynamicEtaMinutes: number | null = null;

    if (displayLat && displayLng && trip.destination_lat && trip.destination_lng) {
      remainingDistanceKm = calculateDistance(displayLat, displayLng, trip.destination_lat, trip.destination_lng);

      const speedKmhRaw = trip.current_speed ? trip.current_speed * 3.6 : null;
      const speedKmh = isEstimated
        ? (estimatedPosition?.averageSpeedKmh ?? null)
        : speedKmhRaw;

      const effectiveSpeed = speedKmh && speedKmh > 5 ? speedKmh : 60;
      dynamicEtaMinutes = Math.round((remainingDistanceKm / effectiveSpeed) * 60);
    }

    // If nothing materially changed, keep the same reference to avoid rerenders.
    if (
      (trip.is_position_estimated || false) === isEstimated &&
      trip.display_lat === displayLat &&
      trip.display_lng === displayLng &&
      trip.dynamic_eta_minutes === dynamicEtaMinutes
    ) {
      return trip;
    }

    return {
      ...trip,
      estimated_position: estimatedPosition,
      display_lat: displayLat,
      display_lng: displayLng,
      is_position_estimated: isEstimated,
      remaining_distance_km: remainingDistanceKm,
      dynamic_eta_minutes: dynamicEtaMinutes,
    };
  }, []);

  const fetchActiveTrips = useCallback(async (isBackground = false) => {
    try {
      // Only show loading on initial fetch, not background refreshes
      if (!isBackground) {
        // Try to load from cache first for instant display, but validate it
        const cached = await getCachedCommunityTrips<ActiveTrip>();
        if (cached.isCached && cached.data.length > 0) {
          // Validate cache has required data (nickname should not be null for cached trips)
          const validCachedTrips = cached.data.filter(t => t.nickname !== null);
          if (validCachedTrips.length > 0) {
            setTrips(cached.data);
            setLoading(false);
            console.log('[useActiveTrips] Loaded from cache:', cached.data.length, 'trips (will refresh)');
          }
        }
      }
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

      // If no active trips, clear state and cache immediately
      if (!tripsData || tripsData.length === 0) {
        setTrips([]);
        await cacheCommunityTrips([]); // Clear cache when no active trips
        console.log('[useActiveTrips] No active trips, cleared cache');
        return;
      }

      // Get unique user IDs and trip IDs to fetch data
      const userIds = [...new Set(tripsData.map(t => t.user_id))];
      const tripIds = tripsData.map(t => t.id);

      // Fetch nicknames, current locations, and position history in parallel
      const [profilesResult, locationsResult, positionHistoryResult] = await Promise.all([
        supabase
          .from('profiles_public')
          .select('user_id, nickname')
          .in('user_id', userIds),
        supabase
          .from('user_locations')
          .select('user_id, lat, lng, speed, updated_at')
          .in('user_id', userIds)
          .eq('is_online', true),
        // Fetch position history for estimation (last 60 minutes)
        supabase
          .from('trip_position_history')
          .select('trip_id, lat, lng, speed, recorded_at')
          .in('trip_id', tripIds)
          .gte('recorded_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .order('recorded_at', { ascending: false })
      ]);

      const nicknameMap = new Map(
        profilesResult.data?.map(p => [p.user_id, p.nickname]) || []
      );

      // Always fetch full_name from profiles (and nickname fallback for users not in profiles_public)
      const fullNameMap = new Map<string, string | null>();
      const { data: profilesFull } = await supabase
        .from('profiles')
        .select('id, nickname, full_name')
        .in('id', userIds);
      profilesFull?.forEach(p => {
        fullNameMap.set(p.id, p.full_name || null);
        if (!nicknameMap.has(p.id)) {
          nicknameMap.set(p.id, p.nickname || null);
        }
      });

      const locationMap = new Map(
        locationsResult.data?.map(l => [l.user_id, { 
          lat: l.lat, 
          lng: l.lng, 
          speed: l.speed,
          updated_at: l.updated_at 
        }]) || []
      );

      // Group position history by trip_id
      const positionHistoryMap = new Map<string, PositionHistoryPoint[]>();
      positionHistoryResult.data?.forEach(p => {
        const existing = positionHistoryMap.get(p.trip_id) || [];
        existing.push({
          lat: p.lat,
          lng: p.lng,
          speed: p.speed,
          recorded_at: p.recorded_at,
        });
        positionHistoryMap.set(p.trip_id, existing);
      });

      // Merge data, calculate dynamic ETA, and apply position estimation
      const tripsWithDetails: ActiveTrip[] = tripsData.map(trip => {
        const location = locationMap.get(trip.user_id);
        const positionHistory = positionHistoryMap.get(trip.id) || [];
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

        // Apply position estimation for stale GPS data
        const estimatedPosition = location ? applyPositionEstimation(
          {
            current_lat: location.lat,
            current_lng: location.lng,
            current_speed: location.speed,
            location_updated_at: location.updated_at,
            destination_lat: trip.destination_lat,
            destination_lng: trip.destination_lng,
          },
          positionHistory
        ) : null;

        // Use estimated position for display if available
        const displayLat = estimatedPosition?.isEstimated ? estimatedPosition.lat : (location?.lat || null);
        const displayLng = estimatedPosition?.isEstimated ? estimatedPosition.lng : (location?.lng || null);

        // Recalculate remaining distance based on display position
        if (estimatedPosition?.isEstimated && trip.destination_lat && trip.destination_lng) {
          remainingDistanceKm = calculateDistance(
            displayLat!,
            displayLng!,
            trip.destination_lat,
            trip.destination_lng
          );
          // Use average speed from estimation for ETA
          const effectiveSpeed = estimatedPosition.averageSpeedKmh > 5 ? estimatedPosition.averageSpeedKmh : 60;
          dynamicEtaMinutes = Math.round((remainingDistanceKm / effectiveSpeed) * 60);
        }

        return {
          ...trip,
          transit_type: trip.transit_type as 'ROAD' | 'FLIGHT' | 'HELICOPTER',
          nickname: nicknameMap.get(trip.user_id) || null,
          full_name: fullNameMap.get(trip.user_id) || null,
          current_lat: location?.lat || null,
          current_lng: location?.lng || null,
          current_speed: location?.speed || null,
          location_updated_at: location?.updated_at || null,
          remaining_distance_km: remainingDistanceKm,
          dynamic_eta_minutes: dynamicEtaMinutes,
          estimated_position: estimatedPosition,
          display_lat: displayLat,
          display_lng: displayLng,
          is_position_estimated: estimatedPosition?.isEstimated || false,
        };
      });

      setTrips(tripsWithDetails);
      
      // Cache the trips for offline/instant loading
      await cacheCommunityTrips(tripsWithDetails);
      console.log('[useActiveTrips] Cached', tripsWithDetails.length, 'trips');
    } catch (err) {
      console.error('[useActiveTrips] Error fetching trips:', err);
      setError('Error al cargar viajes activos');
    } finally {
      setLoading(false);
      setInitialFetchDone(true);
    }
  }, []);

  // Wrapper for button onClick handlers
  const refresh = useCallback(() => {
    fetchActiveTrips(false);
  }, [fetchActiveTrips]);

  // Initial fetch
  useEffect(() => {
    fetchActiveTrips();
  }, [fetchActiveTrips]);

  // Track user IDs with active trips for location updates
  const activeUserIds = useMemo(() => {
    return new Set(trips.map(t => t.user_id));
  }, [trips]);

  // Subscribe to realtime updates for trips (background refresh, no loading spinner)
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
        (payload) => {
          console.log('[useActiveTrips] Trip changed:', payload.eventType, payload.new);
          // Immediately refetch to ensure we have latest state
          fetchActiveTrips(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tripsChannel);
    };
  }, [fetchActiveTrips]);

  // Separate subscription for location updates - update in-place without full refetch
  useEffect(() => {
    if (activeUserIds.size === 0) return;

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
          const newLoc = payload.new as { user_id?: string; lat?: number; lng?: number; speed?: number; updated_at?: string };
          const userId = newLoc?.user_id;
          
          if (userId && activeUserIds.has(userId)) {
            // Update trip in-place instead of full refetch
            setTrips(prev => prev.map(trip => {
              if (trip.user_id !== userId) return trip;
              
              // Calculate new remaining distance and ETA
              let remainingDistanceKm: number | null = null;
              let dynamicEtaMinutes: number | null = null;
              
              if (newLoc.lat && newLoc.lng && trip.destination_lat && trip.destination_lng) {
                remainingDistanceKm = calculateDistance(
                  newLoc.lat,
                  newLoc.lng,
                  trip.destination_lat,
                  trip.destination_lng
                );
                const speedKmh = newLoc.speed ? newLoc.speed * 3.6 : null;
                const effectiveSpeed = speedKmh && speedKmh > 5 ? speedKmh : 60;
                dynamicEtaMinutes = Math.round((remainingDistanceKm / effectiveSpeed) * 60);
              }
              
              // Apply position estimation for the updated location
              const estimatedPosition = applyPositionEstimation(
                {
                  current_lat: newLoc.lat,
                  current_lng: newLoc.lng,
                  current_speed: newLoc.speed,
                  location_updated_at: newLoc.updated_at,
                  destination_lat: trip.destination_lat,
                  destination_lng: trip.destination_lng,
                },
                // We don't have fresh position history here, so estimation will use default speed
                undefined
              );
              
              // Use estimated position for display if available
              const displayLat = estimatedPosition?.isEstimated ? estimatedPosition.lat : (newLoc.lat ?? trip.current_lat);
              const displayLng = estimatedPosition?.isEstimated ? estimatedPosition.lng : (newLoc.lng ?? trip.current_lng);
              
              // Recalculate based on display position if estimated
              if (estimatedPosition?.isEstimated && trip.destination_lat && trip.destination_lng && displayLat && displayLng) {
                remainingDistanceKm = calculateDistance(
                  displayLat,
                  displayLng,
                  trip.destination_lat,
                  trip.destination_lng
                );
                const effectiveSpeed = estimatedPosition.averageSpeedKmh > 5 ? estimatedPosition.averageSpeedKmh : 60;
                dynamicEtaMinutes = Math.round((remainingDistanceKm / effectiveSpeed) * 60);
              }
              
              return {
                ...trip,
                current_lat: newLoc.lat ?? trip.current_lat,
                current_lng: newLoc.lng ?? trip.current_lng,
                current_speed: newLoc.speed ?? trip.current_speed,
                location_updated_at: newLoc.updated_at ?? trip.location_updated_at,
                remaining_distance_km: remainingDistanceKm,
                dynamic_eta_minutes: dynamicEtaMinutes,
                estimated_position: estimatedPosition,
                display_lat: displayLat,
                display_lng: displayLng,
                is_position_estimated: estimatedPosition?.isEstimated || false,
              };
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(locationsChannel);
    };
  }, [activeUserIds]);

  // Tick: advance estimations over time without needing new realtime events.
  useEffect(() => {
    if (trips.length === 0) return;

    const intervalId = window.setInterval(() => {
      setTrips(prev => {
        let changed = false;
        const next = prev.map(t => {
          const updated = recomputeDerivedForTrip(t);
          if (updated !== t) changed = true;
          return updated;
        });
        return changed ? next : prev;
      });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [recomputeDerivedForTrip, trips.length]);

  return {
    trips,
    loading,
    error,
    refresh,
  };
}
