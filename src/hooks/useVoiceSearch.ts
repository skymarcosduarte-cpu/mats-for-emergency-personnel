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

  // Heuristics / debug
  const startAtRef = useRef<number>(0);
  const hadFinalRef = useRef<boolean>(false);
  const stopRequestedRef = useRef<boolean>(false);
  const lastErrorRef = useRef<string | null>(null);

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
      console.log('[useVoiceSearch] onstart');
      startAtRef.current = Date.now();
      hadFinalRef.current = false;
      stopRequestedRef.current = false;
      lastErrorRef.current = null;

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
        console.log('[useVoiceSearch] final result');
        hadFinalRef.current = true;
        onResult(transcriptText);
        setIsListening(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[useVoiceSearch] error:', event.error, event.message);
      lastErrorRef.current = event.error;
      setIsListening(false);

      switch (event.error) {
        case 'not-allowed':
          setError('Permiso de micrófono denegado');
          toast.error('Permite acceso al micrófono en la configuración de tu navegador', {
            duration: 5000,
          });
          break;
        case 'no-speech':
          setError('No se detectó voz');
          toast.error('No se detectó voz. Habla más cerca del micrófono e intenta de nuevo.');
          break;
        case 'network':
          setError('Error de red');
          toast.error('Se requiere conexión a internet para el dictado de voz. Verifica tu conexión.', {
            duration: 5000,
          });
          break;
        case 'audio-capture':
          setError('No se encontró micrófono');
          toast.error('No se detectó micrófono. Verifica que tu dispositivo tenga micrófono habilitado.');
          break;
        case 'aborted':
          // If user pressed stop, don't show an error
          if (stopRequestedRef.current) {
            setError(null);
            break;
          }
          setError(null);
          toast.error('No se pudo iniciar el dictado. Intenta de nuevo.');
          break;
        case 'service-not-allowed':
          setError('Servicio no disponible');
          toast.error('El servicio de voz no está disponible. Intenta de nuevo más tarde.');
          break;
        default:
          setError(`Error: ${event.error}`);
          toast.error(`Error de reconocimiento de voz: ${event.error}. Intenta de nuevo.`);
      }
    };

    recognition.onend = () => {
      const elapsedMs = startAtRef.current ? Date.now() - startAtRef.current : null;
      console.log('[useVoiceSearch] onend', {
        elapsedMs,
        hadFinal: hadFinalRef.current,
        stopRequested: stopRequestedRef.current,
        lastError: lastErrorRef.current,
      });

      setIsListening(false);

      // If user stopped it or we already have an error, don't add extra noise.
      if (stopRequestedRef.current || lastErrorRef.current) return;

      // Heuristic: double-beep + immediate end means SpeechRecognition failed silently.
      if (elapsedMs !== null && elapsedMs < 700 && !hadFinalRef.current) {
        toast.error('No se pudo iniciar el dictado. Revisa permisos de micrófono y conexión a internet.', {
          duration: 5000,
        });
      }
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

    if (!recognitionRef.current) {
      toast.error('Dictado no disponible en este momento');
      return;
    }

    // Avoid double-start
    if (isListening) {
      console.warn('[useVoiceSearch] Already listening, ignoring start request');
      return;
    }

    stopRequestedRef.current = false;
    lastErrorRef.current = null;
    hadFinalRef.current = false;
    startAtRef.current = Date.now();

    setError(null);
    setTranscript('');

    try {
      recognitionRef.current.start();
    } catch (err) {
      console.warn('[useVoiceSearch] Recognition start error:', err);
      setIsListening(false);
      toast.error('No se pudo iniciar el reconocimiento de voz');
    }
  }, [isSupported, isListening]);

  const stopListening = useCallback(() => {
    stopRequestedRef.current = true;
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
