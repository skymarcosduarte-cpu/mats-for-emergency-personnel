// Hook to manage Web Push subscription registration
// Uses Supabase Realtime broadcast as fallback since VAPID keys aren't configured
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { playMessageNotification } from '@/lib/alertSound';

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
}

// Show browser notification
function showNotification(title: string, body: string, data?: Record<string, unknown>) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'mats-message',
      data,
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}

export function useWebPushSubscription() {
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
  });

  // Check if notifications are supported
  useEffect(() => {
    const isSupported = 'Notification' in window;
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'unsupported',
    }));
  }, []);

  // Subscribe to realtime broadcast channel for push-like notifications
  useEffect(() => {
    if (!user?.id || !state.isSupported) return;

    // Create a unique channel for this user to receive message notifications
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        console.log('[Push] Received broadcast notification:', payload);
        const { senderName, messagePreview } = payload.payload as { senderName: string; messagePreview: string };
        
        // Play the notification sound if not muted
        const muted = localStorage.getItem('chat_notifications_muted') === 'true';
        if (!muted) {
          playMessageNotification();
        }
        
        // Show notification if tab is not focused
        if (document.hidden && Notification.permission === 'granted') {
          showNotification(`💬 Mensaje de ${senderName}`, messagePreview || 'Tienes un nuevo mensaje');
        } else if (document.hidden) {
          // Fallback to toast if notifications not granted
          toast.info(`💬 ${senderName}`, { description: messagePreview || 'Nuevo mensaje' });
        }
      })
      .subscribe((status) => {
        console.log('[Push] Broadcast channel status:', status);
        if (status === 'SUBSCRIBED') {
          setState(prev => ({ ...prev, isSubscribed: true }));
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, state.isSupported]);

  // Subscribe to notifications (request permission)
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      
      if (permission === 'granted') {
        console.log('[Push] Notification permission granted');
        return true;
      }
      
      console.log('[Push] Notification permission denied');
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [state.isSupported]);

  // Unsubscribe from notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setState(prev => ({ ...prev, isSubscribed: false }));
    return true;
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
