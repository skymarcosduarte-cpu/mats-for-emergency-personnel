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
 * - Stop confirmation dialog
 * 
 * USAGE:
 * <EmergencyStreamButton className="..." />
 */

import React, { useState, useRef, useEffect } from 'react';
import { Video, Square, Radio } from 'lucide-react';
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
  const [showStopDialog, setShowStopDialog] = useState(false);
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
      setShowStopDialog(true);
    } else {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmStart = async () => {
    setShowConfirmDialog(false);
    await startStream();
  };

  const handleConfirmStop = async () => {
    setShowStopDialog(false);
    await stopStream();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const progressPercent = (elapsedSeconds / MAX_DURATION_SECONDS) * 100;

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

      {/* Stop Confirmation Dialog */}
      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Detener transmisión?</AlertDialogTitle>
            <AlertDialogDescription>
              Has grabado {clipCount} clip(s) ({formatTime(elapsedSeconds)}). 
              ¿Estás seguro de que deseas detener la transmisión?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar grabando</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStop}>
              <Square className="w-4 h-4 mr-2" />
              Detener
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Recording Overlay - CRITICAL: Must be visible above everything */}
      {isStreaming && (
        <div 
          className="fixed inset-0 bg-black flex flex-col"
          style={{ 
            zIndex: 2147483647, // Maximum possible z-index
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          {/* Video Preview - Limited height to ensure controls are visible */}
          <div className="relative flex-1 min-h-0 max-h-[60vh]">
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
              <span className="text-white text-sm font-medium">
                📹 Clip #{clipCount + 1}
              </span>
            </div>

            {/* Recording status indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-full border-2 border-destructive">
              <span className="text-white text-sm font-medium flex items-center gap-2">
                <span className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                Grabando...
              </span>
            </div>
          </div>

          {/* Bottom Controls - Fixed, always visible */}
          <div 
            className="bg-black p-4 space-y-4 border-t-2 border-destructive"
            style={{ 
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 16px))',
              minHeight: '200px',
            }}
          >
            {/* Progress bar */}
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-3 bg-muted" />
              <div className="flex justify-between text-white text-sm">
                <span className="font-mono">{formatTime(elapsedSeconds)}</span>
                <span className="text-muted-foreground">Máximo {formatTime(MAX_DURATION_SECONDS)}</span>
              </div>
            </div>

            {/* Status Info */}
            <div className="text-center bg-muted rounded-lg p-3">
              <p className="text-foreground font-medium">📢 Transmitiendo al Chat Comunitario</p>
              <p className="text-sm text-muted-foreground mt-1">
                {clipCount} clips grabados • Tu ubicación se comparte
              </p>
            </div>

            {/* STOP BUTTON - Large and very visible */}
            <Button
              onClick={() => setShowStopDialog(true)}
              className="w-full h-16 text-xl font-bold bg-destructive hover:bg-destructive/90 border-2 border-white shadow-lg"
              style={{ touchAction: 'manipulation' }}
            >
              <Square className="w-6 h-6 mr-3 fill-white" />
              DETENER TRANSMISIÓN
            </Button>

            {/* Additional tap target for accessibility */}
            <p className="text-center text-white/50 text-xs">
              Toca el botón rojo para detener la grabación
            </p>
          </div>
        </div>
      )}
    </>
  );
}
