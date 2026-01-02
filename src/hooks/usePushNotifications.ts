// Push Notification Hook using Browser Notification API
// Works when browser is running (including background tabs) - no external services needed

import { useState, useEffect, useCallback } from 'react';
import type { USGSEarthquake } from '@/types';
import type { TropicalCycloneAlert, FireHotspot } from '@/hooks/useMexicoAlerts';
import type { GDACSAlert } from '@/hooks/useGDACSAlerts';

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

  // Special notification for major SSN earthquakes (≥6.0) - alerts everyone in Mexico
  const showMajorSSNQuakeNotification = useCallback((
    earthquake: USGSEarthquake
  ) => {
    if (!state.isSupported || Notification.permission !== 'granted') {
      return false;
    }

    const magnitude = earthquake.properties.mag.toFixed(1);
    const place = earthquake.properties.place || 'México';
    const depth = earthquake.properties.depth || earthquake.geometry.coordinates[2] || 0;

    try {
      const notification = new Notification(`🚨 SISMO FUERTE M${magnitude}`, {
        body: `${place}\nProfundidad: ${Math.round(depth)} km\n⚠️ Mantente alerta`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `major-ssn-quake-${earthquake.id}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return true;
    } catch (error) {
      console.error('Error showing major SSN notification:', error);
      return false;
    }
  }, [state.isSupported]);

  const showCycloneNotification = useCallback((
    cyclone: TropicalCycloneAlert
  ) => {
    if (!state.isSupported || Notification.permission !== 'granted') {
      return false;
    }

    const typeLabels = {
      hurricane: 'Huracán',
      tropical_storm: 'Tormenta Tropical',
      tropical_depression: 'Depresión Tropical',
      disturbance: 'Perturbación',
    };

    const typeLabel = typeLabels[cyclone.type];
    const distance = cyclone.distanceKm ? `a ${Math.round(cyclone.distanceKm)} km` : '';
    const category = cyclone.category ? ` Cat. ${cyclone.category}` : '';

    try {
      const notification = new Notification(`🌀 ${typeLabel}${category}: ${cyclone.name}`, {
        body: `${cyclone.headline}\n${distance}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `cyclone-${cyclone.id}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        if (cyclone.link) {
          window.open(cyclone.link, '_blank');
        }
        notification.close();
      };

      return true;
    } catch (error) {
      console.error('Error showing cyclone notification:', error);
      return false;
    }
  }, [state.isSupported]);

  const showFireNotification = useCallback((
    fires: FireHotspot[],
    nearestDistance: number
  ) => {
    if (!state.isSupported || Notification.permission !== 'granted') {
      return false;
    }

    const fireCount = fires.length;
    const distanceText = `a ${Math.round(nearestDistance)} km`;

    try {
      const notification = new Notification('🔥 Incendio Forestal Detectado', {
        body: `${fireCount} punto${fireCount > 1 ? 's' : ''} de calor ${distanceText} de tu ubicación`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'fire-alert',
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return true;
    } catch (error) {
      console.error('Error showing fire notification:', error);
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

  // Show notification for red-level international alerts
  const showRedAlertNotification = useCallback((
    alert: GDACSAlert
  ) => {
    if (!state.isSupported || Notification.permission !== 'granted') {
      return false;
    }

    // Map category to emoji
    const categoryEmojis: Record<string, string> = {
      earthquake: '🌍',
      cyclone: '🌀',
      flood: '🌊',
      volcano: '🌋',
      wildfire: '🔥',
      drought: '☀️',
      weather: '⛈️',
      security: '🛡️',
      humanitarian: '🆘',
      other: '⚠️',
    };

    const emoji = categoryEmojis[alert.category] || '⚠️';
    const sourceLabel = alert.source || 'Internacional';

    try {
      const notification = new Notification(`🔴 ALERTA ROJA - ${sourceLabel}`, {
        body: `${emoji} ${alert.title}\n${alert.country ? `📍 ${alert.country}` : ''}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `red-alert-${alert.id}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        if (alert.link) {
          window.open(alert.link, '_blank');
        }
        notification.close();
      };

      return true;
    } catch (error) {
      console.error('Error showing red alert notification:', error);
      return false;
    }
  }, [state.isSupported]);

  return {
    ...state,
    requestPermission,
    showEarthquakeNotification,
    showMajorSSNQuakeNotification,
    showCycloneNotification,
    showFireNotification,
    showGenericNotification,
    showRedAlertNotification,
  };
}
