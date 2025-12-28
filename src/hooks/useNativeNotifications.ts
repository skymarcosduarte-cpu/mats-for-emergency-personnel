// Native Notifications Hook for MATS
// Uses Capacitor Local Notifications for critical alerts

import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

interface NativeNotificationsState {
  isNative: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
}

// Notification channel IDs for Android
const CHANNELS = {
  EMERGENCY: 'emergency_alerts',
  SEISMIC: 'seismic_alerts',
  MESSAGES: 'messages',
  GENERAL: 'general',
};

/**
 * Hook for native local notifications
 * Uses Capacitor LocalNotifications for alerts that work even when app is in background
 */
export function useNativeNotifications() {
  const isNative = Capacitor.isNativePlatform();
  
  const [state, setState] = useState<NativeNotificationsState>({
    isNative,
    permissionStatus: 'unknown',
  });

  // Check permissions
  const checkPermissions = useCallback(async () => {
    if (!isNative) {
      setState(prev => ({ ...prev, permissionStatus: 'granted' })); // Web uses Notification API
      return 'granted';
    }

    try {
      const status = await LocalNotifications.checkPermissions();
      setState(prev => ({ ...prev, permissionStatus: status.display as any }));
      return status.display;
    } catch (error) {
      console.error('[NativeNotifications] Permission check failed:', error);
      return 'unknown';
    }
  }, [isNative]);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    if (!isNative) {
      // Web fallback
      const result = await Notification.requestPermission();
      setState(prev => ({ ...prev, permissionStatus: result as any }));
      return result === 'granted';
    }

    try {
      const status = await LocalNotifications.requestPermissions();
      setState(prev => ({ ...prev, permissionStatus: status.display as any }));
      return status.display === 'granted';
    } catch (error) {
      console.error('[NativeNotifications] Permission request failed:', error);
      return false;
    }
  }, [isNative]);

  // Create notification channels (Android only)
  const setupChannels = useCallback(async () => {
    if (!isNative || Capacitor.getPlatform() !== 'android') return;

    try {
      await LocalNotifications.createChannel({
        id: CHANNELS.EMERGENCY,
        name: 'Alertas de Emergencia',
        description: 'Alertas críticas de SOS y pánico',
        importance: 5, // MAX
        visibility: 1, // PUBLIC
        vibration: true,
        sound: 'alert.wav',
        lights: true,
        lightColor: '#ef4444',
      });

      await LocalNotifications.createChannel({
        id: CHANNELS.SEISMIC,
        name: 'Alertas Sísmicas',
        description: 'Notificaciones de sismos cercanos',
        importance: 5, // MAX
        visibility: 1, // PUBLIC
        vibration: true,
        sound: 'seismic.wav',
        lights: true,
        lightColor: '#f59e0b',
      });

      await LocalNotifications.createChannel({
        id: CHANNELS.MESSAGES,
        name: 'Mensajes',
        description: 'Mensajes internos de la comunidad',
        importance: 3, // DEFAULT
        visibility: 0, // PRIVATE
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: CHANNELS.GENERAL,
        name: 'General',
        description: 'Notificaciones generales',
        importance: 3, // DEFAULT
        visibility: 0, // PRIVATE
        vibration: true,
      });

      console.log('[NativeNotifications] Channels created');
    } catch (error) {
      console.error('[NativeNotifications] Failed to create channels:', error);
    }
  }, [isNative]);

  // Show emergency notification (SOS, Panic, Ambulance)
  const showEmergencyNotification = useCallback(async (
    title: string,
    body: string,
    data?: Record<string, unknown>
  ) => {
    // Strong haptic feedback
    if (isNative) {
      try {
        await Haptics.notification({ type: NotificationType.Warning });
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {
        console.warn('[NativeNotifications] Haptics failed:', e);
      }
    }

    if (!isNative) {
      // Web fallback
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          tag: 'emergency',
          requireInteraction: true,
        });
      }
      return;
    }

    try {
      const notification: LocalNotificationSchema = {
        id: Date.now(),
        title,
        body,
        channelId: CHANNELS.EMERGENCY,
        smallIcon: 'ic_stat_icon',
        largeIcon: 'ic_launcher',
        iconColor: '#ef4444',
        ongoing: false,
        autoCancel: true,
        extra: data,
      };

      await LocalNotifications.schedule({ notifications: [notification] });
      console.log('[NativeNotifications] Emergency notification shown');
    } catch (error) {
      console.error('[NativeNotifications] Failed to show emergency notification:', error);
    }
  }, [isNative]);

  // Show seismic alert notification
  const showSeismicNotification = useCallback(async (
    magnitude: number,
    location: string,
    distanceKm: number
  ) => {
    // Strong haptic feedback for seismic alerts
    if (isNative) {
      try {
        await Haptics.notification({ type: NotificationType.Error });
        await Haptics.impact({ style: ImpactStyle.Heavy });
        // Triple vibration pattern
        await new Promise(r => setTimeout(r, 300));
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await new Promise(r => setTimeout(r, 300));
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch (e) {
        console.warn('[NativeNotifications] Haptics failed:', e);
      }
    }

    const title = `⚠️ Sismo M${magnitude.toFixed(1)}`;
    const body = `${location} - ${distanceKm.toFixed(0)} km de distancia`;

    if (!isNative) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          tag: 'seismic',
          requireInteraction: true,
        });
      }
      return;
    }

    try {
      const notification: LocalNotificationSchema = {
        id: Date.now(),
        title,
        body,
        channelId: CHANNELS.SEISMIC,
        smallIcon: 'ic_stat_icon',
        largeIcon: 'ic_launcher',
        iconColor: '#f59e0b',
        ongoing: false,
        autoCancel: true,
        extra: { type: 'seismic', magnitude, location, distanceKm },
      };

      await LocalNotifications.schedule({ notifications: [notification] });
      console.log('[NativeNotifications] Seismic notification shown');
    } catch (error) {
      console.error('[NativeNotifications] Failed to show seismic notification:', error);
    }
  }, [isNative]);

  // Show message notification
  const showMessageNotification = useCallback(async (
    senderName: string,
    message: string,
    senderId?: string
  ) => {
    // Light haptic feedback for messages
    if (isNative) {
      try {
        await Haptics.notification({ type: NotificationType.Success });
      } catch (e) {
        console.warn('[NativeNotifications] Haptics failed:', e);
      }
    }

    const title = `Mensaje de ${senderName}`;
    const body = message.length > 100 ? message.substring(0, 100) + '...' : message;

    if (!isNative) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          tag: `message-${senderId}`,
        });
      }
      return;
    }

    try {
      const notification: LocalNotificationSchema = {
        id: Date.now(),
        title,
        body,
        channelId: CHANNELS.MESSAGES,
        smallIcon: 'ic_stat_icon',
        largeIcon: 'ic_launcher',
        iconColor: '#3b82f6',
        ongoing: false,
        autoCancel: true,
        group: 'messages',
        extra: { type: 'message', senderId, senderName },
      };

      await LocalNotifications.schedule({ notifications: [notification] });
      console.log('[NativeNotifications] Message notification shown');
    } catch (error) {
      console.error('[NativeNotifications] Failed to show message notification:', error);
    }
  }, [isNative]);

  // Cancel all notifications
  const cancelAll = useCallback(async () => {
    if (!isNative) return;

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id })),
        });
      }
    } catch (error) {
      console.error('[NativeNotifications] Failed to cancel notifications:', error);
    }
  }, [isNative]);

  // Setup on mount
  useEffect(() => {
    checkPermissions();
    setupChannels();

    // Listen for notification actions
    if (isNative) {
      LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        console.log('[NativeNotifications] Action performed:', event);
        // Handle notification tap - navigate to appropriate screen
        const extra = event.notification.extra;
        if (extra?.type === 'seismic') {
          window.location.href = '/alerts?tab=seismic';
        } else if (extra?.type === 'message') {
          window.location.href = '/community';
        } else if (extra?.type === 'emergency') {
          window.location.href = '/map';
        }
      });
    }

    return () => {
      if (isNative) {
        LocalNotifications.removeAllListeners();
      }
    };
  }, [isNative, checkPermissions, setupChannels]);

  return {
    ...state,
    checkPermissions,
    requestPermissions,
    showEmergencyNotification,
    showSeismicNotification,
    showMessageNotification,
    cancelAll,
  };
}
