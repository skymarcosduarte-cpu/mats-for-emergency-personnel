// Drill Alert Banner Component
// Shows when a Clave 100 drill is active

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface DrillAlertBannerProps {
  onDismiss?: () => void;
}

interface ActiveDrill {
  id: string;
  scheduled_at: string;
  status: string;
}

export const DrillAlertBanner: React.FC<DrillAlertBannerProps> = ({ onDismiss }) => {
  const [activeDrill, setActiveDrill] = useState<ActiveDrill | null>(null);
  const [dismissed, setDismissed] = useState(false);

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
        setActiveDrill(data as ActiveDrill);
        setDismissed(false);
      } else {
        setActiveDrill(null);
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
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
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
                  </div>
                  <p className="text-sm text-amber-100 font-medium">
                    ⚠️ ESTO ES UN SIMULACRO, NO ES UNA EMERGENCIA REAL ⚠️
                  </p>
                </div>
              </div>

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
      </motion.div>
    </AnimatePresence>
  );
};

export default DrillAlertBanner;
