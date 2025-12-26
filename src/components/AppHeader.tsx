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
  const isProcessingRef = useRef(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const triggerPanic = useCallback(() => {
    // Prevent double-triggers within 500ms
    const now = Date.now();
    if (now - lastActivatedAtRef.current < 500) {
      return;
    }
    
    if (isProcessingRef.current) {
      return;
    }
    
    lastActivatedAtRef.current = now;
    isProcessingRef.current = true;
    
    // Visual feedback only
    setShowFeedback(true);
    
    // Haptic feedback (non-blocking)
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      // Ignore vibration errors
    }
    
    // Show confirmation dialog (sound will play on confirm)
    setShowConfirmation(true);
    
    // Reset states after short delay
    setTimeout(() => {
      setShowFeedback(false);
      isProcessingRef.current = false;
    }, 300);
  }, []);

  const handleConfirm = useCallback(() => {
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
    setShowConfirmation(false);
  }, []);

  // Unified touch/pointer handler for cross-platform compatibility
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    console.log('[AppHeader] PointerDown:', e.pointerType);
    // Mark the start time for all pointer types
    lastActivatedAtRef.current = -Date.now(); // Negative to mark as "in progress"
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    console.log('[AppHeader] PointerUp:', e.pointerType);
    
    // Only trigger if we had a corresponding pointerdown
    if (lastActivatedAtRef.current >= 0) {
      console.log('[AppHeader] No matching pointerdown, skipping');
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    triggerPanic();
  }, [triggerPanic]);

  // Fallback click handler for devices that don't support pointer events well
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('[AppHeader] Click detected, lastActivated:', lastActivatedAtRef.current);
    
    // If pointer events handled it, skip
    const timeSinceLastActivation = Date.now() - Math.abs(lastActivatedAtRef.current);
    if (lastActivatedAtRef.current !== 0 && timeSinceLastActivation < 1000) {
      console.log('[AppHeader] Click skipped - recent pointer/activation detected');
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
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { lastActivatedAtRef.current = 0; }}
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
