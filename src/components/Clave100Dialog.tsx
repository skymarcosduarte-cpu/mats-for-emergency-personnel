import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Send, Shield, Users, X, MapPin, Loader2, Camera, Mic, Image as ImageIcon, Trash2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { compressImages, isValidImageType } from '@/lib/imageCompress';
import { createAudioRecorder, formatDuration, AUDIO_LIMITS, supportsAudioRecording } from '@/lib/audioUtils';

interface Clave100DialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Clave100Dialog: React.FC<Clave100DialogProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'initial' | 'compose' | 'sending'>('initial');
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState<number | null>(null);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Media state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<ReturnType<typeof createAudioRecorder> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch active users count and location when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchActiveUsersCount();
      fetchCurrentLocation();
      setStep('initial');
      setMessage('');
      setConfirmed(false);
      setDisclosureOpen(false);
      setIncludeLocation(true);
      setLocationError(null);
      setImageFile(null);
      setImagePreview(null);
      setAudioBlob(null);
      setAudioDuration(0);
      setIsRecording(false);
      setRecordingDuration(0);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.destroy();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('GPS no disponible');
      setIncludeLocation(false);
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setLocationError('No se pudo obtener ubicación');
        setIncludeLocation(false);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fetchActiveUsersCount = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('user_locations')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true)
        .gte('updated_at', fiveMinutesAgo);

      if (!error) {
        setActiveUsersCount(count || 0);
      }
    } catch (err) {
      console.error('Error fetching active users count:', err);
    }
  };

  // Image handling
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageType(file)) {
      toast.error('Solo se permiten imágenes (JPG, PNG, WebP)');
      return;
    }

    try {
      const { results, errors } = await compressImages([file]);
      if (errors.length > 0) {
        toast.error(errors[0].error);
        return;
      }
      if (results.length > 0) {
        setImageFile(results[0].file);
        setImagePreview(URL.createObjectURL(results[0].file));
      }
    } catch (err) {
      toast.error('Error al procesar la imagen');
    }
    
    // Reset input
    e.target.value = '';
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Audio recording
  const startRecording = async () => {
    if (!supportsAudioRecording()) {
      toast.error('Tu navegador no soporta grabación de audio');
      return;
    }

    recorderRef.current = createAudioRecorder((state) => {
      if (state.blob) {
        setAudioBlob(state.blob);
        setAudioDuration(state.duration);
        setIsRecording(false);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
      }
      if (state.error) {
        toast.error(state.error);
        setIsRecording(false);
      }
    });

    await recorderRef.current.start();
    setIsRecording(true);
    setRecordingDuration(0);
    
    // Start timer
    recordingIntervalRef.current = setInterval(() => {
      setRecordingDuration(prev => {
        const next = prev + 100;
        if (next >= AUDIO_LIMITS.MAX_DURATION_MS) {
          stopRecording();
        }
        return next;
      });
    }, 100);
  };

  const stopRecording = async () => {
    if (recorderRef.current) {
      await recorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
  };

  const removeAudio = () => {
    if (recorderRef.current) {
      recorderRef.current.destroy();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setAudioBlob(null);
    setAudioDuration(0);
    setIsPlayingAudio(false);
  };

  const toggleAudioPlayback = () => {
    if (!audioBlob) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(URL.createObjectURL(audioBlob));
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

  const handleConfirmEmergency = () => {
    if (!confirmed) {
      toast.error('Debes confirmar que es una emergencia real');
      return;
    }
    setStep('compose');
  };

  const uploadMedia = async (): Promise<{ imageUrl: string | null; audioUrl: string | null }> => {
    let imageUrl: string | null = null;
    let audioUrl: string | null = null;

    if (imageFile) {
      const fileName = `clave100/${user?.id}/${Date.now()}_image.jpg`;
      const { data, error } = await supabase.storage
        .from('reports_media')
        .upload(fileName, imageFile, { contentType: imageFile.type });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('reports_media')
        .getPublicUrl(fileName);
      
      imageUrl = urlData.publicUrl;
    }

    if (audioBlob) {
      const fileName = `clave100/${user?.id}/${Date.now()}_audio.webm`;
      const { data, error } = await supabase.storage
        .from('reports_media')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('reports_media')
        .getPublicUrl(fileName);
      
      audioUrl = urlData.publicUrl;
    }

    return { imageUrl, audioUrl };
  };

  const handleSendBroadcast = async () => {
    if (!user?.id || !message.trim()) {
      toast.error('Escribe un mensaje para enviar');
      return;
    }

    setStep('sending');

    try {
      // Upload media first if present
      setUploadingMedia(true);
      const { imageUrl, audioUrl } = await uploadMedia();
      setUploadingMedia(false);

      // Get all active users (excluding current user)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: activeUsers, error: usersError } = await supabase
        .from('user_locations')
        .select('user_id')
        .eq('is_online', true)
        .gte('updated_at', fiveMinutesAgo)
        .neq('user_id', user.id);

      if (usersError) throw usersError;

      if (!activeUsers || activeUsers.length === 0) {
        toast.error('No hay usuarios activos para notificar');
        setStep('compose');
        return;
      }

      // Create messages for all active users
      let broadcastMessage = `🚨 CLAVE 100 - EMERGENCIA MÁXIMA 🚨\n\n${message.trim()}`;
      
      // Add location if enabled and available
      if (includeLocation && currentLocation) {
        const mapsUrl = `https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`;
        broadcastMessage += `\n\n📍 Mi ubicación:\n${mapsUrl}`;
      }
      
      const messagesToInsert = activeUsers.map(u => ({
        sender_id: user.id,
        receiver_id: u.user_id,
        message: broadcastMessage,
        read: false,
        image_url: imageUrl,
        audio_url: audioUrl,
        audio_duration_ms: audioUrl ? audioDuration : null
      }));

      const { error: insertError } = await supabase
        .from('internal_messages')
        .insert(messagesToInsert);

      if (insertError) throw insertError;

      toast.success(`Mensaje Clave 100 enviado a ${activeUsers.length} usuarios`);
      onClose();
    } catch (error) {
      console.error('Error sending Clave 100 broadcast:', error);
      toast.error('Error al enviar el mensaje');
      setStep('compose');
    }
  };

  const handleClose = () => {
    setStep('initial');
    setMessage('');
    setConfirmed(false);
    removeImage();
    removeAudio();
    onClose();
  };

  const hasMedia = imageFile || audioBlob;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              CLAVE 100
            </AlertDialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <AlertDialogDescription className="text-left">
            Emergencia Máxima - Mensaje a todos los usuarios activos
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageSelect}
        />

        {step === 'initial' && (
          <div className="space-y-4">
            {/* Disclosure */}
            <Collapsible open={disclosureOpen} onOpenChange={setDisclosureOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Información importante</span>
                  </div>
                  <span className="text-xs">{disclosureOpen ? '▲' : '▼'}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm space-y-2">
                  <p className="font-semibold text-destructive">⚠️ ADVERTENCIA</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>Si tienes una emergencia personal utiliza la opción de Alertas</strong>, no mandes Clave 100, esta se usa solo en casos de desastres o siniestros mayores.</li>
                    <li>Esta función es <strong>ÚNICAMENTE</strong> para casos de <strong>verdadera emergencia</strong>.</li>
                    <li>El mensaje será enviado a <strong>TODOS</strong> los usuarios activos en la comunidad.</li>
                    <li>El uso indebido de esta función puede resultar en la suspensión de tu cuenta.</li>
                    <li>Solo utilízala cuando necesites ayuda urgente o alertar sobre una situación de peligro real.</li>
                  </ul>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Active users indicator */}
            {activeUsersCount !== null && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm">
                  <strong>{activeUsersCount}</strong> usuarios activos recibirán tu mensaje
                </span>
              </div>
            )}

            {/* Confirmation checkbox */}
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Checkbox
                id="confirm-emergency"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                className="mt-0.5"
              />
              <label 
                htmlFor="confirm-emergency" 
                className="text-sm cursor-pointer select-none"
              >
                Confirmo que esta es una <strong>EMERGENCIA MAYOR</strong> (desastre o siniestro). Entiendo que para emergencias personales debo usar <strong>Alertas</strong>, y que este mensaje será enviado a <strong>TODOS</strong> los usuarios activos de la comunidad.
              </label>
            </div>

            <Button
              onClick={handleConfirmEmergency}
              disabled={!confirmed}
              className={cn(
                "w-full",
                confirmed 
                  ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Confirmar Emergencia
            </Button>
          </div>
        )}

        {step === 'compose' && (
          <div className="space-y-4">
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Tu mensaje será enviado como CLAVE 100
              </p>
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe la emergencia: ¿Qué sucede? ¿Dónde estás? ¿Qué ayuda necesitas?"
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/500 caracteres
            </p>

            {/* Media attachments section */}
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm font-medium">Adjuntar evidencia (opcional)</p>
              
              {/* Image preview */}
              {imagePreview && (
                <div className="relative w-full">
                  <img 
                    src={imagePreview} 
                    alt="Foto adjunta" 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Audio preview */}
              {audioBlob && (
                <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                  <button
                    onClick={toggleAudioPlayback}
                    className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Nota de voz</p>
                    <p className="text-xs text-muted-foreground">{formatDuration(audioDuration)}</p>
                  </div>
                  <button
                    onClick={removeAudio}
                    className="w-8 h-8 text-muted-foreground hover:text-destructive flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg animate-pulse">
                  <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm font-medium text-destructive">Grabando...</span>
                  <span className="text-sm font-mono">{formatDuration(recordingDuration)}</span>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={stopRecording}
                    className="ml-auto"
                  >
                    Detener
                  </Button>
                </div>
              )}

              {/* Media buttons */}
              {!isRecording && (
                <div className="flex gap-2">
                  {!imagePreview && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex-1"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Cámara
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex-1"
                      >
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Galería
                      </Button>
                    </>
                  )}
                  {!audioBlob && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startRecording}
                      className={cn("flex-1", imagePreview && "w-full")}
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Grabar audio
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Location toggle */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className={cn(
                  "w-5 h-5",
                  includeLocation && currentLocation ? "text-primary" : "text-muted-foreground"
                )} />
                <div>
                  <Label htmlFor="include-location" className="text-sm font-medium cursor-pointer">
                    Incluir mi ubicación GPS
                  </Label>
                  {locationLoading && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Obteniendo ubicación...
                    </p>
                  )}
                  {!locationLoading && currentLocation && (
                    <p className="text-xs text-muted-foreground">
                      📍 Ubicación disponible
                    </p>
                  )}
                  {!locationLoading && locationError && (
                    <p className="text-xs text-destructive">{locationError}</p>
                  )}
                </div>
              </div>
              <Switch
                id="include-location"
                checked={includeLocation}
                onCheckedChange={setIncludeLocation}
                disabled={!currentLocation || locationLoading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('initial')}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendBroadcast}
                disabled={!message.trim() || isRecording}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar Clave 100
              </Button>
            </div>
          </div>
        )}

        {step === 'sending' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-12 h-12 border-4 border-destructive border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground text-center">
              {uploadingMedia ? 'Subiendo archivos...' : 'Enviando mensaje a todos los usuarios...'}
            </p>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};