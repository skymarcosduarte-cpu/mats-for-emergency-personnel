// Panic Button FAB Component for COMUNIDAD EX SOS
// With voice recording and additional context support

import React, { useRef, useState, useCallback } from 'react';
import { AlertTriangle, X, Ambulance, Shield, Wrench, HardHat, Users, MapPin, Phone, Cross, Mic, ChevronLeft, Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import type { PanicType, UserRole } from '@/types';
import { useLocation } from '@/hooks/useLocation';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PanicOption {
  type: PanicType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const PANIC_OPTIONS: PanicOption[] = [
  {
    type: 'AMBULANCIA_PROPIA',
    label: 'Ambulancia Propia',
    icon: <Ambulance className="w-6 h-6" />,
    description: 'Necesito ambulancia para mí',
  },
  {
    type: 'AMBULANCIA_TERCERO',
    label: 'Ambulancia Tercero',
    icon: <Ambulance className="w-6 h-6" />,
    description: 'Ambulancia para otra persona',
  },
  {
    type: 'PATRULLA',
    label: 'Patrulla',
    icon: <Shield className="w-6 h-6" />,
    description: 'Necesito apoyo policial',
  },
  {
    type: 'MECANICO',
    label: 'Mecánico',
    icon: <Wrench className="w-6 h-6" />,
    description: 'Falla mecánica o ponchadura',
  },
  {
    type: 'PROTECCION_CIVIL',
    label: 'Protección Civil',
    icon: <HardHat className="w-6 h-6" />,
    description: 'Emergencia general',
  },
];

// Emergency services quick-dial numbers (Mexico)
const EMERGENCY_NUMBERS = [
  { name: 'Emergencias', number: '911', icon: <Phone className="w-5 h-5" />, color: 'bg-red-500' },
  { name: 'Cruz Roja', number: '065', icon: <Cross className="w-5 h-5" />, color: 'bg-red-600' },
  { name: 'Bomberos', number: '068', icon: <AlertTriangle className="w-5 h-5" />, color: 'bg-orange-500' },
  { name: 'Policía', number: '060', icon: <Shield className="w-5 h-5" />, color: 'bg-blue-600' },
];

interface PanicButtonProps {
  userRole?: UserRole;
  onPanicTriggered?: (type: PanicType, lat: number, lng: number, message?: string, audioUrl?: string, audioDurationMs?: number) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Vibrate helper (checks for support)
const vibrate = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore errors
    }
  }
};

type Step = 'select-type' | 'add-context';

export const PanicButton: React.FC<PanicButtonProps> = ({ 
  userRole = 'RESCATISTA',
  onPanicTriggered,
  isOpen: controlledIsOpen,
  onOpenChange
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [step, setStep] = useState<Step>('select-type');
  const [selectedType, setSelectedType] = useState<PanicType | null>(null);
  const [selectedOption, setSelectedOption] = useState<PanicOption | null>(null);
  const [message, setMessage] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState<number>(0);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [gpsTimeout, setGpsTimeout] = useState(false);
  const { position, getCurrentPosition, loading: locationLoading } = useLocation();
  const openedAtRef = useRef<number>(0);

  const GPS_TIMEOUT_MS = 10000; // 10 seconds

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  
  const setIsOpen = (open: boolean) => {
    if (open) {
      openedAtRef.current = Date.now();
    }

    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
    
    // Reset state when opening
    if (open) {
      setStep('select-type');
      setSelectedType(null);
      setSelectedOption(null);
      setMessage('');
      setAudioBlob(null);
      setAudioDurationMs(0);
      vibrate([100, 50, 100]); // Double short vibration
      toast.warning('Selecciona el tipo de emergencia', {
        duration: 3000,
        icon: '⚠️',
      });
    }
  };

  // Handle type selection - go to context step
  const handleTypeSelect = (option: PanicOption) => {
    setSelectedType(option.type);
    setSelectedOption(option);
    setStep('add-context');
    vibrate([100]);
  };

  // Go back to type selection
  const handleBack = () => {
    setStep('select-type');
    setSelectedType(null);
    setSelectedOption(null);
    setMessage('');
    setAudioBlob(null);
    setAudioDurationMs(0);
  };

  // Handle voice recording complete
  const handleRecordingComplete = useCallback((blob: Blob, durationMs: number) => {
    setAudioBlob(blob);
    setAudioDurationMs(durationMs);
    toast.success('Nota de voz grabada', { duration: 2000 });
  }, []);

  // Clear voice recording
  const handleClearRecording = useCallback(() => {
    setAudioBlob(null);
    setAudioDurationMs(0);
  }, []);

  // Upload audio to storage
  const uploadAudio = async (blob: Blob, panicEventId: string): Promise<string | null> => {
    try {
      const fileName = `panic_${panicEventId}_${Date.now()}.webm`;
      const filePath = `panic-audio/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reports_media')
        .upload(filePath, blob, {
          contentType: blob.type || 'audio/webm',
          upsert: false,
        });

      if (uploadError) {
        console.error('Audio upload error:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('reports_media')
        .getPublicUrl(filePath);

      return urlData?.publicUrl || null;
    } catch (error) {
      console.error('Failed to upload audio:', error);
      return null;
    }
  };

  // Send the alert with all context
  const handleSendAlert = async () => {
    if (!selectedType || !selectedOption) return;

    setIsGettingLocation(true);
    vibrate([200, 100, 200, 100, 300]); // SOS-style pattern

    let lat = position?.lat;
    let lng = position?.lng;

    // Get position with timeout
    if (!lat || !lng) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          setGpsTimeout(true);
          reject(new Error('GPS_TIMEOUT'));
        }, GPS_TIMEOUT_MS);
      });

      try {
        const pos = await Promise.race([getCurrentPosition(), timeoutPromise]);
        lat = pos.lat;
        lng = pos.lng;
        setGpsTimeout(false);
      } catch (error) {
        console.error('Failed to get position:', error);

        if (error instanceof Error && error.message === 'GPS_TIMEOUT') {
          toast.error('El GPS está tardando demasiado', {
            description: 'Intenta en un lugar con mejor señal o activa el GPS manualmente',
            duration: 6000,
          });
        } else {
          toast.error('No se pudo obtener tu ubicación.');
        }

        setIsGettingLocation(false);
        setGpsTimeout(false);
        return;
      }
    }

    setIsGettingLocation(false);
    setGpsTimeout(false);

    // Upload audio if present
    let audioUrl: string | undefined;
    if (audioBlob) {
      setIsUploadingAudio(true);
      const tempId = `temp_${Date.now()}`;
      audioUrl = await uploadAudio(audioBlob, tempId) || undefined;
      setIsUploadingAudio(false);
    }

    // Notify parent component
    onPanicTriggered?.(
      selectedType,
      lat,
      lng,
      message.trim() || undefined,
      audioUrl,
      audioBlob ? audioDurationMs : undefined
    );

    toast.success('Alerta enviada a la comunidad', {
      description: 'Los usuarios conectados serán notificados dentro de la app',
      duration: 5000,
    });

    // Close dialog and reset
    setIsOpen(false);
    setStep('select-type');
    setSelectedType(null);
    setSelectedOption(null);
    setMessage('');
    setAudioBlob(null);
    setAudioDurationMs(0);
  };

  // Send immediately without context
  const handleSendNow = async () => {
    await handleSendAlert();
  };

  const isProcessing = isGettingLocation || isUploadingAudio;

  // Prevent Android/iOS "same-tap" from opening and immediately closing
  const handleOpenChange = (open: boolean) => {
    if (isProcessing) return;

    if (!open) {
      const msSinceOpen = Date.now() - openedAtRef.current;
      if (msSinceOpen < 350) return;
    }

    setIsOpen(open);
  };

  // Step 1: Select emergency type
  const renderSelectType = () => (
    <>
      <header className="px-4 pt-4 text-center sm:text-left">
        <h2 className="flex items-center justify-center sm:justify-start gap-2 text-lg font-semibold leading-none tracking-tight text-foreground">
          <AlertTriangle className="w-5 h-5 text-panic" />
          Selecciona tipo de emergencia
        </h2>
      </header>

      <div className="grid gap-3 py-4 px-4 sm:px-0">
        {PANIC_OPTIONS.map((option) => (
          <Button
            key={option.type}
            variant="outline"
            className="h-16 justify-start gap-4 text-left border-border hover:bg-muted hover:border-panic/50 transition-all touch-manipulation active:scale-95"
            onClick={() => handleTypeSelect(option)}
            style={{
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <div className="w-12 h-12 rounded-lg bg-panic/10 flex items-center justify-center text-panic pointer-events-none">
              {option.icon}
            </div>
            <div className="pointer-events-none flex-1">
              <div className="font-semibold text-foreground">{option.label}</div>
              <div className="text-xs text-muted-foreground">
                {option.description}
              </div>
            </div>
          </Button>
        ))}
      </div>

      {/* Emergency Services Quick Dial */}
      <div className="border-t border-border pt-4 mt-2 px-4 sm:px-0">
        <p className="text-xs text-muted-foreground mb-3 text-center font-medium">
          Llamar a Servicios de Emergencia
        </p>
        <div className="grid grid-cols-4 gap-2">
          {EMERGENCY_NUMBERS.map((service) => (
            <a
              key={service.number}
              href={`tel:${service.number}`}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg ${service.color} text-white hover:opacity-90 transition-opacity touch-manipulation active:scale-95`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              onClick={() => {
                vibrate([100, 50, 100]);
                toast.info(`Llamando a ${service.name}...`);
              }}
            >
              {service.icon}
              <span className="text-xs font-bold">{service.number}</span>
              <span className="text-[10px] opacity-80 truncate w-full text-center">{service.name}</span>
            </a>
          ))}
        </div>
      </div>

      {userRole === 'FAMILIAR' && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning mt-3 mx-4 sm:mx-0">
          ⚠️ FAMILIAR – NO PARAMÉDICO
        </div>
      )}

      <div className="px-4 pb-6 sm:p-0">
        <Button variant="ghost" onClick={() => setIsOpen(false)} className="mt-2 w-full sm:w-auto">
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </>
  );

  // Step 2: Add context (message + voice)
  const renderAddContext = () => (
    <>
      {/* Full-screen loading overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-200">
          <div className="relative">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${gpsTimeout ? 'bg-warning/20' : 'bg-panic/20'}`}>
              <MapPin className={`w-10 h-10 animate-pulse ${gpsTimeout ? 'text-warning' : 'text-panic'}`} />
            </div>
            <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${gpsTimeout ? 'border-warning' : 'border-panic'}`} />
          </div>
          <div className="text-center px-4">
            {isUploadingAudio ? (
              <>
                <p className="text-lg font-semibold text-foreground">Subiendo audio...</p>
                <p className="text-sm text-muted-foreground mt-1">Por favor espera un momento</p>
              </>
            ) : gpsTimeout ? (
              <>
                <p className="text-lg font-semibold text-warning">El GPS está tardando...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Verifica que el GPS esté activado
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-foreground">Obteniendo ubicación GPS...</p>
                <p className="text-sm text-muted-foreground mt-1">Por favor espera un momento</p>
              </>
            )}
          </div>
        </div>
      )}

      <header className="px-4 pt-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Cambiar tipo
        </button>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-lg bg-panic/10 flex items-center justify-center text-panic">
            {selectedOption?.icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {selectedOption?.label}
            </h2>
            <p className="text-xs text-muted-foreground">
              Agrega detalles para ayudar mejor
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Quick send button */}
        <Button
          onClick={handleSendNow}
          disabled={isProcessing}
          className="w-full h-14 bg-panic hover:bg-panic/90 text-white font-semibold text-lg"
        >
          <Send className="w-5 h-5 mr-2" />
          Enviar alerta ahora
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              O agrega más contexto
            </span>
          </div>
        </div>

        {/* Text message */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            Descripción (opcional)
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe qué está pasando, ubicación exacta, número de personas afectadas..."
            className="min-h-[80px] resize-none"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">
            {message.length}/500
          </p>
        </div>

        {/* Voice recorder */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Mic className="w-4 h-4 text-muted-foreground" />
            Nota de voz (opcional)
          </label>
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            onClear={handleClearRecording}
            maxDurationMs={30000}
          />
        </div>

        {/* Send with context */}
        {(message.trim() || audioBlob) && (
          <Button
            onClick={handleSendAlert}
            disabled={isProcessing}
            className="w-full h-12 bg-primary hover:bg-primary/90"
          >
            <Send className="w-4 h-4 mr-2" />
            Enviar con detalles
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg mx-4 bg-accent/10 text-foreground border border-accent/20">
        <Users className="w-4 h-4 text-accent shrink-0" />
        <span className="text-sm">La alerta se enviará a todos los usuarios conectados</span>
      </div>

      <div className="px-4 pb-6">
        <Button variant="ghost" onClick={() => setIsOpen(false)} className="mt-2 w-full">
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[20000]">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/80"
        onClick={() => handleOpenChange(false)}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Selecciona tipo de emergencia"
        className="absolute left-1/2 top-4 z-[20010] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-border bg-card text-card-foreground shadow-lg max-h-[calc(100dvh-2rem)] overflow-y-auto relative"
      >
        <button
          type="button"
          aria-label="Cerrar selector de emergencia"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition z-10"
          onClick={() => handleOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </button>

        {step === 'select-type' ? renderSelectType() : renderAddContext()}
      </section>
    </div>
  );
};

export default PanicButton;
