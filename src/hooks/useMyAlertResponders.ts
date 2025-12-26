// Hook to listen for responders to user's own alerts
// Shows push notifications when a rescatista starts responding
// Also tracks responder location for real-time map display

import { useEffect, useCallback, useRef, useState } from 'react';
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
  lat: number | null;
  lng: number | null;
}

interface ResponderWithProfile extends ResponderEvent {
  nickname?: string;
}

export interface ActiveResponderInfo {
  id: string;
  request_id: string;
  user_id: string;
  nickname: string;
  lat: number | null;
  lng: number | null;
  started_at: string;
  arrived_at: string | null;
}

export function useMyAlertResponders() {
  const { user } = useAuth();
  const notifiedResponderIds = useRef<Set<string>>(new Set());
  const notifiedArrivalIds = useRef<Set<string>>(new Set());
  const [respondersToMyAlerts, setRespondersToMyAlerts] = useState<ActiveResponderInfo[]>([]);

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

  // Fetch responder's profile to get their nickname
  const fetchResponderProfile = useCallback(async (userId: string): Promise<string> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .maybeSingle();
      
      return data?.nickname || 'Un rescatista';
    } catch {
      return 'Un rescatista';
    }
  }, []);

  // Notify when a rescatista starts responding
  const notifyResponderStarted = useCallback(async (responder: ResponderEvent) => {
    // Prevent duplicate notifications
    if (notifiedResponderIds.current.has(responder.id)) return;
    notifiedResponderIds.current.add(responder.id);

    console.log('[useMyAlertResponders] Responder started:', responder);

    // Fetch responder's nickname
    const nickname = await fetchResponderProfile(responder.user_id);

    // Vibrate positively
    vibrate([100, 50, 100, 50, 200]);

    // Play positive sound
    try {
      playPositiveAlert();
    } catch {
      // Ignore sound errors
    }

    // Show browser notification with name
    showBrowserNotification(
      '🚨 ¡Ayuda en camino!',
      `${nickname} está respondiendo a tu alerta`,
      `responder-started-${responder.id}`
    );

    // Show toast if app is visible
    if (document.visibilityState === 'visible') {
      toast.success('🚨 ¡Ayuda en camino!', {
        description: `${nickname} está respondiendo a tu alerta`,
        duration: 8000,
      });
    }

    // Add to tracked responders
    setRespondersToMyAlerts(prev => {
      const exists = prev.find(r => r.id === responder.id);
      if (exists) return prev;
      return [...prev, {
        ...responder,
        nickname,
      }];
    });
  }, [vibrate, showBrowserNotification, fetchResponderProfile]);

  // Notify when a rescatista arrives
  const notifyResponderArrived = useCallback(async (responder: ResponderEvent) => {
    // Prevent duplicate notifications
    if (notifiedArrivalIds.current.has(responder.id)) return;
    notifiedArrivalIds.current.add(responder.id);

    console.log('[useMyAlertResponders] Responder arrived:', responder);

    // Fetch responder's nickname
    const nickname = await fetchResponderProfile(responder.user_id);

    // Strong positive vibration
    vibrate([150, 75, 150, 75, 300]);

    // Play positive sound
    try {
      playPositiveAlert();
    } catch {
      // Ignore sound errors
    }

    // Show browser notification with name
    showBrowserNotification(
      '✅ ¡El rescatista llegó!',
      `${nickname} ha llegado a tu ubicación`,
      `responder-arrived-${responder.id}`
    );

    // Show toast if app is visible
    if (document.visibilityState === 'visible') {
      toast.success('✅ ¡El rescatista llegó!', {
        description: `${nickname} ha llegado a tu ubicación`,
        duration: 10000,
      });
    }

    // Update responder status
    setRespondersToMyAlerts(prev => 
      prev.map(r => r.id === responder.id ? { ...r, arrived_at: responder.arrived_at, nickname } : r)
    );
  }, [vibrate, showBrowserNotification, fetchResponderProfile]);

  // Update responder location in real-time
  const updateResponderLocation = useCallback((responder: ResponderEvent) => {
    setRespondersToMyAlerts(prev => 
      prev.map(r => 
        r.id === responder.id 
          ? { ...r, lat: responder.lat, lng: responder.lng } 
          : r
      )
    );
  }, []);

  // Fetch existing responders on mount
  const fetchExistingResponders = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get user's active help requests
      const { data: myRequests } = await supabase
        .from('help_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('resolved', false);

      if (!myRequests || myRequests.length === 0) {
        setRespondersToMyAlerts([]);
        return;
      }

      const requestIds = myRequests.map(r => r.id);

      // Get all responders for these requests
      const { data: responders } = await supabase
        .from('help_request_responders')
        .select('id, request_id, user_id, lat, lng, started_at, arrived_at')
        .in('request_id', requestIds);

      if (!responders || responders.length === 0) {
        setRespondersToMyAlerts([]);
        return;
      }

      // Fetch nicknames for all responders
      const respondersWithProfiles = await Promise.all(
        responders
          .filter(r => r.user_id !== user.id)
          .map(async (r) => {
            const nickname = await fetchResponderProfile(r.user_id);
            return { ...r, nickname };
          })
      );

      setRespondersToMyAlerts(respondersWithProfiles);
    } catch (error) {
      console.error('[useMyAlertResponders] Error fetching responders:', error);
    }
  }, [user?.id, fetchResponderProfile]);

  // Fetch on mount
  useEffect(() => {
    fetchExistingResponders();
  }, [fetchExistingResponders]);

  // Subscribe to responders on user's alerts
  useEffect(() => {
    if (!user?.id) return;

    console.log('[useMyAlertResponders] Setting up subscription for user:', user.id);

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
            await notifyResponderStarted(responder);
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

          // Check if this responder is for one of user's requests
          const { data: request } = await supabase
            .from('help_requests')
            .select('user_id')
            .eq('id', responder.request_id)
            .maybeSingle();

          if (request?.user_id !== user.id || responder.user_id === user.id) return;

          // Check if arrived_at was just set (responder arrived)
          if (responder.arrived_at && !oldResponder.arrived_at) {
            console.log('[useMyAlertResponders] Responder arrived:', responder);
            await notifyResponderArrived(responder);
          } 
          // Otherwise, update location if it changed
          else if (responder.lat !== oldResponder.lat || responder.lng !== oldResponder.lng) {
            console.log('[useMyAlertResponders] Responder location updated:', responder);
            updateResponderLocation(responder);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'help_request_responders',
        },
        (payload) => {
          const deleted = payload.old as ResponderEvent;
          console.log('[useMyAlertResponders] Responder removed:', deleted);
          setRespondersToMyAlerts(prev => prev.filter(r => r.id !== deleted.id));
        }
      )
      .subscribe((status) => {
        console.log('[useMyAlertResponders] Subscription status:', status);
      });

    return () => {
      console.log('[useMyAlertResponders] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, notifyResponderStarted, notifyResponderArrived, updateResponderLocation]);

  return { respondersToMyAlerts };
}
