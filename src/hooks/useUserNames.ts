import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserProfileCache {
  [userId: string]: {
    nickname: string;
    full_name: string;
  };
}

export function useUserNames(userIds: string[]) {
  const [profiles, setProfiles] = useState<UserProfileCache>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    // Filter out already cached profiles
    const missingIds = uniqueIds.filter(id => !(id in profiles));
    if (missingIds.length === 0) return;

    const fetchProfiles = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nickname, full_name')
          .in('id', missingIds);

        if (error) {
          console.error('[useUserNames] Error fetching profiles:', error);
          return;
        }

        if (data) {
          const newProfiles: UserProfileCache = {};
          data.forEach(profile => {
            newProfiles[profile.id] = {
              nickname: profile.nickname || 'Usuario',
              full_name: profile.full_name || '',
            };
          });
          setProfiles(prev => ({ ...prev, ...newProfiles }));
        }
      } catch (err) {
        console.error('[useUserNames] Exception:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [userIds.join(',')]);

  const getName = (userId: string): string => {
    return profiles[userId]?.nickname || 'Cargando...';
  };

  const getFullName = (userId: string): string => {
    return profiles[userId]?.full_name || '';
  };

  const getProfile = (userId: string) => {
    return profiles[userId] || { nickname: 'Cargando...', full_name: '' };
  };

  return { profiles, getName, getFullName, getProfile, loading };
}
