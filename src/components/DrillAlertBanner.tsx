// Drill Alert Banner Component
// Shows when a Clave 100 drill is active with the same alert sound

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Volume2, VolumeX, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { playClave100Alert, stopClave100Alert } from '@/lib/alertSound';

interface DrillAlertBannerProps {
  onDismiss?: () => void;
  onOpenCommunityChat?: (drillId: string) => void;
}

interface ActiveDrill {
  id: string;
  scheduled_at: string;
  status: string;
}

export const DrillAlertBanner: React.FC<DrillAlertBannerProps> = ({ onDismiss, onOpenCommunityChat }) => {
  const [activeDrill, setActiveDrill] = useState<ActiveDrill | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const hasPlayedSound = useRef(false);
  const drillIdRef = useRef<string | null>(null);
  const hasAutoOpenedChat = useRef(false);

  useEffect(() => {
    // Check for active drills
    const checkActiveDrill = async () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000);

      const { data } = await supabase
        .from('clave100_drills')
        .select('*')
        .eq('status', 'active')
        .or(`scheduled_at.gte.${fiveMinutesAgo.toISOString()},scheduled_at.lte.${fiveMinutesAhead.toISOString()}`)
        .maybeSingle();

      if (data) {
        const drill = data as ActiveDrill;
        
        // Only trigger sound and chat for new drills
        if (drill.id !== drillIdRef.current) {
          drillIdRef.current = drill.id;
          hasPlayedSound.current = false;
          hasAutoOpenedChat.current = false;
        }
        
        setActiveDrill(drill);
        setDismissed(false);
        
        // Auto-open community chat for this drill
        if (!hasAutoOpenedChat.current && onOpenCommunityChat) {
          hasAutoOpenedChat.current = true;
          // Small delay to ensure banner is visible first
          setTimeout(() => {
            onOpenCommunityChat(drill.id);
          }, 1500);
        }
      } else {
        setActiveDrill(null);
        drillIdRef.current = null;
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

    // Check periodically
    const interval = setInterval(checkActiveDrill, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
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

  if (!activeDrill || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[9999] pointer-events-auto"
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DrillAlertBanner;
