import React, { useRef, useCallback, useState } from 'react';
import { MatsLogo } from './MatsLogo';
import { ActiveUsersIndicator } from './ActiveUsersIndicator';
import { InternalMessaging } from './InternalMessaging';
import { AlertTriangle, Phone, MessageCircle } from 'lucide-react';
import { playUrgentSound } from '@/lib/alertSound';
import { toast } from 'sonner';
import { useInternalMessages } from '@/hooks/useInternalMessages';
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
  const suppressClickRef = useRef(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  
  // Get unread message count
  const { unreadCount } = useInternalMessages();

  const triggerPanic = useCallback(() => {
    // Prevent double-triggers within 500ms
    const now = Date.now();
    if (now - lastActivatedAtRef.current < 500) return;

    lastActivatedAtRef.current = now;

    // Visual feedback only
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 300);

    // Haptic feedback (non-blocking)
    try {
      if ("vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {
      // Ignore vibration errors
    }

    // Brief toast to confirm touch was detected
    toast('SOS: confirmar', {
      duration: 1500,
      icon: '🆘',
    });

    // Show confirmation dialog on next tick to avoid the same click dismissing it immediately (mobile/desktop)
    window.setTimeout(() => {
      setShowConfirmation(true);
    }, 0);
  }, []);

  const handleConfirm = useCallback(() => {
    // Close dialog first to prevent any blocking
    setShowConfirmation(false);

    // Use setTimeout to ensure dialog closes before other operations
    setTimeout(() => {
      // Play urgent sound (non-blocking)
      try {
        playUrgentSound();
      } catch {
        // Ignore sound errors
      }

      // Vibrate on confirm (non-blocking)
      try {
        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch {
        // Ignore vibration errors
      }

      // Open panic options dialog
      onPanicClick();
    }, 50);
  }, [onPanicClick]);

  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  // Open on pointer-up to avoid the overlay capturing the same gesture and instantly dismissing on mobile
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      // Prevent the follow-up click from re-firing
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 400);

      triggerPanic();
    },
    [triggerPanic],
  );

  // Fallback click handler (older browsers / keyboard)
  const handleClick = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressClickRef.current) return;
      triggerPanic();
    },
    [triggerPanic],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        triggerPanic();
      }
    },
    [triggerPanic],
  );

  return (
    <>
      <header className="app-header fixed top-0 left-0 right-0 z-[100]">
        <div className="flex items-center gap-2">
          <MatsLogo size={36} showText />
          {/* Inline active users count */}
          <ActiveUsersIndicator compact showIcon={false} className="ml-1" />
        </div>

        <div className="flex items-center gap-2">
          {/* Messages button with badge */}
          <button
            onClick={() => setShowMessages(true)}
            className="relative p-2 rounded-full hover:bg-muted/50 transition-colors"
            aria-label="Mensajes internos"
          >
            <MessageCircle className="w-5 h-5 text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onPointerUp={handlePointerUp}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-panic to-red-600 text-white shadow-lg shadow-panic/40 touch-manipulation select-none active:scale-95 transition-all hover:shadow-panic/60"
            aria-label="Botón de pánico - SOS"
            type="button"
            style={{
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
              userSelect: "none",
              WebkitUserSelect: "none",
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
        </div>
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
              Esto alertará a la comunidad con tu ubicación GPS.
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
            <AlertDialogCancel onClick={handleCancel} className="w-full">
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Internal Messages Modal */}
      <InternalMessaging 
        isOpen={showMessages} 
        onClose={() => setShowMessages(false)} 
      />
    </>
  );
};

export default AppHeader;
