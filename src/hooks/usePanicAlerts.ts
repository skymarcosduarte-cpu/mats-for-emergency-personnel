// Real-time panic alerts hook for COMUNIDAD EX SOS
// Listens for panic events from other users and shows in-app notifications

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

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

const PANIC_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia Propia', emoji: '🚑' },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia Tercero', emoji: '🚑' },
  'PATRULLA': { label: 'Patrulla', emoji: '🚔' },
  'MECANICO': { label: 'Mecánico', emoji: '🔧' },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘' },
};

export function usePanicAlerts() {
  const { user } = useAuth();
  const [recentAlerts, setRecentAlerts] = useState<PanicEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Play alert sound
  const playAlertSound = useCallback(() => {
    try {
      const audio = new Audio('/alert-sound.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Ignore autoplay errors
      });
    } catch {
      // Ignore errors
    }
  }, []);

  // Format Google Maps link
  const getGoogleMapsLink = useCallback((lat: number, lng: number) => {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }, []);

  // Show notification for panic event
  const showPanicNotification = useCallback((event: PanicEvent) => {
    const typeInfo = PANIC_TYPE_LABELS[event.panic_type] || { label: 'Emergencia', emoji: '🆘' };
    const mapsLink = getGoogleMapsLink(event.lat, event.lng);
    
    // Vibrate urgently
    vibrate([300, 100, 300, 100, 300]);
    
    // Try to play sound
    playAlertSound();

    // Show toast notification
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

    // Also try browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(`${typeInfo.emoji} ALERTA SOS`, {
          body: `${typeInfo.label} - Un miembro necesita ayuda`,
          icon: '/favicon.png',
          tag: `panic-${event.id}`,
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          window.open(mapsLink, '_blank');
          notification.close();
        };
      } catch {
        // Ignore notification errors
      }
    }
  }, [vibrate, playAlertSound, getGoogleMapsLink]);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Subscribe to real-time panic events
  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up panic alerts subscription...');

    const channel = supabase
      .channel('panic-alerts')
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
          if (newEvent.user_id === user.id) {
            console.log('Ignoring own panic event');
            return;
          }

          // Show notification
          showPanicNotification(newEvent);

          // Add to recent alerts
          setRecentAlerts(prev => [newEvent, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe((status) => {
        console.log('Panic alerts subscription status:', status);
      });

    return () => {
      console.log('Cleaning up panic alerts subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, showPanicNotification]);

  return {
    recentAlerts,
    unreadCount,
    clearAlerts,
  };
}
