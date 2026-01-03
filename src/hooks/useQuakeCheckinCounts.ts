// Hook to get check-in counts for multiple earthquakes
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QuakeCheckinCount {
  usgs_event_id: string;
  ok_count: number;
  total_count: number;
}

export function useQuakeCheckinCounts(eventIds: string[]) {
  const [counts, setCounts] = useState<Record<string, QuakeCheckinCount>>({});
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (eventIds.length === 0) {
      setCounts({});
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quake_checkins')
        .select('usgs_event_id, damage_report')
        .in('usgs_event_id', eventIds);

      if (error) throw error;

      // Aggregate counts per event
      const countMap: Record<string, QuakeCheckinCount> = {};
      
      for (const eventId of eventIds) {
        countMap[eventId] = { usgs_event_id: eventId, ok_count: 0, total_count: 0 };
      }

      for (const checkin of data || []) {
        if (!countMap[checkin.usgs_event_id]) {
          countMap[checkin.usgs_event_id] = { 
            usgs_event_id: checkin.usgs_event_id, 
            ok_count: 0, 
            total_count: 0 
          };
        }
        countMap[checkin.usgs_event_id].total_count++;
        if (checkin.damage_report === 'OK') {
          countMap[checkin.usgs_event_id].ok_count++;
        }
      }

      setCounts(countMap);
    } catch (err) {
      console.error('[QuakeCheckinCounts] Error fetching counts:', err);
    } finally {
      setLoading(false);
    }
  }, [eventIds.join(',')]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (eventIds.length === 0) return;

    const channel = supabase
      .channel('quake-checkin-counts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quake_checkins',
        },
        (payload) => {
          const newCheckin = payload.new as { usgs_event_id: string; damage_report: string };
          if (eventIds.includes(newCheckin.usgs_event_id)) {
            setCounts(prev => {
              const existing = prev[newCheckin.usgs_event_id] || { 
                usgs_event_id: newCheckin.usgs_event_id, 
                ok_count: 0, 
                total_count: 0 
              };
              return {
                ...prev,
                [newCheckin.usgs_event_id]: {
                  ...existing,
                  total_count: existing.total_count + 1,
                  ok_count: newCheckin.damage_report === 'OK' 
                    ? existing.ok_count + 1 
                    : existing.ok_count,
                },
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventIds.join(',')]);

  return { counts, loading, refresh: fetchCounts };
}
