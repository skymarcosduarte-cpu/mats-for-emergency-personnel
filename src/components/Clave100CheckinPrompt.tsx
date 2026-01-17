// Clave 100 Check-in Prompt Component
// Shows during Clave 100 drills or real emergencies to confirm user safety

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, X, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { toast } from 'sonner';

interface Clave100CheckinPromptProps {
  drillId: string | null;
  isDrill: boolean;
  onClose: () => void;
}

export const Clave100CheckinPrompt: React.FC<Clave100CheckinPromptProps> = ({
  drillId,
  isDrill,
  onClose,
}) => {
  const { user } = useAuth();
  const { position } = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);

  // Check if user already responded
  useEffect(() => {
    if (!user?.id || !drillId) return;

    const checkExisting = async () => {
      const { data } = await supabase
        .from('clave100_checkins')
        .select('id')
        .eq('drill_id', drillId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setHasResponded(true);
      }
    };

    checkExisting();
  }, [user?.id, drillId]);

  const handleCheckin = async (status: 'OK' | 'HELP') => {
    if (!user?.id || !drillId) {
      toast.error('Error: No se pudo verificar tu sesión');
      return;
    }

    if (!position) {
      toast.error('Se requiere tu ubicación para reportar tu estado');
      return;
    }

    setSubmitting(true);

    try {
      // Check if already responded
      const { data: existing } = await supabase
        .from('clave100_checkins')
        .select('id')
        .eq('drill_id', drillId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('clave100_checkins')
          .update({
            status,
            lat: position.lat,
            lng: position.lng,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('clave100_checkins')
          .insert({
            user_id: user.id,
            drill_id: drillId,
            status,
            lat: position.lat,
            lng: position.lng,
          });

        if (error) throw error;
      }

      setHasResponded(true);
      
      if (status === 'OK') {
        toast.success('¡Gracias! Tu estado ha sido registrado');
      } else {
        toast.warning('Tu solicitud de ayuda ha sido enviada a la comunidad');
      }

      // Close after a brief delay
      setTimeout(onClose, 1500);
    } catch (error) {
      console.error('Error submitting checkin:', error);
      toast.error('Error al enviar tu estado');
    } finally {
      setSubmitting(false);
    }
  };

  if (hasResponded) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-[9998] pointer-events-auto"
      >
        <div className={`rounded-xl shadow-2xl border-2 overflow-hidden ${
          isDrill 
            ? 'bg-gradient-to-br from-amber-500/95 to-amber-600/95 border-amber-300' 
            : 'bg-gradient-to-br from-destructive/95 to-red-600/95 border-red-300'
        }`}>
          {/* Animated header bar */}
          <div className="relative h-1 overflow-hidden">
            <motion.div
              className={`absolute inset-0 ${isDrill ? 'bg-amber-300' : 'bg-red-300'}`}
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>

          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Bell className="w-5 h-5 text-white" />
                </motion.div>
                <span className="font-bold text-white text-lg">
                  {isDrill ? '🔔 SIMULACRO' : '🚨 CLAVE 100'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:text-white hover:bg-white/20 h-8 w-8"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Question */}
            <p className="text-white text-center text-lg font-medium mb-4">
              ¿Cómo te encuentras?
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1 h-14 bg-safe hover:bg-safe/90 text-white border-0 shadow-lg"
                onClick={() => handleCheckin('OK')}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    <span className="font-bold">Estoy Bien</span>
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                className="flex-1 h-14 bg-destructive hover:bg-destructive/90 text-white border-0 shadow-lg"
                onClick={() => handleCheckin('HELP')}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    <span className="font-bold">Necesito Ayuda</span>
                  </>
                )}
              </Button>
            </div>

            {/* Info text */}
            <p className="text-white/80 text-xs text-center mt-3">
              Tu estado será visible en el mapa para la comunidad
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Clave100CheckinPrompt;
