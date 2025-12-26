import React, { useRef, useCallback } from 'react';
import { MatsLogo } from './MatsLogo';
import { AlertTriangle } from 'lucide-react';

interface AppHeaderProps {
  onPanicClick: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onPanicClick }) => {
  const lastActivatedAtRef = useRef(0);
  const isProcessingRef = useRef(false);

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
    
    // Immediate haptic feedback
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(100);
      } catch (e) {
        console.log('[AppHeader] Vibrate failed:', e);
      }
    }
    
    // Call the callback
    onPanicClick();
    
    // Reset processing state after a delay
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 500);
  }, [onPanicClick]);

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

  // Click handler only fires if no touch event preceded it
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('[AppHeader] Click detected, lastActivated:', lastActivatedAtRef.current);
    // If touch event already handled this, skip
    if (Date.now() - lastActivatedAtRef.current < 500) {
      console.log('[AppHeader] Click skipped - touch already handled');
      return;
    }
    e.preventDefault();
    triggerPanic();
  }, [triggerPanic]);

  return (
    <header className="app-header sticky top-0 z-50">
      <MatsLogo size={36} showText />
      
      <button
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className="relative w-12 h-12 rounded-full bg-panic text-primary-foreground shadow-panic flex items-center justify-center touch-manipulation select-none active:scale-95 transition-transform"
        aria-label="Botón de pánico"
        type="button"
        style={{ 
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          userSelect: 'none',
        }}
      >
        <AlertTriangle className="w-6 h-6 pointer-events-none" />
        <span className="absolute inset-0 rounded-full border-2 border-panic animate-ping opacity-30 pointer-events-none" />
      </button>
    </header>
  );
};

export default AppHeader;
