// Panic Button FAB Component for COMUNIDAD SOS
// With voice recording, additional context, and remote location support

import React, { useRef, useState, useCallback } from 'react';
import { AlertTriangle, X, Ambulance, Shield, Wrench, HardHat, Users, MapPin, Phone, Cross, Mic, ChevronLeft, Send, MessageSquare, Navigation, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { LocationPickerMap } from '@/components/LocationPickerMap';
import type { PanicType, UserRole } from '@/types';
import { useLocation } from '@/hooks/useLocation';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { requestNotificationPermission } from '@/hooks/useInternalMessages';

interface PanicOption {
  type: PanicType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const PANIC_OPTIONS: PanicOption[] = [
  {
    type: 'AMBULANCIA_PROPIA',
    label: 'Ambulancia para mí',
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
  
  // Remote location support
  const [useRemoteLocation, setUseRemoteLocation] = useState(false);
  const [remoteLat, setRemoteLat] = useState<string>('');
  const [remoteLng, setRemoteLng] = useState<string>('');
  const [remoteAddress, setRemoteAddress] = useState<string>('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  
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
      setUseRemoteLocation(false);
      setRemoteLat('');
      setRemoteLng('');
      setRemoteAddress('');
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
    setUseRemoteLocation(false);
    setRemoteLat('');
    setRemoteLng('');
    setRemoteAddress('');
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
      const mimeType = blob.type || 'audio/webm';
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const fileName = `panic_${panicEventId}_${Date.now()}.${ext}`;
      const filePath = `panic-audio/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('reports_media')
        .upload(filePath, blob, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Audio upload error:', uploadError);
        return null;
      }

      // Store path in DB (AudioPlayer will generate signed URL)
      return filePath;
    } catch (error) {
      console.error('Failed to upload audio:', error);
      return null;
    }
  };

  // Send the alert with all context
  const handleSendAlert = async () => {
    if (!selectedType || !selectedOption) return;

    let lat: number | undefined;
    let lng: number | undefined;

    // Check if using remote location
    if (useRemoteLocation) {
      const parsedLat = parseFloat(remoteLat);
      const parsedLng = parseFloat(remoteLng);
      
      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        toast.error('Coordenadas inválidas', {
          description: 'Ingresa latitud y longitud válidas para la ubicación remota',
        });
        return;
      }
      
      if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
        toast.error('Coordenadas fuera de rango', {
          description: 'Latitud: -90 a 90, Longitud: -180 a 180',
        });
        return;
      }

      lat = parsedLat;
      lng = parsedLng;
      
      // Add remote address to message if provided
      if (remoteAddress.trim()) {
        const addressPrefix = `📍 Ubicación reportada: ${remoteAddress.trim()}\n\n`;
        setMessage(prev => addressPrefix + prev);
      }
    } else {
      // Use current GPS location
      setIsGettingLocation(true);
      vibrate([200, 100, 200, 100, 300]); // SOS-style pattern

      lat = position?.lat;
      lng = position?.lng;

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
    }

    // Upload audio if present
    let audioUrl: string | undefined;
    if (audioBlob) {
      setIsUploadingAudio(true);
      const tempId = `temp_${Date.now()}`;
      audioUrl = await uploadAudio(audioBlob, tempId) || undefined;
      setIsUploadingAudio(false);
    }

    // Request notification permission to receive messages from responders
    requestNotificationPermission().then(granted => {
      if (granted) {
        console.log('[PanicButton] Notification permission granted for alert creator');
      }
    });

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

      <div className="px-4 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Remote location toggle */}
        <div className="p-3 rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className={cn(
                "w-4 h-4",
                useRemoteLocation ? "text-warning" : "text-muted-foreground"
              )} />
              <div>
                <Label htmlFor="remote-location" className="text-sm font-medium cursor-pointer">
                  Ubicación remota
                </Label>
                <p className="text-xs text-muted-foreground">
                  Para reportar emergencia de otra persona
                </p>
              </div>
            </div>
            <Switch
              id="remote-location"
              checked={useRemoteLocation}
              onCheckedChange={setUseRemoteLocation}
            />
          </div>
          
          {useRemoteLocation && (
            <div className="space-y-3 pt-2 border-t border-border animate-in slide-in-from-top-2 duration-200">
              {/* Map picker button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMapPicker(true)}
                className="w-full h-12 border-dashed border-2 hover:border-panic/50 hover:bg-panic/5"
              >
                <Map className="w-5 h-5 mr-2 text-panic" />
                <span className="text-foreground">
                  {remoteLat && remoteLng ? 'Cambiar ubicación en mapa' : 'Seleccionar en mapa'}
                </span>
              </Button>

              {/* Show selected location */}
              {remoteLat && remoteLng && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  {remoteAddress && (
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      📍 {remoteAddress}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono">
                    {parseFloat(remoteLat).toFixed(6)}, {parseFloat(remoteLng).toFixed(6)}
                  </p>
                </div>
              )}

              {/* Manual coordinate inputs (collapsed) */}
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                  Ingresar coordenadas manualmente
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Dirección o referencia</Label>
                    <Input
                      value={remoteAddress}
                      onChange={(e) => setRemoteAddress(e.target.value)}
                      placeholder="Ej: Av. Revolución 123, Col. Centro"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Latitud *</Label>
                      <Input
                        type="number"
                        step="any"
                        value={remoteLat}
                        onChange={(e) => setRemoteLat(e.target.value)}
                        placeholder="20.6597"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Longitud *</Label>
                      <Input
                        type="number"
                        step="any"
                        value={remoteLng}
                        onChange={(e) => setRemoteLng(e.target.value)}
                        placeholder="-103.3496"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Voice recorder - MOVED UP for better visibility */}
        <div className="space-y-2 bg-panic/5 p-4 rounded-lg border border-panic/20">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Mic className="w-5 h-5 text-panic" />
            Graba tu mensaje de voz
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Tu voz puede dar contexto importante a los rescatistas
          </p>
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            onClear={handleClearRecording}
            maxDurationMs={30000}
          />
        </div>

        {/* Quick send button */}
        <Button
          onClick={handleSendNow}
          disabled={isProcessing || (useRemoteLocation && (!remoteLat || !remoteLng))}
          className="w-full h-14 bg-panic hover:bg-panic/90 text-white font-semibold text-lg"
        >
          <Send className="w-5 h-5 mr-2" />
          {useRemoteLocation ? 'Enviar alerta (ubicación remota)' : 'Enviar alerta ahora'}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Agrega más contexto (opcional)
            </span>
          </div>
        </div>

        {/* Text message */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            Descripción escrita
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
    <>
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

      {/* Location picker map - rendered outside dialog to avoid z-index issues */}
      <LocationPickerMap
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onLocationSelect={(lat, lng, address) => {
          setRemoteLat(lat.toString());
          setRemoteLng(lng.toString());
          if (address) setRemoteAddress(address);
          toast.success('Ubicación seleccionada');
        }}
        initialLat={remoteLat ? parseFloat(remoteLat) : undefined}
        initialLng={remoteLng ? parseFloat(remoteLng) : undefined}
      />
    </>
  );
};

export default PanicButton;
