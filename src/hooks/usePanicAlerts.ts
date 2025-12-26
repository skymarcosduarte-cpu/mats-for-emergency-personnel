// Real-time panic alerts hook for COMUNIDAD EX SOS
// Listens for panic events and help requests from other users
// Shows notifications even when app is in background (browser must be running)

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { playUrgentAlert, playSubtleAlert } from '@/lib/alertSound';
interface PanicEvent {
  id: string;
  user_id: string;
  panic_type: string;
  lat: number;
  lng: number;
  created_at: string;
  resolved: boolean;
  user_nickname?: string;
}

interface HelpRequest {
  id: string;
  user_id: string;
  kind: string;
  lat: number;
  lng: number;
  message: string | null;
  created_at: string;
  resolved: boolean;
}

const PANIC_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia Propia', emoji: '🚑' },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia Tercero', emoji: '🚑' },
  'PATRULLA': { label: 'Patrulla', emoji: '🚔' },
  'MECANICO': { label: 'Mecánico', emoji: '🔧' },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘' },
};

const HELP_KIND_LABELS: Record<string, { label: string; emoji: string }> = {
  'medical': { label: 'Ayuda Médica', emoji: '🏥' },
  'supplies': { label: 'Suministros', emoji: '📦' },
  'transport': { label: 'Transporte', emoji: '🚗' },
  'shelter': { label: 'Refugio', emoji: '🏠' },
  'other': { label: 'Ayuda General', emoji: '🤝' },
};

export function usePanicAlerts() {
  const { user } = useAuth();
  const [recentAlerts, setRecentAlerts] = useState<(PanicEvent | HelpRequest)[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifiedIds = useRef<Set<string>>(new Set());

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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

  // Play alert sound - use Web Audio API sounds
  const playPanicAlertSound = useCallback(() => {
    playUrgentAlert();
  }, []);

  const playHelpAlertSound = useCallback(() => {
    playSubtleAlert();
  }, []);

  // Format Google Maps link
  const getGoogleMapsLink = useCallback((lat: number, lng: number) => {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }, []);

  // Show browser notification (works in background)
  const showBrowserNotification = useCallback((
    title: string,
    body: string,
    tag: string,
    lat: number,
    lng: number
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

        const mapsLink = getGoogleMapsLink(lat, lng);

        notification.onclick = () => {
          window.focus();
          window.open(mapsLink, '_blank');
          notification.close();
        };

        return true;
      } catch (error) {
        console.error('Browser notification error:', error);
        return false;
      }
    }
    return false;
  }, [getGoogleMapsLink]);

  // Show notification for panic event
  const showPanicNotification = useCallback((event: PanicEvent) => {
    // Prevent duplicate notifications
    if (notifiedIds.current.has(event.id)) return;
    notifiedIds.current.add(event.id);

    const typeInfo = PANIC_TYPE_LABELS[event.panic_type] || { label: 'Emergencia', emoji: '🆘' };
    const mapsLink = getGoogleMapsLink(event.lat, event.lng);
    
    // Vibrate urgently
    vibrate([300, 100, 300, 100, 300]);
    
    // Play urgent alert sound (3-tone sequence + vibration)
    playPanicAlertSound();

    // Show browser notification (works in background)
    showBrowserNotification(
      `${typeInfo.emoji} ALERTA SOS`,
      `${typeInfo.label} - Un miembro necesita ayuda urgente`,
      `panic-${event.id}`,
      event.lat,
      event.lng
    );

    // Show toast if app is visible
    if (document.visibilityState === 'visible') {
      toast.error(
        `${typeInfo.emoji} ALERTA: ${typeInfo.label}`,
        {
          description: `Un miembro de la comunidad necesita ayuda urgente`,
          duration: 15000,
          action: {
            label: 'Ver ubicación',
            onClick: () => window.open(mapsLink, '_blank'),
          },
        }
      );
    }
  }, [vibrate, playPanicAlertSound, getGoogleMapsLink, showBrowserNotification]);

  // Show notification for help request
  const showHelpNotification = useCallback((request: HelpRequest) => {
    // Prevent duplicate notifications
    if (notifiedIds.current.has(request.id)) return;
    notifiedIds.current.add(request.id);

    const kindInfo = HELP_KIND_LABELS[request.kind] || { label: 'Ayuda', emoji: '🤝' };
    const mapsLink = getGoogleMapsLink(request.lat, request.lng);
    
    // Vibrate
    vibrate([200, 100, 200]);
    
    // Play help alert sound
    playHelpAlertSound();

    // Show browser notification (works in background)
    showBrowserNotification(
      `${kindInfo.emoji} Solicitud de Ayuda`,
      request.message || `${kindInfo.label} - Alguien necesita ayuda`,
      `help-${request.id}`,
      request.lat,
      request.lng
    );

    // Show toast if app is visible
    if (document.visibilityState === 'visible') {
      toast.warning(
        `${kindInfo.emoji} ${kindInfo.label}`,
        {
          description: request.message || 'Un miembro necesita ayuda',
          duration: 10000,
          action: {
            label: 'Ver ubicación',
            onClick: () => window.open(mapsLink, '_blank'),
          },
        }
      );
    }
  }, [vibrate, playHelpAlertSound, getGoogleMapsLink, showBrowserNotification]);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Subscribe to real-time panic events and help requests
  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up community alerts subscription...');

    const channel = supabase
      .channel('community-alerts')
      // Listen for panic events
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'panic_events',
        },
        (payload) => {
          const newEvent = payload.new as PanicEvent;
          console.log('New panic event received:', newEvent);

          // Don't notify for own events
          if (newEvent.user_id === user.id) return;

          showPanicNotification(newEvent);
          setRecentAlerts(prev => [newEvent, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
        }
      )
      // Listen for help requests
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'help_requests',
        },
        (payload) => {
          const newRequest = payload.new as HelpRequest;
          console.log('New help request received:', newRequest);

          // Don't notify for own requests
          if (newRequest.user_id === user.id) return;

          showHelpNotification(newRequest);
          setRecentAlerts(prev => [newRequest, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe((status) => {
        console.log('Community alerts subscription status:', status);
      });

    return () => {
      console.log('Cleaning up community alerts subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, showPanicNotification, showHelpNotification]);

  return {
    recentAlerts,
    unreadCount,
    clearAlerts,
  };
}
