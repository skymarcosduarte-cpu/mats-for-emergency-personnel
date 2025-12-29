import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

export function useDelayedTripChecker() {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<number>(0);

  const checkDelayedTrips = useCallback(async () => {
    // Throttle to avoid too many calls
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL_MS / 2) {
      return;
    }
    lastCheckRef.current = now;

    try {
      console.log('[useDelayedTripChecker] Checking for delayed trips...');
      
      const { data, error } = await supabase.functions.invoke('check-delayed-trips', {
        method: 'POST',
        body: {}
      });

      if (error) {
        console.error('[useDelayedTripChecker] Error:', error);
        return;
      }

      if (data?.delayedCount > 0) {
        console.log(`[useDelayedTripChecker] Found ${data.delayedCount} delayed trips, sent ${data.notificationsSent} notifications`);
      }
    } catch (err) {
      console.error('[useDelayedTripChecker] Exception:', err);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Initial check after a delay
    const initialTimeout = setTimeout(() => {
      checkDelayedTrips();
    }, 30000); // Wait 30 seconds after mount

    // Set up interval
    intervalRef.current = setInterval(checkDelayedTrips, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, checkDelayedTrips]);

  return { checkDelayedTrips };
}
