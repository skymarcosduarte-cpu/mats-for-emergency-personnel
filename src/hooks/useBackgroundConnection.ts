// Background Connection Manager for MATS
// Maintains realtime connections when app is in background
// Works with useAppLifecycle for native app pause/resume

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
const RECONNECT_DELAY = 3000; // 3 seconds (faster reconnect)
const AGGRESSIVE_RECONNECT_DELAY = 1000; // 1 second for first attempt

/**
 * Hook to maintain background connections
 * - Keeps realtime subscriptions alive
 * - Reconnects when coming back to foreground
 * - Sends heartbeat to keep connection alive
 * - Works with native app lifecycle events
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
  const isReconnectingRef = useRef(false);

  // Send heartbeat to keep connection alive
  const sendHeartbeat = useCallback(async () => {
    if (!user) return;

    try {
      // Update user location timestamp to keep connection alive
      await supabase
        .from('user_locations')
        .update({ 
          updated_at: new Date().toISOString(),
          is_online: true 
        })
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

  // Reconnect to realtime with improved retry logic
  const reconnect = useCallback(async (isUrgent = false) => {
    if (isReconnectingRef.current) {
      console.log('[BackgroundConnection] Already reconnecting, skipping...');
      return;
    }
    
    if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[BackgroundConnection] Max reconnect attempts reached, resetting...');
      setState(prev => ({ ...prev, reconnectAttempts: 0 }));
      return;
    }

    isReconnectingRef.current = true;

    try {
      console.log('[BackgroundConnection] Reconnecting...', isUrgent ? '(urgent)' : '');
      
      // Remove old channel if exists
      if (channelRef.current) {
        try {
          await supabase.removeChannel(channelRef.current);
        } catch (e) {
          // Ignore errors when removing old channel
        }
      }

      // Create new presence channel to maintain connection
      channelRef.current = supabase
        .channel('background-presence-' + Date.now()) // Unique name to avoid conflicts
        .on('presence', { event: 'sync' }, () => {
          setState(prev => ({ ...prev, isConnected: true }));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[BackgroundConnection] Realtime reconnected');
            setState(prev => ({ 
              ...prev, 
              isConnected: true, 
              reconnectAttempts: 0 
            }));
            
            // Track presence
            if (user) {
              try {
                await channelRef.current?.track({
                  user_id: user.id,
                  online_at: new Date().toISOString(),
                });
              } catch (e) {
                console.warn('[BackgroundConnection] Presence track failed:', e);
              }
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[BackgroundConnection] Channel error:', status);
            setState(prev => ({ ...prev, isConnected: false }));
          }
        });

      // Also send heartbeat on reconnect
      await sendHeartbeat();

    } catch (error) {
      console.error('[BackgroundConnection] Reconnect failed:', error);
      setState(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1,
        isConnected: false,
      }));

      // Schedule retry with progressive backoff
      const delay = isUrgent ? AGGRESSIVE_RECONNECT_DELAY : 
                    Math.min(RECONNECT_DELAY * (state.reconnectAttempts + 1), 30000);
      reconnectRef.current = setTimeout(() => reconnect(false), delay);
    } finally {
      isReconnectingRef.current = false;
    }
  }, [user, state.reconnectAttempts, sendHeartbeat]);

  // Handle visibility change (web/PWA)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isBackground = document.visibilityState === 'hidden';
      setState(prev => ({ ...prev, isBackground }));

      if (!isBackground) {
        // Coming back to foreground - reconnect urgently
        console.log('[BackgroundConnection] Visibility restored, reconnecting...');
        reconnect(true);
      }
    };

    // Handle online/offline events
    const handleOnline = () => {
      console.log('[BackgroundConnection] Network back online');
      reconnect(true);
    };

    const handleOffline = () => {
      console.log('[BackgroundConnection] Network went offline');
      setState(prev => ({ ...prev, isConnected: false }));
    };

    // Handle page show (for bfcache restoration)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('[BackgroundConnection] Page restored from bfcache');
        reconnect(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [reconnect]);

  // Start heartbeat and initial connection
  useEffect(() => {
    if (!user) return;

    // Initial connection
    reconnect(false);

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
