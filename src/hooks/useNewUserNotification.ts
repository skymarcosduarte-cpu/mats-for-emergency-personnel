import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

export function useNewUserNotification() {
  const notifiedUsersRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    // Mark initial load as done after a short delay to avoid toasts on app load
    const timer = setTimeout(() => {
      initialLoadDoneRef.current = true;
    }, 3000);

    const channel = supabase
      .channel('new_user_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles_public' },
        async (payload) => {
          // Only show notification after initial load
          if (!initialLoadDoneRef.current) return;
          
          const newUserId = payload.new.user_id as string;
          const nickname = payload.new.nickname as string | null;
          
          // Skip if already notified
          if (notifiedUsersRef.current.has(newUserId)) return;
          notifiedUsersRef.current.add(newUserId);
          
          // Get current user to avoid self-notification
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id === newUserId) return;
          
          // Show welcome toast
          toast({
            title: "¡Nuevo miembro!",
            description: nickname 
              ? `${nickname} se unió a la comunidad` 
              : "Un nuevo usuario se unió a la comunidad",
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
