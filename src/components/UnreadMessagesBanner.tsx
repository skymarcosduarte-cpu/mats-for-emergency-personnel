import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UnreadMessagesBannerProps {
  unreadCount: number;
  senderName?: string | null;
  onOpen: () => void;
  onDismiss?: () => void;
}

export const UnreadMessagesBanner: React.FC<UnreadMessagesBannerProps> = ({
  unreadCount,
  senderName,
  onOpen,
  onDismiss
}) => {
  if (unreadCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-4 right-4 z-[200] md:left-auto md:right-4 md:max-w-sm"
      >
        <div 
          onClick={onOpen}
          className="bg-primary text-primary-foreground rounded-2xl shadow-2xl shadow-primary/30 p-4 cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden"
        >
          {/* Animated background pulse */}
          <div className="absolute inset-0 bg-white/10 animate-pulse" />
          
          <div className="relative flex items-center gap-3">
            {/* Icon with badge */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-6 h-6" />
              </div>
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-white text-primary text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base">
                {unreadCount === 1 ? 'Nuevo mensaje' : `${unreadCount} mensajes nuevos`}
              </p>
              {senderName && (
                <p className="text-sm opacity-90 truncate">
                  de {senderName}
                </p>
              )}
              <p className="text-xs opacity-75 mt-0.5">
                Toca para ver
              </p>
            </div>

            {/* Dismiss button */}
            {onDismiss && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="p-2 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Progress bar animation */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-white/40 animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UnreadMessagesBanner;
