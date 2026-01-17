// Drill Alert Banner Component
// Shows when a Clave 100 drill is active with the same alert sound
// ONLY shows to users who were active within the last 24 hours

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Volume2, VolumeX, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { playClave100Alert, stopClave100Alert } from '@/lib/alertSound';
import { DrillStatsPanel } from './DrillStatsPanel';
import { useAuth } from '@/hooks/useAuth';

interface DrillAlertBannerProps {
  onDismiss?: () => void;
  onOpenCommunityChat?: (drillId: string) => void;
  onActiveDrillChange?: (drillId: string | null) => void;
}

interface ActiveDrill {
  id: string;
  scheduled_at: string;
  status: string;
}

export const DrillAlertBanner: React.FC<DrillAlertBannerProps> = ({ onDismiss, onOpenCommunityChat, onActiveDrillChange }) => {
  const { user, profile } = useAuth();
  const [activeDrill, setActiveDrill] = useState<ActiveDrill | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [userWasActive, setUserWasActive] = useState<boolean | null>(null); // null = checking, true/false = result
  const hasPlayedSound = useRef(false);
  const drillIdRef = useRef<string | null>(null);
  const hasAutoOpenedChat = useRef(false);

  // Check if user was active in the last 24 hours before showing drill alerts
  useEffect(() => {
    const checkUserActivity = async () => {
      if (!user?.id) {
        setUserWasActive(false);
        return;
      }
      
      // Check if user has opted out of drills
      if (profile?.opt_out_drills) {
        console.log('[DrillAlertBanner] User has opted out of drills');
        setUserWasActive(false);
        return;
      }

      // Check if user has a location update in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('user_locations')
        .select('user_id')
        .eq('user_id', user.id)
        .gte('updated_at', twentyFourHoursAgo)
        .maybeSingle();
      
      if (error) {
        console.error('[DrillAlertBanner] Error checking user activity:', error);
        setUserWasActive(false);
        return;
      }
      
      const wasActive = !!data;
      console.log('[DrillAlertBanner] User active in last 24h:', wasActive);
      setUserWasActive(wasActive);
    };
    
    checkUserActivity();
  }, [user?.id, profile?.opt_out_drills]);

  useEffect(() => {
    // Only check for drills if user was active
    if (userWasActive !== true) {
      return;
    }
    
    // Check for active drills
    const checkActiveDrill = async () => {
      // Simply check for any drill with 'active' status
      const { data, error } = await supabase
        .from('clave100_drills')
        .select('*')
        .eq('status', 'active')
        .is('chat_closed_at', null)
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[DrillAlertBanner] Error fetching drill:', error);
        return;
      }

      console.log('[DrillAlertBanner] Drill check result:', data);

      if (data) {
        const drill = data as ActiveDrill;
        
        console.log('[DrillAlertBanner] Active drill found:', drill.id, 'status:', drill.status);
        
        // Only trigger sound and chat for new drills
        if (drill.id !== drillIdRef.current) {
          console.log('[DrillAlertBanner] New drill detected, resetting refs');
          drillIdRef.current = drill.id;
          hasPlayedSound.current = false;
          hasAutoOpenedChat.current = false;
        }
        
        setActiveDrill(drill);
        setDismissed(false);
        
        // Notify parent of active drill
        console.log('[DrillAlertBanner] Notifying parent of active drill');
        onActiveDrillChange?.(drill.id);
        
        // Auto-open community chat for this drill
        if (!hasAutoOpenedChat.current && onOpenCommunityChat) {
          hasAutoOpenedChat.current = true;
          console.log('[DrillAlertBanner] Auto-opening community chat in 1.5s');
          // Small delay to ensure banner is visible first
          setTimeout(() => {
            onOpenCommunityChat(drill.id);
          }, 1500);
        }
      } else {
        console.log('[DrillAlertBanner] No active drill found');
        setActiveDrill(null);
        drillIdRef.current = null;
        onActiveDrillChange?.(null);
      }
    };

    checkActiveDrill();

    // Subscribe to drill updates
    const channel = supabase
      .channel('drill-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clave100_drills'
        },
        () => {
          checkActiveDrill();
        }
      )
      .subscribe();

    // Check more frequently (every 10 seconds) for responsive drill detection
    const interval = setInterval(checkActiveDrill, 10000);
    
    // Also check when app becomes visible (user returns to tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[DrillAlertBanner] App visible, checking for drills');
        checkActiveDrill();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userWasActive, onActiveDrillChange, onOpenCommunityChat]);
  
  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      // Stop sound on unmount
      stopClave100Alert();
    };
  }, []);

  // Play Clave 100 alert sound when drill becomes active
  useEffect(() => {
    if (activeDrill && !dismissed && !hasPlayedSound.current && !soundMuted) {
      hasPlayedSound.current = true;
      setSoundPlaying(true);
      
      // Play the Clave 100 alert sound
      playClave100Alert().catch(err => {
        console.warn('[DrillAlertBanner] Failed to play alert:', err);
      });

      // Stop after 10 seconds for drill (shorter than real emergency)
      const stopTimeout = setTimeout(() => {
        stopClave100Alert();
        setSoundPlaying(false);
      }, 10000);

      return () => {
        clearTimeout(stopTimeout);
      };
    }
  }, [activeDrill, dismissed, soundMuted]);

  const handleDismiss = () => {
    stopClave100Alert();
    setSoundPlaying(false);
    setDismissed(true);
    onDismiss?.();
  };

  const handleOpenChat = () => {
    if (activeDrill && onOpenCommunityChat) {
      onOpenCommunityChat(activeDrill.id);
    }
  };

  const toggleSound = () => {
    if (soundPlaying) {
      stopClave100Alert();
      setSoundPlaying(false);
      setSoundMuted(true);
    } else if (!soundMuted) {
      setSoundPlaying(true);
      playClave100Alert().catch(console.warn);
      // Stop after 10 seconds
      setTimeout(() => {
        stopClave100Alert();
        setSoundPlaying(false);
      }, 10000);
    }
  };

  // Don't show if user wasn't active, or no active drill, or dismissed
  if (userWasActive !== true || !activeDrill || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed left-0 right-0 top-[var(--app-header-height)] z-[9999] pointer-events-auto"
      >
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white shadow-lg">
          {/* Animated stripes */}
          <div className="absolute inset-0 overflow-hidden opacity-20">
            <motion.div
              className="absolute inset-0"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)',
              }}
              animate={{
                x: [0, 28],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>

          <div className="relative px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                >
                  <Bell className="w-6 h-6 text-white" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="font-bold text-lg"
                    >
                      🔔 SIMULACRO CLAVE 100
                    </motion.span>
                    {soundPlaying && (
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="text-xs bg-white/20 px-2 py-0.5 rounded-full"
                      >
                        🔊 Sonido activo
                      </motion.span>
                    )}
                  </div>
                  <p className="text-sm text-amber-100 font-medium">
                    ⚠️ ESTO ES UN SIMULACRO, NO ES UNA EMERGENCIA REAL ⚠️
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 flex-shrink-0"
                  onClick={handleOpenChat}
                  title="Chat Comunidad"
                >
                  <MessageCircle className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 flex-shrink-0"
                  onClick={toggleSound}
                  title={soundPlaying ? 'Silenciar' : 'Reproducir sonido'}
                >
                  {soundPlaying ? (
                    <Volume2 className="w-5 h-5" />
                  ) : (
                    <VolumeX className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 flex-shrink-0"
                  onClick={handleDismiss}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Real-time Statistics Panel */}
          <DrillStatsPanel
            drillId={activeDrill.id}
            drillStartTime={activeDrill.scheduled_at}
            isExpanded={statsExpanded}
            onToggleExpand={() => setStatsExpanded(!statsExpanded)}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DrillAlertBanner;
