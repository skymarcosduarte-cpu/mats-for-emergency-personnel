import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { playPositiveAlert, playCancelledAlert, playUrgentAlert } from '@/lib/alertSound';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  listing_id: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const lastNotificationIdRef = useRef<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const typedData = (data || []) as Notification[];
      setNotifications(typedData);
      setUnreadCount(typedData.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Show toast for new notifications based on type
  const showContactNotification = useCallback((notification: Notification) => {
    // Responder coming notification - positive sound!
    if (notification.type === 'responder_coming') {
      playPositiveAlert();
      
      toast.success(notification.title, {
        description: notification.message || 'Alguien está en camino a ayudarte',
        duration: 10000,
        icon: '🚨',
      });

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    }
    // Responder arrived notification - positive sound!
    else if (notification.type === 'responder_arrived') {
      playPositiveAlert();
      
      toast.success(notification.title, {
        description: notification.message || 'El rescatista llegó a tu ubicación',
        duration: 10000,
        icon: '✅',
      });

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    }
    // Alert cancelled notification - cancelled sound
    else if (notification.type === 'alert_cancelled') {
      playCancelledAlert();
      
      toast.warning(notification.title, {
        description: notification.message || 'La alerta ha sido cancelada',
        duration: 8000,
        icon: '⚠️',
      });

      if ('vibrate' in navigator) {
        navigator.vibrate([100, 100, 200]);
      }
    }
    // Responder contact notification
    else if (notification.type === 'responder_contact') {
      playPositiveAlert();
      
      toast.success(notification.title, {
        description: notification.message || 'Un rescatista intenta contactarte',
        duration: 10000,
        icon: notification.title.includes('📞') ? '📞' : '💬',
      });

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    } 
    // Road report notification
    else if (notification.type === 'road_report') {
      playPositiveAlert();
      
      toast.warning(notification.title, {
        description: notification.message || 'Nuevo reporte de incidente',
        duration: 8000,
        icon: '🚧',
      });

      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    }
    // MAXIMUM PRIORITY: Earthquake damage report notification
    else if (notification.type === 'quake_damage_priority' || notification.type === 'quake_damage') {
      // Play urgent alert sound with persistent vibration
      playUrgentAlert();
      
      toast.error(notification.title, {
        description: notification.message || 'Se reportaron daños por sismo',
        duration: 30000, // Keep visible for 30 seconds
        icon: '🚨',
      });

      // Strong SOS-like vibration pattern
      if ('vibrate' in navigator) {
        navigator.vibrate([
          500, 200, 500, 200, 500,  // S
          200,
          1000, 200, 1000, 200, 1000,  // O
          200,
          500, 200, 500, 200, 500  // S
        ]);
      }
    }
    // Trip arrived with delay - user is OK
    else if (notification.type === 'trip_arrived_delayed') {
      playPositiveAlert();
      
      toast.success(notification.title, {
        description: notification.message || 'El usuario llegó con retraso pero está bien',
        duration: 10000,
        icon: '✅',
      });

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }
    // Trip confirmed safe - still on the way
    else if (notification.type === 'trip_confirmed_safe') {
      playPositiveAlert();
      
      toast.success(notification.title, {
        description: notification.message || 'El usuario confirmó que está bien',
        duration: 8000,
        icon: '👍',
      });

      if ('vibrate' in navigator) {
        navigator.vibrate([150, 100, 150]);
      }
    }
    // Trip overdue - warning
    else if (notification.type === 'trip_overdue') {
      playUrgentAlert();
      
      toast.warning(notification.title, {
        description: notification.message || 'Un viaje está retrasado',
        duration: 15000,
        icon: '⚠️',
      });

      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }
    }
    // Trip arrived - normal
    else if (notification.type === 'trip_arrived') {
      playPositiveAlert();
      
      toast.success(notification.title, {
        description: notification.message || 'El usuario llegó a su destino',
        duration: 6000,
        icon: '✅',
      });
    }
    // Trip ETA updated
    else if (notification.type === 'trip_eta_updated') {
      toast.info(notification.title, {
        description: notification.message || 'ETA actualizado',
        duration: 6000,
        icon: '🕐',
      });
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Avoid duplicate notifications
          if (lastNotificationIdRef.current !== newNotification.id) {
            lastNotificationIdRef.current = newNotification.id;
            
            // Show toast for contact notifications
            showContactNotification(newNotification);
          }
          
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, showContactNotification]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const deleteAllRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const readNotificationIds = notifications.filter(n => n.read).map(n => n.id);
      if (readNotificationIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('read', true);

      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => !n.read));
    } catch (error) {
      console.error('Error deleting read notifications:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    refetch: fetchNotifications,
  };
}

// Helper function to create a notification
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  listingId?: string;
}) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message || null,
        listing_id: params.listingId || null,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}
