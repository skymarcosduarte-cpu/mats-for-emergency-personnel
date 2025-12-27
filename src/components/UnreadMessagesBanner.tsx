import React, { useEffect } from 'react';
import { MessageCircle, X, Sparkles } from 'lucide-react';
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
  // Vibrate when banner appears
  useEffect(() => {
    if (unreadCount > 0 && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  }, [unreadCount]);

  if (unreadCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.8 }}
        animate={{ 
          y: 0, 
          opacity: 1, 
          scale: 1,
        }}
        exit={{ y: 100, opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', damping: 20, stiffness: 400 }}
        className="fixed bottom-20 left-4 right-4 z-[200] md:left-auto md:right-4 md:max-w-sm"
      >
        <motion.div 
          onClick={onOpen}
          animate={{ 
            boxShadow: [
              '0 0 0 0 rgba(var(--primary), 0)',
              '0 0 0 12px rgba(var(--primary), 0.3)',
              '0 0 0 0 rgba(var(--primary), 0)'
            ]
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground rounded-2xl shadow-2xl p-4 cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all relative overflow-hidden border-2 border-white/20"
        >
          {/* Animated shimmer effect */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          />
          
          {/* Sparkle particles */}
          <div className="absolute top-2 right-12 opacity-60">
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
            </motion.div>
          </div>
          
          <div className="relative flex items-center gap-4">
            {/* Animated icon with pulsing ring */}
            <div className="relative flex-shrink-0">
              <motion.div 
                className="absolute inset-0 rounded-full bg-white/30"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div 
                className="w-14 h-14 rounded-full bg-white/25 flex items-center justify-center backdrop-blur-sm"
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <MessageCircle className="w-7 h-7" />
              </motion.div>
              <motion.span 
                className="absolute -top-1 -right-1 w-7 h-7 bg-red-500 text-white text-sm font-bold rounded-full flex items-center justify-center shadow-lg"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            </div>

            {/* Text content with emphasis */}
            <div className="flex-1 min-w-0">
              <motion.p 
                className="font-bold text-lg tracking-tight"
                animate={{ opacity: [1, 0.8, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {unreadCount === 1 ? '💬 Nuevo mensaje' : `💬 ${unreadCount} mensajes nuevos`}
              </motion.p>
              {senderName && (
                <p className="text-sm font-medium opacity-95 truncate">
                  de <span className="font-bold">{senderName}</span>
                </p>
              )}
              <p className="text-xs font-medium opacity-80 mt-1 flex items-center gap-1">
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  👆
                </motion.span>
                Toca para abrir
              </p>
            </div>

            {/* Dismiss button */}
            {onDismiss && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="p-2.5 rounded-full hover:bg-white/25 active:bg-white/35 transition-colors flex-shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Animated progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20 overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-yellow-300 via-white to-yellow-300"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ width: '50%' }}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UnreadMessagesBanner;
