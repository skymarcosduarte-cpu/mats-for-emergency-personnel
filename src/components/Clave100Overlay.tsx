import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, X, MessageCircle, MapPin, Volume2, Play, Pause, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { stopClave100Alert, playClave100Alert, unlockAudioContext } from '@/lib/alertSound';
import { formatDuration } from '@/lib/audioUtils';

interface Clave100OverlayProps {
  isVisible: boolean;
  senderName: string;
  message: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  audioDurationMs?: number | null;
  onDismiss: () => void;
  onOpenChat: () => void;
}

export const Clave100Overlay: React.FC<Clave100OverlayProps> = ({
  isVisible,
  senderName,
  message,
  imageUrl,
  audioUrl,
  audioDurationMs,
  onDismiss,
  onOpenChat,
}) => {
  const [showContent, setShowContent] = useState(false);
  const [flashPhase, setFlashPhase] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [audioActivated, setAudioActivated] = useState(false);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Handler for user interaction to unlock audio on mobile
  const handleUserInteraction = async () => {
    if (audioActivated) return;
    
    console.log('Clave100Overlay: User interaction detected, unlocking audio...');
    setAudioActivated(true);
    
    // Unlock and play the alert
    await unlockAudioContext();
    playClave100Alert();
  };

  useEffect(() => {
    if (isVisible) {
      setAudioActivated(false);
      
      // Small delay for animation
      const timer = setTimeout(() => setShowContent(true), 100);
      
      // Start intense flashing effect
      flashIntervalRef.current = setInterval(() => {
        setFlashPhase(prev => (prev + 1) % 4);
      }, 150);
      
      return () => {
        clearTimeout(timer);
        if (flashIntervalRef.current) {
          clearInterval(flashIntervalRef.current);
        }
      };
    } else {
      setShowContent(false);
      setFlashPhase(0);
      setIsPlayingAudio(false);
      setShowFullImage(false);
      setAudioActivated(false);
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
  }, [isVisible]);

  const toggleAudioPlayback = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlayingAudio(false);
    }

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleDismiss = () => {
    stopClave100Alert();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onDismiss();
  };

  const handleOpenChat = () => {
    stopClave100Alert();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onOpenChat();
    onDismiss();
  };

  if (!isVisible) return null;

  // Extract location link if present
  const locationMatch = message.match(/https:\/\/www\.google\.com\/maps\?q=[\d.-]+,[\d.-]+/);
  const locationUrl = locationMatch ? locationMatch[0] : null;

  // Clean message for display (remove the CLAVE 100 header)
  const cleanMessage = message
    .replace(/🚨 CLAVE 100 - EMERGENCIA MÁXIMA 🚨\n\n/, '')
    .trim();

  // Dynamic background colors for flashing effect
  const flashColors = [
    'bg-destructive/95',
    'bg-red-900/95',
    'bg-orange-600/95',
    'bg-destructive/95',
  ];

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center p-4",
        flashColors[flashPhase],
        "transition-all duration-100",
        showContent ? "opacity-100" : "opacity-0"
      )}
      onClick={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
      {/* Tap to activate sound banner for mobile */}
      {!audioActivated && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 animate-pulse">
          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-white" />
            <span className="text-white text-sm font-medium">Toca para activar sonido</span>
          </div>
        </div>
      )}
      {/* Multiple pulsing rings for maximum visual impact */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Ring 1 */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, rgba(255, 255, 255, 0.3) 30%, transparent 60%)',
            animation: 'emergency-pulse-1 0.5s ease-out infinite',
          }}
        />
        {/* Ring 2 - offset timing */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, rgba(255, 200, 0, 0.4) 40%, transparent 70%)',
            animation: 'emergency-pulse-2 0.7s ease-out infinite',
          }}
        />
        {/* Ring 3 - slower */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, rgba(255, 0, 0, 0.5) 50%, transparent 80%)',
            animation: 'emergency-pulse-3 1s ease-out infinite',
          }}
        />
        
        {/* Corner warning triangles */}
        <div className="absolute top-4 left-4 animate-bounce">
          <AlertTriangle className="w-12 h-12 text-yellow-300 drop-shadow-[0_0_10px_rgba(255,255,0,0.8)]" />
        </div>
        <div className="absolute top-4 right-4 animate-bounce" style={{ animationDelay: '0.2s' }}>
          <AlertTriangle className="w-12 h-12 text-yellow-300 drop-shadow-[0_0_10px_rgba(255,255,0,0.8)]" />
        </div>
        <div className="absolute bottom-20 left-4 animate-bounce" style={{ animationDelay: '0.4s' }}>
          <AlertTriangle className="w-12 h-12 text-yellow-300 drop-shadow-[0_0_10px_rgba(255,255,0,0.8)]" />
        </div>
        <div className="absolute bottom-20 right-4 animate-bounce" style={{ animationDelay: '0.6s' }}>
          <AlertTriangle className="w-12 h-12 text-yellow-300 drop-shadow-[0_0_10px_rgba(255,255,0,0.8)]" />
        </div>
      </div>

      {/* Content */}
      <div 
        className={cn(
          "relative max-w-md w-full bg-background border-4 border-yellow-400 rounded-2xl shadow-[0_0_60px_rgba(255,200,0,0.6)] overflow-hidden",
          "transform transition-all duration-500",
          showContent ? "scale-100 translate-y-0" : "scale-95 translate-y-4",
          "animate-[shake_0.3s_ease-in-out_infinite]"
        )}
      >
        {/* Header with animated warning */}
        <div className="bg-gradient-to-r from-destructive via-red-600 to-destructive p-5 flex items-center gap-3 relative overflow-hidden">
          {/* Animated stripes */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.3) 10px, rgba(0,0,0,0.3) 20px)',
              animation: 'stripe-move 1s linear infinite',
            }}
          />
          
          <div className="relative">
            <div className="relative">
              <AlertTriangle className="w-14 h-14 text-yellow-300 animate-pulse drop-shadow-[0_0_15px_rgba(255,255,0,0.9)]" />
              <div className="absolute inset-0 bg-yellow-300/50 rounded-full animate-ping" />
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                🚨 CLAVE 100 🚨
              </h2>
              <Volume2 className="w-6 h-6 text-yellow-300 animate-pulse" />
            </div>
            <p className="text-lg font-bold text-yellow-200 animate-pulse">
              ¡EMERGENCIA MÁXIMA!
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="text-white hover:bg-white/20 relative z-10"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 bg-gradient-to-b from-background to-red-950/20">
          {/* Sender */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center animate-pulse">
              <span className="text-2xl">🆘</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Mensaje urgente de</p>
              <p className="font-bold text-lg text-destructive">{senderName}</p>
            </div>
          </div>

          {/* Message */}
          <div className="p-4 bg-destructive/10 border-2 border-destructive/40 rounded-lg shadow-inner">
            <p className="text-base whitespace-pre-wrap break-words font-medium">
              {cleanMessage}
            </p>
          </div>

          {/* Attached Image */}
          {imageUrl && (
            <div className="relative">
              <button 
                onClick={() => setShowFullImage(!showFullImage)}
                className="w-full"
              >
                <img 
                  src={imageUrl} 
                  alt="Imagen de emergencia" 
                  className={cn(
                    "w-full rounded-lg border-2 border-destructive/40 object-cover transition-all",
                    showFullImage ? "max-h-[400px]" : "max-h-[150px]"
                  )}
                />
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  {showFullImage ? 'Reducir' : 'Ver imagen'}
                </div>
              </button>
            </div>
          )}

          {/* Attached Audio */}
          {audioUrl && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <button
                onClick={toggleAudioPlayback}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              >
                {isPlayingAudio ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium">🎤 Nota de voz adjunta</p>
                {audioDurationMs && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {formatDuration(audioDurationMs)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Location button if present */}
          {locationUrl && (
            <Button
              variant="outline"
              className="w-full border-2 border-primary bg-primary/10 hover:bg-primary/20 text-primary font-bold"
              onClick={() => window.open(locationUrl, '_blank')}
            >
              <MapPin className="w-5 h-5 mr-2" />
              📍 Ver ubicación en el mapa
            </Button>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="flex-1 border-2 h-12 text-base"
            >
              Entendido
            </Button>
            <Button
              onClick={handleOpenChat}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold h-12 text-base shadow-lg shadow-destructive/30"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              ¡Responder!
            </Button>
          </div>
        </div>

        {/* Bottom warning bar */}
        <div className="bg-yellow-500/30 border-t-2 border-yellow-500 px-4 py-3">
          <p className="text-sm text-center text-yellow-800 dark:text-yellow-200 font-bold animate-pulse">
            ⚠️ ¡ALERTA DE EMERGENCIA REAL! ⚠️
          </p>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes emergency-pulse-1 {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes emergency-pulse-2 {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes emergency-pulse-3 {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px) rotate(-0.5deg); }
          75% { transform: translateX(3px) rotate(0.5deg); }
        }
        @keyframes stripe-move {
          0% { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
      `}</style>
    </div>
  );
};