import React, { useRef, useCallback, useState } from 'react';
import { MatsLogo } from './MatsLogo';
import { AlertTriangle, Phone } from 'lucide-react';
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
  const [showFeedback, setShowFeedback] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const triggerPanic = useCallback(() => {
    // Prevent double-triggers within 500ms
    const now = Date.now();
    if (now - lastActivatedAtRef.current < 500) {
      console.log('[AppHeader] Trigger skipped - too soon');
      return;
    }
    
    lastActivatedAtRef.current = now;
    console.log('[AppHeader] Panic triggered');
    
    // Visual feedback only
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 300);
    
    // Haptic feedback (non-blocking)
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      // Ignore vibration errors
    }
    
    // Show confirmation dialog
    setShowConfirmation(true);
  }, []);

  const handleConfirm = useCallback(() => {
    console.log('[AppHeader] Confirm clicked');
    // Close dialog first to prevent any blocking
    setShowConfirmation(false);
    
    // Use setTimeout to ensure dialog closes before other operations
    setTimeout(() => {
      // Play urgent sound (non-blocking)
      try {
        playUrgentSound();
      } catch (e) {
        // Ignore sound errors
      }
      
      // Vibrate on confirm (non-blocking)
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch (e) {
        // Ignore vibration errors
      }
      
      // Open panic options dialog
      onPanicClick();
    }, 50);
  }, [onPanicClick]);

  const handleCancel = useCallback(() => {
    console.log('[AppHeader] Cancel clicked');
    setShowConfirmation(false);
  }, []);

  // Simple touch handler for iOS compatibility
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLButtonElement>) => {
    console.log('[AppHeader] TouchEnd');
    e.preventDefault(); // Prevent ghost clicks on iOS
    triggerPanic();
  }, [triggerPanic]);

  // Fallback click handler for non-touch devices
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    // Check if this was from a touch (if so, touchend already handled it)
    const now = Date.now();
    if (now - lastActivatedAtRef.current < 300) {
      console.log('[AppHeader] Click skipped - touchend just handled it');
      return;
    }
    console.log('[AppHeader] Click');
    e.preventDefault();
    triggerPanic();
  }, [triggerPanic]);

  return (
    <>
      <header className="app-header sticky top-0 z-50">
        <MatsLogo size={36} showText />
        
        <button
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          className="relative flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-panic to-red-600 text-white shadow-lg shadow-panic/40 touch-manipulation select-none active:scale-95 transition-all hover:shadow-panic/60"
          aria-label="Botón de pánico - SOS"
          type="button"
          style={{ 
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
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
