// Background Connection Manager for MATS
// Maintains realtime connections when app is in background

import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface BackgroundConnectionState {
  isConnected: boolean;
  isBackground: boolean;
  lastPing: Date | null;
  reconnectAttempts: number;
}

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000; // 5 seconds

/**
 * Hook to maintain background connections
 * - Keeps realtime subscriptions alive
 * - Reconnects when coming back to foreground
 * - Sends heartbeat to keep connection alive
 */
export function useBackgroundConnection() {
  const { user } = useAuth();
  const [state, setState] = useState<BackgroundConnectionState>({
    isConnected: true,
    isBackground: false,
    lastPing: null,
    reconnectAttempts: 0,
  });

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Send heartbeat to keep connection alive
  const sendHeartbeat = useCallback(async () => {
    if (!user) return;

    try {
      // Update user location timestamp to keep connection alive
      await supabase
        .from('user_locations')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      setState(prev => ({
        ...prev,
        lastPing: new Date(),
        isConnected: true,
        reconnectAttempts: 0,
      }));
    } catch (error) {
      console.warn('[BackgroundConnection] Heartbeat failed:', error);
      setState(prev => ({ ...prev, isConnected: false }));
    }
  }, [user]);

  // Reconnect to realtime
  const reconnect = useCallback(async () => {
    if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[BackgroundConnection] Max reconnect attempts reached');
      return;
    }

    try {
      // Remove old channel if exists
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

      // Create new presence channel to maintain connection
      channelRef.current = supabase
        .channel('background-presence')
        .on('presence', { event: 'sync' }, () => {
          setState(prev => ({ ...prev, isConnected: true }));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setState(prev => ({ 
              ...prev, 
              isConnected: true, 
              reconnectAttempts: 0 
            }));
            
            // Track presence
            if (user) {
              await channelRef.current?.track({
                user_id: user.id,
                online_at: new Date().toISOString(),
              });
            }
          }
        });

    } catch (error) {
      console.error('[BackgroundConnection] Reconnect failed:', error);
      setState(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1,
      }));

      // Schedule retry
      reconnectRef.current = setTimeout(reconnect, RECONNECT_DELAY);
    }
  }, [user, state.reconnectAttempts]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isBackground = document.visibilityState === 'hidden';
      setState(prev => ({ ...prev, isBackground }));

      if (!isBackground) {
        // Coming back to foreground - reconnect
        console.log('[BackgroundConnection] Returning to foreground');
        reconnect();
        sendHeartbeat();
      }
    };

    // Handle online/offline events
    const handleOnline = () => {
      console.log('[BackgroundConnection] Back online');
      reconnect();
    };

    const handleOffline = () => {
      console.log('[BackgroundConnection] Went offline');
      setState(prev => ({ ...prev, isConnected: false }));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reconnect, sendHeartbeat]);

  // Start heartbeat and initial connection
  useEffect(() => {
    if (!user) return;

    // Initial connection
    reconnect();

    // Start heartbeat
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, reconnect, sendHeartbeat]);

  return state;
}
