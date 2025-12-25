// Audio Recording Utilities for COMUNIDAD EX SOS
// Voice notes with 30-second limit and auto-stop

export const AUDIO_LIMITS = {
  MAX_DURATION_MS: 30000, // 30 seconds
  MAX_SIZE_BYTES: 1.5 * 1024 * 1024, // 1.5MB
  PREFERRED_MIME: 'audio/webm;codecs=opus',
  FALLBACK_MIME: 'audio/mp4',
} as const;

export interface AudioRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  blob: Blob | null;
  error: string | null;
}

export interface AudioRecorder {
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  pause: () => void;
  resume: () => void;
  getState: () => AudioRecordingState;
  destroy: () => void;
}

/**
 * Get supported audio MIME type
 */
function getSupportedMimeType(): string {
  if (MediaRecorder.isTypeSupported(AUDIO_LIMITS.PREFERRED_MIME)) {
    return AUDIO_LIMITS.PREFERRED_MIME;
  }
  if (MediaRecorder.isTypeSupported(AUDIO_LIMITS.FALLBACK_MIME)) {
    return AUDIO_LIMITS.FALLBACK_MIME;
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  return 'audio/mp4';
}

/**
 * Format duration as mm:ss
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format remaining time
 */
export function formatRemaining(elapsedMs: number, maxMs: number = AUDIO_LIMITS.MAX_DURATION_MS): string {
  const remaining = Math.max(0, maxMs - elapsedMs);
  return formatDuration(remaining);
}

/**
 * Create audio recorder with auto-stop at max duration
 */
export function createAudioRecorder(
  onStateChange?: (state: AudioRecordingState) => void
): AudioRecorder {
  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let startTime = 0;
  let elapsedTime = 0;
  let timerInterval: NodeJS.Timeout | null = null;
  let autoStopTimeout: NodeJS.Timeout | null = null;

  const state: AudioRecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    blob: null,
    error: null,
  };

  const updateState = (updates: Partial<AudioRecordingState>) => {
    Object.assign(state, updates);
    onStateChange?.({ ...state });
  };

  const clearTimers = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (autoStopTimeout) {
      clearTimeout(autoStopTimeout);
      autoStopTimeout = null;
    }
  };

  const start = async (): Promise<void> => {
    try {
      // Request microphone access
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      const mimeType = getSupportedMimeType();
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunks = [];
      startTime = Date.now();
      elapsedTime = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        clearTimers();
        
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          
          // Validate size
          if (blob.size > AUDIO_LIMITS.MAX_SIZE_BYTES) {
            updateState({
              isRecording: false,
              isPaused: false,
              blob: null,
              error: `Audio demasiado grande (${(blob.size / 1024 / 1024).toFixed(1)}MB). Máximo: ${AUDIO_LIMITS.MAX_SIZE_BYTES / 1024 / 1024}MB. Intenta grabar más corto.`,
            });
          } else {
            updateState({
              isRecording: false,
              isPaused: false,
              blob,
              error: null,
            });
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        updateState({
          isRecording: false,
          error: 'Error de grabación',
        });
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second

      // Update duration timer
      timerInterval = setInterval(() => {
        if (!state.isPaused) {
          elapsedTime = Date.now() - startTime;
          updateState({ duration: elapsedTime });
        }
      }, 100);

      // Auto-stop at max duration
      autoStopTimeout = setTimeout(() => {
        if (state.isRecording) {
          stop();
        }
      }, AUDIO_LIMITS.MAX_DURATION_MS);

      updateState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        blob: null,
        error: null,
      });
    } catch (error) {
      updateState({
        isRecording: false,
        error: error instanceof Error 
          ? error.message 
          : 'No se pudo acceder al micrófono',
      });
    }
  };

  const stop = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        const originalOnStop = mediaRecorder.onstop;
        mediaRecorder.onstop = (event) => {
          originalOnStop?.call(mediaRecorder, event);
          resolve(state.blob);
        };
        mediaRecorder.stop();
      } else {
        resolve(null);
      }

      // Stop all tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });
  };

  const pause = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      updateState({ isPaused: true });
    }
  };

  const resume = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      startTime = Date.now() - elapsedTime;
      updateState({ isPaused: false });
    }
  };

  const getState = () => ({ ...state });

  const destroy = () => {
    clearTimers();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    chunks = [];
  };

  return {
    start,
    stop,
    pause,
    resume,
    getState,
    destroy,
  };
}

/**
 * Get audio duration from blob
 */
export async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Math.round(audio.duration * 1000));
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error('Failed to load audio'));
    };
    
    audio.src = URL.createObjectURL(blob);
  });
}

/**
 * Check if browser supports audio recording
 */
export function supportsAudioRecording(): boolean {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.MediaRecorder
  );
}
