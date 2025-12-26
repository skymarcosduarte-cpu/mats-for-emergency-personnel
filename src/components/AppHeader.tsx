import React from 'react';
import { MatsLogo } from './MatsLogo';
import { AlertTriangle } from 'lucide-react';

interface AppHeaderProps {
  onPanicClick: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onPanicClick }) => {
  const lastActivatedAtRef = React.useRef(0);

  const triggerPanic = (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onPanicClick();
  };

  const handlePanicPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    lastActivatedAtRef.current = Date.now();
    triggerPanic(e);
  };

  const handlePanicTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    // Fallback for Android WebView / older browsers where PointerEvents can be flaky.
    lastActivatedAtRef.current = Date.now();
    triggerPanic(e);
  };

  const handlePanicClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent the synthetic click that follows a touch/pointer interaction on Android.
    if (Date.now() - lastActivatedAtRef.current < 700) return;
    triggerPanic(e);
  };

  return (
    <header className="app-header sticky top-0 z-50">
      <MatsLogo size={36} showText />
      
      <button
        onPointerUp={handlePanicPointerUp}
        onTouchEnd={handlePanicTouchEnd}
        onClick={handlePanicClick}
        className="relative w-12 h-12 rounded-full bg-panic text-primary-foreground shadow-panic flex items-center justify-center touch-manipulation select-none"
        aria-label="Botón de pánico"
        type="button"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <AlertTriangle className="w-6 h-6 pointer-events-none" />
        <span className="absolute inset-0 rounded-full border-2 border-panic animate-ping opacity-30 pointer-events-none" />
      </button>
    </header>
  );
};

export default AppHeader;
