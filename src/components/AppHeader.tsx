import React, { useRef, useCallback, useState } from 'react';
import { MatsLogo } from './MatsLogo';
import { AlertTriangle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { playUrgentSound } from '@/lib/alertSound';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AppHeaderProps {
  onPanicClick: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onPanicClick }) => {
  const lastActivatedAtRef = useRef(0);
  const isProcessingRef = useRef(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const triggerPanic = useCallback(() => {
    // Prevent double-triggers within 500ms
    const now = Date.now();
    if (now - lastActivatedAtRef.current < 500) {
      console.log('[AppHeader] Panic blocked - too soon after last trigger');
      return;
    }
    
    if (isProcessingRef.current) {
      console.log('[AppHeader] Panic blocked - already processing');
      return;
    }
    
    console.log('[AppHeader] Panic triggered!');
    lastActivatedAtRef.current = now;
    isProcessingRef.current = true;
    
    // Visual feedback
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 200);
    
    // Immediate haptic feedback
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {
        console.log('[AppHeader] Vibrate failed:', e);
      }
    }
    
    // Show confirmation dialog
    setShowConfirmation(true);
    
    // Play urgent alert sound
    playUrgentSound();
    
    // Show toast notification for clear feedback
    toast.warning('¿Necesitas ayuda de emergencia?', {
      description: 'Confirma para alertar a la comunidad',
      duration: 4000,
      icon: '🆘',
    });
    
    // Reset processing state after a delay
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 500);
  }, []);

  const handleConfirm = useCallback(() => {
    setShowConfirmation(false);
    // Vibrate on confirm
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {
        // Ignore
      }
    }
    onPanicClick();
  }, [onPanicClick]);

  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  // Unified touch handler for Android
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLButtonElement>) => {
    console.log('[AppHeader] TouchStart detected');
    // Mark that a touch started (for click filtering)
    lastActivatedAtRef.current = -1; // Use -1 as marker that touch started
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLButtonElement>) => {
    console.log('[AppHeader] TouchEnd detected');
    e.preventDefault();
    e.stopPropagation();
    triggerPanic();
  }, [triggerPanic]);

  // Click handler - works for both mouse and touch (as fallback)
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('[AppHeader] Click detected, lastActivated:', lastActivatedAtRef.current);
    
    // If this was a touch-based click, the touch handlers already handled it
    // Check if we're within 1 second of a touch (marker is set in touchStart/touchEnd)
    const timeSinceLastActivation = Date.now() - Math.abs(lastActivatedAtRef.current);
    if (lastActivatedAtRef.current !== 0 && timeSinceLastActivation < 1000) {
      console.log('[AppHeader] Click skipped - recent touch/activation detected');
      return;
    }
    
    e.preventDefault();
    triggerPanic();
  }, [triggerPanic]);

  return (
    <>
      <header className="app-header sticky top-0 z-50">
        <MatsLogo size={36} showText />
        
        <button
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-panic to-red-600 text-white shadow-lg shadow-panic/40 touch-manipulation select-none active:scale-95 transition-all hover:shadow-panic/60"
          aria-label="Botón de pánico - SOS"
          type="button"
          style={{ 
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            userSelect: 'none',
          }}
        >
          <AlertTriangle className="w-5 h-5 pointer-events-none" />
          <span className="font-bold text-sm pointer-events-none">SOS</span>
          
          {/* Pulsing border effect */}
          <span className="absolute inset-0 rounded-full border-2 border-white/50 animate-ping opacity-40 pointer-events-none" />
          
          {/* Visual feedback overlay */}
          {showFeedback && (
            <span className="absolute inset-0 rounded-full bg-white/30 pointer-events-none animate-pulse" />
          )}
        </button>
      </header>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-panic/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-panic" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-xl">
              ¿Necesitas ayuda de emergencia?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Esto alertará a la comunidad y a tus contactos de emergencia con tu ubicación GPS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction 
              onClick={handleConfirm}
              className="w-full bg-panic hover:bg-panic/90 text-white font-bold py-3"
            >
              <Phone className="w-4 h-4 mr-2" />
              Sí, necesito ayuda
            </AlertDialogAction>
            <AlertDialogCancel 
              onClick={handleCancel}
              className="w-full"
            >
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AppHeader;
