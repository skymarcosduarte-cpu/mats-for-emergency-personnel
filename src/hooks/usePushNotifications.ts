// Push Notification Hook using Browser Notification API
// Works when browser is running (including background tabs) - no external services needed

import { useState, useEffect, useCallback } from 'react';
import type { USGSEarthquake } from '@/types';

interface PushNotificationState {
  permission: NotificationPermission | 'unsupported';
  isSupported: boolean;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSupported: false,
  });

  useEffect(() => {
    const isSupported = 'Notification' in window;
    setState({
      permission: isSupported ? Notification.permission : 'unsupported',
      isSupported,
    });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [state.isSupported]);

  const showEarthquakeNotification = useCallback((
    earthquake: USGSEarthquake,
    distanceKm: number
  ) => {
    if (!state.isSupported || Notification.permission !== 'granted') {
      return false;
    }

    const distanceMiles = Math.round(distanceKm / 1.60934);
    const magnitude = earthquake.properties.mag.toFixed(1);
    const place = earthquake.properties.place || 'Unknown location';

    try {
      const notification = new Notification('⚠️ Sismo Detectado', {
        body: `Magnitud ${magnitude} a ${distanceMiles} millas de ti\n${place}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `earthquake-${earthquake.id}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }, [state.isSupported]);

  const showGenericNotification = useCallback((
    title: string,
    body: string,
    tag?: string
  ) => {
    if (!state.isSupported || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: tag || 'mats-notification',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }, [state.isSupported]);

  return {
    ...state,
    requestPermission,
    showEarthquakeNotification,
    showGenericNotification,
  };
}
