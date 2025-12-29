// Hook to trigger native Clave 100 notifications
// This is a simple wrapper that can be imported where needed

import { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const CLAVE_100_CHANNEL = 'clave_100_alerts';

/**
 * Triggers a native CLAVE 100 notification
 * Works on both native (Capacitor) and web platforms
 */
export async function triggerClave100Notification(
  senderName: string,
  message: string,
  senderId?: string
): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  
  console.log('[Clave100Notification] 🚨 Triggering notification, isNative:', isNative);
  
  // Maximum haptic feedback for native
  if (isNative) {
    try {
      // Heavy repeated vibration pattern for maximum attention
      await Haptics.notification({ type: NotificationType.Error });
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await new Promise(r => setTimeout(r, 150));
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await new Promise(r => setTimeout(r, 150));
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await new Promise(r => setTimeout(r, 150));
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await new Promise(r => setTimeout(r, 150));
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {
      console.warn('[Clave100Notification] Haptics failed:', e);
    }
  }

  const title = '🚨 CLAVE 100 - EMERGENCIA MÁXIMA 🚨';
  const cleanMessage = message
    .replace(/🚨 CLAVE 100 - EMERGENCIA MÁXIMA 🚨\n\n/, '')
    .trim();
  const body = `${senderName}: ${cleanMessage.substring(0, 150)}${cleanMessage.length > 150 ? '...' : ''}`;

  if (!isNative) {
    // Web fallback
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'clave100-' + Date.now(),
          requireInteraction: true,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        console.log('[Clave100Notification] Web notification shown');
      } catch (error) {
        console.error('[Clave100Notification] Web notification failed:', error);
      }
    }
    return;
  }

  // Native notification via Capacitor
  try {
    const notification: LocalNotificationSchema = {
      id: Date.now(),
      title,
      body,
      channelId: CLAVE_100_CHANNEL,
      smallIcon: 'ic_stat_icon',
      largeIcon: 'ic_launcher',
      iconColor: '#ff0000',
      ongoing: true, // Keep visible until user interacts
      autoCancel: false,
      extra: { type: 'clave100', senderId, senderName },
    };

    await LocalNotifications.schedule({ notifications: [notification] });
    console.log('[Clave100Notification] 🚨 Native notification scheduled');
  } catch (error) {
    console.error('[Clave100Notification] Failed to schedule notification:', error);
  }
}

/**
 * Hook version for React components
 */
export function useClave100Notification() {
  const trigger = useCallback(async (
    senderName: string,
    message: string,
    senderId?: string
  ) => {
    await triggerClave100Notification(senderName, message, senderId);
  }, []);

  return { triggerNotification: trigger };
}
