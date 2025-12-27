// Hook to fetch quake checkins for a specific earthquake
// Used by rescatistas to see intensity reports mapped by location

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QuakeCheckin {
  id: string;
  user_id: string;
  usgs_event_id: string;
  intensity: number;
  damage_report: string;
  lat: number;
  lng: number;
  created_at: string;
}

export interface QuakeCheckinStats {
  total: number;
  avgIntensity: number;
  byStatus: {
    OK: number;
    UNSURE: number;
    DAMAGE: number;
  };
  byIntensity: Record<number, number>;
}

export function useQuakeCheckins(eventId: string | null) {
  const [checkins, setCheckins] = useState<QuakeCheckin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<QuakeCheckinStats | null>(null);

  const fetchCheckins = useCallback(async () => {
    if (!eventId) {
      setCheckins([]);
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('quake_checkins')
        .select('*')
        .eq('usgs_event_id', eventId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const checkinData = data || [];
      setCheckins(checkinData);

      // Calculate stats
      if (checkinData.length > 0) {
        const totalIntensity = checkinData.reduce((sum, c) => sum + c.intensity, 0);
        const byStatus = {
          OK: checkinData.filter(c => c.damage_report === 'OK').length,
          UNSURE: checkinData.filter(c => c.damage_report === 'UNSURE').length,
          DAMAGE: checkinData.filter(c => c.damage_report === 'DAMAGE').length,
        };
        const byIntensity: Record<number, number> = {};
        checkinData.forEach(c => {
          byIntensity[c.intensity] = (byIntensity[c.intensity] || 0) + 1;
        });

        setStats({
          total: checkinData.length,
          avgIntensity: totalIntensity / checkinData.length,
          byStatus,
          byIntensity,
        });
      } else {
        setStats(null);
      }
    } catch (err) {
      console.error('Error fetching quake checkins:', err);
      setError('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`quake-checkins-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quake_checkins',
          filter: `usgs_event_id=eq.${eventId}`,
        },
        (payload) => {
          const newCheckin = payload.new as QuakeCheckin;
          setCheckins(prev => [newCheckin, ...prev]);
          // Recalculate stats
          setStats(prev => {
            if (!prev) {
              return {
                total: 1,
                avgIntensity: newCheckin.intensity,
                byStatus: {
                  OK: newCheckin.damage_report === 'OK' ? 1 : 0,
                  UNSURE: newCheckin.damage_report === 'UNSURE' ? 1 : 0,
                  DAMAGE: newCheckin.damage_report === 'DAMAGE' ? 1 : 0,
                },
                byIntensity: { [newCheckin.intensity]: 1 },
              };
            }
            const newTotal = prev.total + 1;
            const newAvg = ((prev.avgIntensity * prev.total) + newCheckin.intensity) / newTotal;
            return {
              total: newTotal,
              avgIntensity: newAvg,
              byStatus: {
                ...prev.byStatus,
                [newCheckin.damage_report as keyof typeof prev.byStatus]: 
                  prev.byStatus[newCheckin.damage_report as keyof typeof prev.byStatus] + 1,
              },
              byIntensity: {
                ...prev.byIntensity,
                [newCheckin.intensity]: (prev.byIntensity[newCheckin.intensity] || 0) + 1,
              },
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return {
    checkins,
    stats,
    loading,
    error,
    refresh: fetchCheckins,
  };
}
