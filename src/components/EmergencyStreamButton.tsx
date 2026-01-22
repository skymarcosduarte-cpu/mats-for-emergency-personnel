/**
 * ============================================
 * EMERGENCY STREAM BUTTON COMPONENT
 * ============================================
 * 
 * A compact camera button with red glow effect for the app header.
 * When pressed, shows confirmation dialog and starts emergency recording.
 * Displays fullscreen overlay during active recording.
 * 
 * FEATURES:
 * - Red glow effect when not recording
 * - Pulsing indicator when recording
 * - Fullscreen video preview overlay
 * - Progress bar with time remaining
 * - Direct STOP button (no confirmation dialog to ensure it works)
 * 
 * USAGE:
 * <EmergencyStreamButton className="..." />
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Video, Square, Radio, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { useEmergencyStream } from '@/hooks/useEmergencyStream';
import { Progress } from '@/components/ui/progress';

interface EmergencyStreamButtonProps {
  className?: string;
}

const MAX_DURATION_SECONDS = 300; // 5 minutes

export function EmergencyStreamButton({ className }: EmergencyStreamButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    isStreaming,
    isPreparing,
    clipCount,
    elapsedSeconds,
    error,
    mediaStream,
    startStream,
    stopStream,
  } = useEmergencyStream();

  // Attach media stream to video preview
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const handleButtonClick = () => {
    if (isStreaming) {
      // Direct stop - no dialog that can get hidden
      handleDirectStop();
    } else {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmStart = async () => {
    setShowConfirmDialog(false);
    await startStream();
  };

  // Direct stop without dialog - more reliable
  const handleDirectStop = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      await stopStream();
    } finally {
      setIsStopping(false);
    }
  };

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, []);

  const progressPercent = (elapsedSeconds / MAX_DURATION_SECONDS) * 100;

  // Render the recording overlay - computed directly (not memoized) to ensure reactivity
  const renderRecordingOverlay = () => {
    if (!isStreaming) return null;

    const lastProcessed = clipCount;
    const nextClip = clipCount + 1;
    const isPostingToChat = nextClip <= 3;

    return (
      <div
        className="fixed inset-0 flex flex-col bg-black"
        style={{
          zIndex: 2147483647,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Grabación de emergencia en curso"
      >
        {/* Video Preview - Limited height to ensure controls are visible */}
        <div className="relative flex-1 min-h-0 max-h-[55vh] bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Live indicator - Top left */}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive px-3 py-1.5 rounded-full shadow-lg">
            <Radio className="w-4 h-4 text-white animate-pulse" />
            <span className="text-white font-bold text-sm">EN VIVO</span>
          </div>

          {/* Clip counter - Top right */}
          <div className="absolute top-4 right-4 bg-black/70 px-3 py-1.5 rounded-full">
            <span className="text-white text-sm font-medium">📹 Clip #{nextClip}</span>
          </div>

          {/* Recording status indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-full border-2 border-destructive">
            <span className="text-white text-sm font-medium flex items-center gap-2">
              <span className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              Grabando…
            </span>
          </div>
        </div>

        {/* Bottom Controls - Fixed, always visible */}
        <div
          className="bg-black p-4 space-y-3 border-t-2 border-destructive flex-shrink-0"
          style={{
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 16px))',
          }}
        >
          {/* Progress bar */}
          <div className="space-y-1">
            <Progress value={progressPercent} className="h-2 bg-muted" />
            <div className="flex justify-between text-white text-xs">
              <span className="font-mono">{formatTime(elapsedSeconds)}</span>
              <span className="text-muted-foreground">Máximo {formatTime(MAX_DURATION_SECONDS)}</span>
            </div>
          </div>

          {/* Status Info */}
          <div className="rounded-lg p-3 bg-white/5 border border-white/10">
            <p className="text-white font-medium text-sm mb-2">Estado de la grabación</p>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-center gap-2 text-white/90">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>Clips guardados: <strong className="text-white">{lastProcessed}</strong></span>
              </li>
              <li className="flex items-center gap-2 text-white/90">
                {isPostingToChat ? (
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                )}
                <span>Chat: {isPostingToChat ? 'enviando clips' : 'solo primeros 3'}</span>
              </li>
              <li className="flex items-center gap-2 text-white/90">
                <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>Contactos: al finalizar (para no interrumpir)</span>
              </li>
            </ul>
          </div>

          {/* STOP BUTTON - Large, visible, DIRECT action (no dialog) */}
          <Button
            onClick={handleDirectStop}
            disabled={isStopping}
            className="w-full h-14 text-lg font-bold bg-destructive hover:bg-destructive/90 border-2 border-white shadow-xl active:scale-95 transition-transform"
            style={{ touchAction: 'manipulation' }}
          >
            {isStopping ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                DETENIENDO...
              </>
            ) : (
              <>
                <Square className="w-5 h-5 mr-2 fill-white" />
                DETENER GRABACIÓN
              </>
            )}
          </Button>

          <p className="text-center text-white/40 text-xs">
            Toca el botón rojo para detener • Los clips se guardan automáticamente
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Main Button - Small with red glow */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleButtonClick}
        disabled={isPreparing}
        className={cn(
          "relative rounded-full h-9 w-9 transition-all duration-300",
          isStreaming && "bg-destructive hover:bg-destructive/90",
          className
        )}
        style={!isStreaming ? {
          boxShadow: '0 0 8px 2px rgba(239, 68, 68, 0.4), 0 0 16px 4px rgba(239, 68, 68, 0.2)'
        } : undefined}
        aria-label={isStreaming ? 'Detener transmisión' : 'Iniciar transmisión de emergencia'}
      >
        {isPreparing ? (
          <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin" />
        ) : isStreaming ? (
          <>
            <Square className="w-4 h-4 text-white fill-white" />
            {/* Recording indicator dot */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
          </>
        ) : (
          <Video className="w-4 h-4 text-destructive" />
        )}
      </Button>

      {/* Confirmation Dialog - Start Recording */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Video className="w-5 h-5" />
              Transmisión de Emergencia
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left">
              <p>
                Esta función graba video en vivo y lo comparte automáticamente con la comunidad 
                para documentar emergencias.
              </p>
              
              <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
                <p className="font-medium text-foreground">📹 ¿Qué sucederá?</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Se grabarán clips de 15 segundos automáticamente</li>
                  <li>Cada clip se publicará en el chat comunitario</li>
                  <li>Se notificará a tus contactos de emergencia</li>
                  <li>Se incluirá tu ubicación GPS</li>
                  <li>Los videos estarán disponibles por 7 días</li>
                  <li>Duración máxima: 5 minutos</li>
                </ul>
              </div>

              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
                <p className="font-medium text-destructive">⚠️ ADVERTENCIA</p>
                <p className="text-destructive/80 mt-1">
                  Solo usa esta función para emergencias reales o sospecha de peligro.
                  El mal uso causará baja inmediata de la red.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStart}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Video className="w-4 h-4 mr-2" />
              Iniciar Transmisión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Recording Overlay (portaled to body to avoid header clipping) */}
      {typeof document !== 'undefined' && createPortal(renderRecordingOverlay(), document.body)}
    </>
  );
}