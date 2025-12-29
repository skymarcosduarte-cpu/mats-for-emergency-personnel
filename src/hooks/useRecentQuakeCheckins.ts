// Hook to fetch recent quake checkins from all earthquakes
// Used to display in Community tab

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RecentQuakeCheckin {
  id: string;
  user_id: string;
  usgs_event_id: string;
  intensity: number;
  damage_report: string;
  lat: number;
  lng: number;
  created_at: string;
  nickname?: string;
}

export function useRecentQuakeCheckins(limit: number = 20) {
  const [checkins, setCheckins] = useState<RecentQuakeCheckin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCheckins = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch recent checkins (last 24 hours)
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data, error: fetchError } = await supabase
        .from('quake_checkins')
        .select('*')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      // Get user nicknames
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, nickname')
          .in('user_id', userIds);

        const nicknameMap = new Map(profiles?.map(p => [p.user_id, p.nickname]) || []);
        
        const checkinsWithNames = data.map(checkin => ({
          ...checkin,
          nickname: nicknameMap.get(checkin.user_id) || undefined,
        }));

        setCheckins(checkinsWithNames);
      } else {
        setCheckins([]);
      }
    } catch (err) {
      console.error('Error fetching recent quake checkins:', err);
      setError('Error al cargar reportes de sismos');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('recent-quake-checkins')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quake_checkins',
        },
        async (payload) => {
          const newCheckin = payload.new as RecentQuakeCheckin;
          
          // Get nickname for new checkin
          const { data: profile } = await supabase
            .from('profiles_public')
            .select('nickname')
            .eq('user_id', newCheckin.user_id)
            .maybeSingle();

          setCheckins(prev => [{
            ...newCheckin,
            nickname: profile?.nickname || undefined,
          }, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return {
    checkins,
    loading,
    error,
    refresh: fetchCheckins,
  };
}
