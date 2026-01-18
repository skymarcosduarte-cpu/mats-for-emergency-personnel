// App Lifecycle Hook for MATS
// Handles native app pause/resume events via Capacitor
// Ensures session persistence and connection recovery when app returns to foreground

import { useEffect, useCallback, useRef, useState } from 'react';
import { App, AppState } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';
import { isNative } from '@/lib/capacitor';

interface AppLifecycleState {
  isActive: boolean;
  lastResumeAt: Date | null;
  resumeCount: number;
}

/**
 * Hook to handle native app lifecycle events (pause/resume)
 * 
 * This is critical for Android where:
 * - Opening another app pauses MATS
 * - Screen off pauses MATS
 * - System may kill background processes
 * 
 * On resume, we need to:
 * 1. Refresh the auth session
 * 2. Reconnect realtime subscriptions
 * 3. Update user's online status
 */
export function useAppLifecycle() {
  const [state, setState] = useState<AppLifecycleState>({
    isActive: true,
    lastResumeAt: null,
    resumeCount: 0,
  });
  
  const lastPauseRef = useRef<Date | null>(null);
  const isRecoveringRef = useRef(false);

  // Recover session and connections after resume
  const handleResume = useCallback(async () => {
    if (isRecoveringRef.current) return;
    isRecoveringRef.current = true;
    
    console.log('[AppLifecycle] App resumed, recovering session...');
    
    try {
      // 1. Refresh the auth session to ensure it's still valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[AppLifecycle] Session refresh error:', sessionError);
      } else if (session) {
        console.log('[AppLifecycle] Session still valid for:', session.user.email);
        
        // 2. Force token refresh if token is close to expiring (within 5 minutes)
        const expiresAt = session.expires_at || 0;
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;
        
        if (timeUntilExpiry < 300) { // 5 minutes
          console.log('[AppLifecycle] Token expiring soon, refreshing...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('[AppLifecycle] Token refresh error:', refreshError);
          } else {
            console.log('[AppLifecycle] Token refreshed successfully');
          }
        }
        
        // 3. Update user's online status
        await supabase
          .from('user_locations')
          .update({ 
            is_online: true,
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', session.user.id);
          
        console.log('[AppLifecycle] User online status updated');
      } else {
        console.log('[AppLifecycle] No active session found');
      }
      
      setState(prev => ({
        isActive: true,
        lastResumeAt: new Date(),
        resumeCount: prev.resumeCount + 1,
      }));
      
    } catch (error) {
      console.error('[AppLifecycle] Resume recovery error:', error);
    } finally {
      isRecoveringRef.current = false;
    }
  }, []);

  // Handle pause - mark user as potentially offline
  const handlePause = useCallback(() => {
    console.log('[AppLifecycle] App paused');
    lastPauseRef.current = new Date();
    setState(prev => ({ ...prev, isActive: false }));
    
    // Don't immediately mark offline - wait for actual disconnect
    // The background connection hook handles this
  }, []);

  // Handle app state changes from Capacitor
  useEffect(() => {
    if (!isNative()) {
      // On web, use visibility API
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          handleResume();
        } else {
          handlePause();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    // On native, use Capacitor App API
    let listener: { remove: () => void } | null = null;
    
    const setupListener = async () => {
      listener = await App.addListener('appStateChange', (state: AppState) => {
        console.log('[AppLifecycle] Native state change:', state.isActive);
        if (state.isActive) {
          handleResume();
        } else {
          handlePause();
        }
      });
    };
    
    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [handleResume, handlePause]);

  // Also handle browser focus/blur for PWA
  useEffect(() => {
    const handleFocus = () => {
      console.log('[AppLifecycle] Window focused');
      handleResume();
    };
    
    const handleBlur = () => {
      console.log('[AppLifecycle] Window blurred');
      // Don't pause on blur, only on visibility hidden
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleResume]);

  // Handle page show (for bfcache restoration)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('[AppLifecycle] Page restored from bfcache');
        handleResume();
      }
    };
    
    window.addEventListener('pageshow', handlePageShow);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [handleResume]);

  return state;
}
