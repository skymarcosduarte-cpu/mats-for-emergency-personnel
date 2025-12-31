// Prefetch Hook for COMUNIDAD EX SOS
// Preloads critical data in parallel for faster initial display

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  cacheUserLocations, 
  cacheCommunityTrips,
  getCachedUserLocations,
  getCachedCommunityTrips,
} from '@/lib/offlineDataCache';

/**
 * Hook to prefetch and cache critical app data in parallel
 * This runs once on mount and preloads data that multiple components need
 */
export function usePrefetch(userId: string | undefined) {
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (!userId || prefetchedRef.current) return;
    prefetchedRef.current = true;

    const prefetchData = async () => {
      console.log('[usePrefetch] Starting parallel prefetch...');
      const startTime = performance.now();

      try {
        // Prefetch all critical data in parallel
        const [locationsResult, tripsResult] = await Promise.all([
          // User locations with roles
          supabase
            .from('user_locations_with_roles')
            .select('*'),
          // Active community trips
          supabase
            .from('transit_trips')
            .select('id, user_id, transit_type, origin, destination, eta, created_at, origin_lat, origin_lng, destination_lat, destination_lng, vehicle_type, plates, companions, airline, flight_number, share_token')
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: false }),
        ]);

        // Cache locations
        if (!locationsResult.error && locationsResult.data) {
          await cacheUserLocations(locationsResult.data);
          console.log('[usePrefetch] Cached', locationsResult.data.length, 'user locations');
        }

        // Cache trips
        if (!tripsResult.error && tripsResult.data) {
          await cacheCommunityTrips(tripsResult.data);
          console.log('[usePrefetch] Cached', tripsResult.data.length, 'community trips');
        }

        const elapsed = performance.now() - startTime;
        console.log(`[usePrefetch] Completed in ${elapsed.toFixed(0)}ms`);
      } catch (error) {
        console.error('[usePrefetch] Error:', error);
      }
    };

    // Start prefetch immediately
    prefetchData();
  }, [userId]);
}

/**
 * Synchronously load cached data for instant display
 * Returns cached data immediately, fresh data loads in background
 */
export async function getInstantData() {
  const [locations, trips] = await Promise.all([
    getCachedUserLocations(),
    getCachedCommunityTrips(),
  ]);

  return {
    locations: locations.data,
    trips: trips.data,
    hasCachedData: locations.isCached || trips.isCached,
  };
}
