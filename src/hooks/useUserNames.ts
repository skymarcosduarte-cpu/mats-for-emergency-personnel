import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserNameCache {
  [userId: string]: string;
}

export function useUserNames(userIds: string[]) {
  const [names, setNames] = useState<UserNameCache>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    // Filter out already cached names
    const missingIds = uniqueIds.filter(id => !(id in names));
    if (missingIds.length === 0) return;

    const fetchNames = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nickname, full_name')
          .in('id', missingIds);

        if (error) {
          console.error('[useUserNames] Error fetching names:', error);
          return;
        }

        if (data) {
          const newNames: UserNameCache = {};
          data.forEach(profile => {
            newNames[profile.id] = profile.nickname || profile.full_name || 'Usuario';
          });
          setNames(prev => ({ ...prev, ...newNames }));
        }
      } catch (err) {
        console.error('[useUserNames] Exception:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNames();
  }, [userIds.join(',')]);

  const getName = (userId: string): string => {
    return names[userId] || 'Cargando...';
  };

  return { names, getName, loading };
}
