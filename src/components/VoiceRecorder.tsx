// Voice Recorder Component for COMUNIDAD EX SOS
// Max 30 seconds with auto-stop

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  createAudioRecorder, 
  formatDuration, 
  formatRemaining,
  AUDIO_LIMITS,
  supportsAudioRecording,
  type AudioRecordingState 
} from '@/lib/audioUtils';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, durationMs: number) => void;
  onClear?: () => void;
  maxDurationMs?: number;
  className?: string;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onClear,
  maxDurationMs = AUDIO_LIMITS.MAX_DURATION_MS,
  className,
}) => {
  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    blob: null,
    error: null,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  
  const recorderRef = useRef<ReturnType<typeof createAudioRecorder> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check browser support
  const isSupported = supportsAudioRecording();

  // Handle state changes from recorder
  const handleStateChange = useCallback((newState: AudioRecordingState) => {
    setState(newState);
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setState(prev => ({
        ...prev,
        error: 'Tu navegador no soporta grabación de audio',
      }));
      return;
    }

    recorderRef.current = createAudioRecorder(handleStateChange);
    await recorderRef.current.start();
    setConfirmed(false);
  }, [isSupported, handleStateChange]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (recorderRef.current) {
      await recorderRef.current.stop();
    }
  }, []);

  // Clear recording
  const clearRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.destroy();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      blob: null,
      error: null,
    });
    setIsPlaying(false);
    setConfirmed(false);
    onClear?.();
  }, [onClear]);

  // Play/pause preview
  const togglePlayback = useCallback(() => {
    if (!state.blob) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(URL.createObjectURL(state.blob));
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [state.blob, isPlaying]);

  // Confirm and send recording
  const confirmRecording = useCallback(() => {
    if (state.blob) {
      onRecordingComplete(state.blob, state.duration);
      setConfirmed(true);
    }
  }, [state.blob, state.duration, onRecordingComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.destroy();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Calculate progress
  const progress = (state.duration / maxDurationMs) * 100;
  const isNearLimit = state.duration > maxDurationMs * 0.8;

  if (!isSupported) {
    return (
      <div className={cn('p-4 bg-muted rounded-lg text-center', className)}>
        <p className="text-sm text-muted-foreground">
          Tu navegador no soporta grabación de audio
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Error message */}
      {state.error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          {state.error}
        </div>
      )}

      {/* Recording controls */}
      {!state.blob ? (
        <div className="flex flex-col items-center gap-3">
          {/* Record button */}
          <button
            onClick={state.isRecording ? stopRecording : startRecording}
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center transition-all touch-target',
              state.isRecording
                ? 'bg-destructive text-destructive-foreground animate-pulse'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {state.isRecording ? (
              <Square className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>

          {/* Timer and progress */}
          {state.isRecording && (
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-mono text-foreground">
                  {formatDuration(state.duration)}
                </span>
                <span className={cn(
                  'font-mono',
                  isNearLimit ? 'text-warning' : 'text-muted-foreground'
                )}>
                  -{formatRemaining(state.duration, maxDurationMs)}
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    'h-full transition-all duration-100',
                    isNearLimit ? 'bg-warning' : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              
              <p className="text-xs text-center text-muted-foreground">
                Máximo {maxDurationMs / 1000} segundos
              </p>
            </div>
          )}

          {!state.isRecording && (
            <p className="text-sm text-muted-foreground">
              Toca para grabar nota de voz
            </p>
          )}
        </div>
      ) : (
        /* Playback controls */
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <button
            onClick={togglePlayback}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center touch-target"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">
              Nota de voz
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {formatDuration(state.duration)}
            </div>
          </div>

          {!confirmed ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearRecording}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
              <Button
                variant="default"
                size="icon"
                onClick={confirmRecording}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                <Check className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <div className="px-3 py-1 bg-secondary/20 text-secondary text-xs font-medium rounded-full">
              ✓ Listo
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
