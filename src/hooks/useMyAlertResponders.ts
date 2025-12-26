// Hook to listen for responders to user's own alerts
// Shows push notifications when a rescatista starts responding

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { playPositiveAlert } from '@/lib/alertSound';

interface ResponderEvent {
  id: string;
  request_id: string;
  user_id: string;
  started_at: string;
  arrived_at: string | null;
}

export function useMyAlertResponders() {
  const { user } = useAuth();
  const notifiedResponderIds = useRef<Set<string>>(new Set());
  const notifiedArrivalIds = useRef<Set<string>>(new Set());

  // Vibrate helper
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore errors
      }
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((
    title: string,
    body: string,
    tag: string
  ) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag,
          requireInteraction: true,
          silent: false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return true;
      } catch (error) {
        console.error('Browser notification error:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Notify when a rescatista starts responding
  const notifyResponderStarted = useCallback((responder: ResponderEvent) => {
    // Prevent duplicate notifications
    if (notifiedResponderIds.current.has(responder.id)) return;
    notifiedResponderIds.current.add(responder.id);

    console.log('[useMyAlertResponders] Responder started:', responder);

    // Vibrate positively
    vibrate([100, 50, 100, 50, 200]);

    // Play positive sound
    try {
      playPositiveAlert();
    } catch {
      // Ignore sound errors
    }

    // Show browser notification
    showBrowserNotification(
      '🚨 ¡Ayuda en camino!',
      'Un rescatista está respondiendo a tu alerta',
      `responder-started-${responder.id}`
    );

    // Show toast if app is visible
    if (document.visibilityState === 'visible') {
      toast.success('🚨 ¡Ayuda en camino!', {
        description: 'Un rescatista está respondiendo a tu alerta',
        duration: 8000,
      });
    }
  }, [vibrate, showBrowserNotification]);

  // Notify when a rescatista arrives
  const notifyResponderArrived = useCallback((responder: ResponderEvent) => {
    // Prevent duplicate notifications
    if (notifiedArrivalIds.current.has(responder.id)) return;
    notifiedArrivalIds.current.add(responder.id);

    console.log('[useMyAlertResponders] Responder arrived:', responder);

    // Strong positive vibration
    vibrate([150, 75, 150, 75, 300]);

    // Play positive sound
    try {
      playPositiveAlert();
    } catch {
      // Ignore sound errors
    }

    // Show browser notification
    showBrowserNotification(
      '✅ ¡El rescatista llegó!',
      'Un rescatista ha llegado a tu ubicación',
      `responder-arrived-${responder.id}`
    );

    // Show toast if app is visible
    if (document.visibilityState === 'visible') {
      toast.success('✅ ¡El rescatista llegó!', {
        description: 'Ayuda ha llegado a tu ubicación',
        duration: 10000,
      });
    }
  }, [vibrate, showBrowserNotification]);

  // Subscribe to responders on user's alerts
  useEffect(() => {
    if (!user?.id) return;

    console.log('[useMyAlertResponders] Setting up subscription for user:', user.id);

    // First, get user's active help requests
    const fetchMyActiveRequests = async () => {
      const { data: myRequests } = await supabase
        .from('help_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('resolved', false);

      return myRequests?.map(r => r.id) || [];
    };

    // Subscribe to responder changes
    const channel = supabase
      .channel(`my-alert-responders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'help_request_responders',
        },
        async (payload) => {
          const responder = payload.new as ResponderEvent;
          console.log('[useMyAlertResponders] New responder event:', responder);

          // Check if this responder is for one of user's requests
          const { data: request } = await supabase
            .from('help_requests')
            .select('user_id')
            .eq('id', responder.request_id)
            .maybeSingle();

          if (request?.user_id === user.id && responder.user_id !== user.id) {
            notifyResponderStarted(responder);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'help_request_responders',
        },
        async (payload) => {
          const responder = payload.new as ResponderEvent;
          const oldResponder = payload.old as ResponderEvent;

          // Check if arrived_at was just set (responder arrived)
          if (responder.arrived_at && !oldResponder.arrived_at) {
            console.log('[useMyAlertResponders] Responder arrived:', responder);

            // Check if this responder is for one of user's requests
            const { data: request } = await supabase
              .from('help_requests')
              .select('user_id')
              .eq('id', responder.request_id)
              .maybeSingle();

            if (request?.user_id === user.id && responder.user_id !== user.id) {
              notifyResponderArrived(responder);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[useMyAlertResponders] Subscription status:', status);
      });

    return () => {
      console.log('[useMyAlertResponders] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, notifyResponderStarted, notifyResponderArrived]);

  return null; // This hook is just for side effects
}
