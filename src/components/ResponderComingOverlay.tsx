// Visual overlay that appears when a rescuer starts responding to user's alert
// Shows an animated, prominent notification that someone is coming to help

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartHandshake, MapPin, X, Navigation, Phone, MessageCircle, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ResponderInfo {
  nickname: string;
  transport_mode: string | null;
  eta_minutes: number | null;
  distance_km: number;
  has_ambulance?: boolean;
  has_rescue_unit?: boolean;
  can_provide_medical_assistance?: boolean;
}

interface ResponderComingOverlayProps {
  isVisible: boolean;
  responder: ResponderInfo | null;
  onDismiss: () => void;
  onViewOnMap?: () => void;
  onNavigate?: () => void;
}

const TRANSPORT_LABELS: Record<string, { label: string; emoji: string }> = {
  walking: { label: 'Caminando', emoji: '🚶' },
  bicycle: { label: 'En bicicleta', emoji: '🚴' },
  motorcycle: { label: 'En moto', emoji: '🏍️' },
  car: { label: 'En auto', emoji: '🚗' },
  public_transport: { label: 'Transporte público', emoji: '🚌' },
  ambulance: { label: 'En ambulancia', emoji: '🚑' },
  rescue_unit: { label: 'En unidad de rescate', emoji: '🚒' },
};

export const ResponderComingOverlay: React.FC<ResponderComingOverlayProps> = ({
  isVisible,
  responder,
  onDismiss,
  onViewOnMap,
  onNavigate,
}) => {
  const [showPulse, setShowPulse] = useState(true);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onDismiss]);

  // Pulse animation control
  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setShowPulse(prev => !prev);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  if (!responder) return null;

  const transportInfo = responder.transport_mode 
    ? TRANSPORT_LABELS[responder.transport_mode] 
    : null;

  // Determine special responder type for styling
  const isAmbulance = responder.has_ambulance ?? false;
  const isRescueUnit = responder.has_rescue_unit ?? false;
  const isMedical = responder.can_provide_medical_assistance ?? false;
  const isSpecialUnit = isAmbulance || isRescueUnit;

  // Dynamic gradient based on responder type
  const gradientClass = isAmbulance 
    ? 'from-red-500 via-red-600 to-red-700'
    : isRescueUnit
      ? 'from-orange-500 via-orange-600 to-orange-700'
      : isMedical
        ? 'from-blue-500 via-blue-600 to-blue-700'
        : 'from-green-500 via-emerald-500 to-teal-600';

  // Dynamic title based on responder type
  const titleText = isAmbulance 
    ? '¡Ambulancia en camino!'
    : isRescueUnit
      ? '¡Unidad de rescate en camino!'
      : isMedical
        ? '¡Asistencia médica en camino!'
        : '¡Ayuda en camino!';

  // Dynamic icon based on responder type
  const IconEmoji = isAmbulance ? '🚑' : isRescueUnit ? '🚒' : isMedical ? '👨‍⚕️' : null;

  const formatEta = (minutes: number | null) => {
    if (!minutes) return 'Calculando...';
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `~${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `~${hours}h ${mins}m`;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 25,
              delay: 0.1 
            }}
            className={`relative w-full max-w-sm bg-gradient-to-br ${gradientClass} rounded-3xl shadow-2xl overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated background rings */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div
                animate={{ 
                  scale: showPulse ? [1, 1.5, 1] : 1,
                  opacity: showPulse ? [0.3, 0, 0.3] : 0.3
                }}
                transition={{ duration: isSpecialUnit ? 1.5 : 2, repeat: Infinity, ease: "easeOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-4 border-white/30"
              />
              <motion.div
                animate={{ 
                  scale: showPulse ? [1, 1.8, 1] : 1,
                  opacity: showPulse ? [0.2, 0, 0.2] : 0.2
                }}
                transition={{ duration: isSpecialUnit ? 1.8 : 2.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border-4 border-white/20"
              />
            </div>

            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Content */}
            <div className="relative p-6 pt-8 text-center text-white">
              {/* Animated icon */}
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: isSpecialUnit ? [0, -5, 5, 0] : [0, 5, -5, 0]
                }}
                transition={{ duration: isSpecialUnit ? 1.5 : 2, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4"
              >
                {IconEmoji ? (
                  <span className="text-4xl">{IconEmoji}</span>
                ) : (
                  <HeartHandshake className="w-10 h-10 text-white" />
                )}
              </motion.div>

              {/* Title */}
              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`font-bold mb-2 ${isSpecialUnit ? 'text-2xl uppercase tracking-wide' : 'text-2xl'}`}
              >
                {titleText}
              </motion.h2>

              {/* Responder name */}
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg text-white/90 mb-4"
              >
                <span className="font-semibold">{responder.nickname}</span> está respondiendo
              </motion.p>

              {/* Transport and ETA info */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-4 mb-6"
              >
                {transportInfo && (
                  <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                    <span className="text-xl">{transportInfo.emoji}</span>
                    <span className="text-sm font-medium">{transportInfo.label}</span>
                  </div>
                )}
                
                {responder.eta_minutes !== null && (
                  <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                    <Timer className="w-4 h-4" />
                    <span className="text-sm font-medium">{formatEta(responder.eta_minutes)}</span>
                  </div>
                )}
              </motion.div>

              {/* Distance */}
              {responder.distance_km > 0 && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-white/80 text-sm mb-6"
                >
                  A {responder.distance_km.toFixed(1)} km de distancia
                </motion.p>
              )}

              {/* Actions */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex gap-3"
              >
                {onViewOnMap && (
                  <Button
                    onClick={() => {
                      onViewOnMap();
                      onDismiss();
                    }}
                    className="flex-1 bg-white text-emerald-600 hover:bg-white/90 font-semibold"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Ver en mapa
                  </Button>
                )}
                <Button
                  onClick={onDismiss}
                  variant="ghost"
                  className="flex-1 text-white hover:bg-white/20 font-semibold border border-white/30"
                >
                  Entendido
                </Button>
              </motion.div>

              {/* Reassuring message */}
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-4 text-white/70 text-xs"
              >
                Mantén la calma. La ayuda está en camino.
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
