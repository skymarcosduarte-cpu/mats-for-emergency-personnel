// Escucha en tiempo real los estados enviados por cualquier usuario.
// Se muestran SIEMPRE, haya o no modo desastre activo.
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useStatusNotifications() {
  const seenRef = useRef<Set<string>>(new Set());
  const readyRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      readyRef.current = true;
    }, 3000);

    const channel = supabase
      .channel('status_messages_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'status_messages' },
        async (payload) => {
          if (!readyRef.current) return;

          const row = payload.new as {
            id: string;
            user_id: string;
            status: string;
            message: string | null;
          };

          if (seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);

          const { data: auth } = await supabase.auth.getUser();
          if (auth.user?.id === row.user_id) return;

          const { data: profile } = await supabase
            .from('profiles_public')
            .select('nickname')
            .eq('user_id', row.user_id)
            .maybeSingle();

          const who = profile?.nickname ?? 'Un usuario';
          const detail = row.message?.trim() ? row.message.trim() : undefined;

          if (row.status === 'NEED_HELP') {
            toast.error(`🆘 ${who} necesita ayuda`, {
              description: detail,
              duration: 15000,
            });
          } else if (row.status === 'OK') {
            toast.success(`✅ ${who} reportó que está bien`, {
              description: detail,
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
