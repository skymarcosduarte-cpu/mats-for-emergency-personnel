// Hook to fetch Clave 100 check-ins for a specific drill
// Used to display safety status on the map during drills/emergencies

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Clave100Checkin {
  id: string;
  user_id: string;
  drill_id: string;
  status: 'OK' | 'HELP';
  lat: number;
  lng: number;
  created_at: string;
  // Joined from profiles
  nickname?: string;
  full_name?: string;
}

export interface Clave100CheckinStats {
  total: number;
  ok: number;
  help: number;
}

export function useClave100Checkins(drillId: string | null) {
  const [checkins, setCheckins] = useState<Clave100Checkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Clave100CheckinStats | null>(null);

  const calculateStats = useCallback((data: Clave100Checkin[]) => {
    if (data.length === 0) {
      setStats(null);
      return;
    }
    setStats({
      total: data.length,
      ok: data.filter(c => c.status === 'OK').length,
      help: data.filter(c => c.status === 'HELP').length,
    });
  }, []);

  const fetchCheckins = useCallback(async () => {
    if (!drillId) {
      setCheckins([]);
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch checkins
      const { data: checkinsData, error: fetchError } = await supabase
        .from('clave100_checkins')
        .select('*')
        .eq('drill_id', drillId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Get user profiles for names
      const userIds = [...new Set((checkinsData || []).map(c => c.user_id))];
      
      let profilesMap: Record<string, { nickname: string; full_name: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nickname, full_name')
          .in('id', userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { nickname: p.nickname, full_name: p.full_name };
            return acc;
          }, {} as Record<string, { nickname: string; full_name: string }>);
        }
      }

      // Merge checkins with profiles
      const enrichedCheckins: Clave100Checkin[] = (checkinsData || []).map(c => ({
        ...c,
        status: c.status as 'OK' | 'HELP',
        nickname: profilesMap[c.user_id]?.nickname,
        full_name: profilesMap[c.user_id]?.full_name,
      }));

      setCheckins(enrichedCheckins);
      calculateStats(enrichedCheckins);
    } catch (err) {
      console.error('Error fetching clave100 checkins:', err);
      setError('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  }, [drillId, calculateStats]);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!drillId) return;

    const channel = supabase
      .channel(`clave100-checkins-${drillId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clave100_checkins',
          filter: `drill_id=eq.${drillId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newCheckin = payload.new as Clave100Checkin;
            
            // Fetch profile for the new checkin
            const { data: profile } = await supabase
              .from('profiles')
              .select('nickname, full_name')
              .eq('id', newCheckin.user_id)
              .single();

            const enrichedCheckin: Clave100Checkin = {
              ...newCheckin,
              status: newCheckin.status as 'OK' | 'HELP',
              nickname: profile?.nickname,
              full_name: profile?.full_name,
            };

            setCheckins(prev => {
              const updated = [enrichedCheckin, ...prev.filter(c => c.user_id !== newCheckin.user_id)];
              calculateStats(updated);
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedCheckin = payload.new as Clave100Checkin;
            setCheckins(prev => {
              const updated = prev.map(c => 
                c.id === updatedCheckin.id 
                  ? { ...c, ...updatedCheckin, status: updatedCheckin.status as 'OK' | 'HELP' }
                  : c
              );
              calculateStats(updated);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [drillId, calculateStats]);

  return {
    checkins,
    stats,
    loading,
    error,
    refresh: fetchCheckins,
  };
}
