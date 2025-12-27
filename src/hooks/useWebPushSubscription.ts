// Hook to manage Web Push subscription registration
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
}

export function useWebPushSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
  });

  // Check if push is supported
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'unsupported',
    }));
  }, []);

  // Register service worker and check existing subscription
  useEffect(() => {
    if (!state.isSupported || !user?.id) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setState(prev => ({ ...prev, isSubscribed: !!subscription }));
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    };

    // Register service worker
    navigator.serviceWorker.register('/sw.js')
      .then(() => {
        console.log('[Push] Service worker registered');
        checkSubscription();
      })
      .catch(err => {
        console.error('[Push] Service worker registration failed:', err);
      });
  }, [state.isSupported, user?.id]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !user?.id) {
      console.warn('Push not supported or user not logged in');
      return false;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription (without VAPID for simple push)
        // Note: For production with VAPID, you'd need to add applicationServerKey
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // For now, using a placeholder - proper VAPID would be needed for full web push
        });
      }

      if (!subscription) {
        console.error('Failed to create push subscription');
        return false;
      }

      const subscriptionJson = subscription.toJSON();
      
      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys?.p256dh || '',
          auth: subscriptionJson.keys?.auth || '',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error saving subscription:', error);
        return false;
      }

      setState(prev => ({ ...prev, isSubscribed: true }));
      console.log('[Push] Subscription saved successfully');
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return false;
    }
  }, [state.isSupported, user?.id]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);

      setState(prev => ({ ...prev, isSubscribed: false }));
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      return false;
    }
  }, [user?.id]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
