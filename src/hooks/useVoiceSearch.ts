// Voice Search Hook using Web Speech API
// Works offline and is ideal for emergency situations

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Web Speech API types
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface UseVoiceSearchOptions {
  onResult: (transcript: string) => void;
  language?: string;
}

interface UseVoiceSearchReturn {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
  error: string | null;
}

export function useVoiceSearch({ 
  onResult, 
  language = 'es-MX' 
}: UseVoiceSearchOptions): UseVoiceSearchReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Check if Web Speech API is supported
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const transcriptText = result[0].transcript;

      setTranscript(transcriptText);

      // If result is final, send it
      if (result.isFinal) {
        onResult(transcriptText);
        setIsListening(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);

      switch (event.error) {
        case 'not-allowed':
          setError('Permiso de micrófono denegado');
          toast.error('Permite acceso al micrófono para usar búsqueda por voz');
          break;
        case 'no-speech':
          setError('No se detectó voz');
          toast.error('No se detectó voz. Intenta de nuevo.');
          break;
        case 'network':
          setError('Error de red');
          toast.error('Error de conexión. La búsqueda por voz requiere internet.');
          break;
        case 'audio-capture':
          setError('No se encontró micrófono');
          toast.error('No se detectó micrófono disponible');
          break;
        default:
          setError('Error de reconocimiento');
          toast.error('Error al reconocer voz. Intenta de nuevo.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSupported, language, onResult]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast.error('Tu navegador no soporta búsqueda por voz');
      return;
    }

    // Check if already listening to prevent double-start freeze on iOS
    if (isListening) {
      console.warn('Already listening, ignoring start request');
      return;
    }

    setError(null);
    setTranscript('');
    
    try {
      // Abort any existing recognition first (prevents iOS freeze)
      recognitionRef.current?.abort();
      
      // Small delay to ensure previous session is fully stopped on iOS
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
        } catch (err) {
          console.warn('Recognition start error:', err);
          setIsListening(false);
          toast.error('No se pudo iniciar el reconocimiento de voz');
        }
      }, 100);
    } catch (err) {
      // Recognition might already be running
      console.warn('Recognition abort error:', err);
      setIsListening(false);
    }
  }, [isSupported, isListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    transcript,
    error,
  };
}
