// Seismic Alert Component for COMUNIDAD EX SOS
// Shows alert when earthquake is detected near user's location

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, MapPin, ThermometerSun, CheckCircle, AlertCircle, HelpCircle, Camera, Mic, Edit, Trash2, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDistance, getGoogleMapsLink } from '@/hooks/useLocation';
import { playAlertWithVibration } from '@/lib/alertSound';
import { areEarthquakeSoundsEnabled } from '@/hooks/useAlertSettings';
import type { USGSEarthquake, QuakeIntensity, QuakeDamage, GeoPosition, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MediaCapture } from '@/components/MediaCapture';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { QuakeCheckinMap } from '@/components/QuakeCheckinMap';
import confetti from 'canvas-confetti';

interface ExistingCheckin {
  id: string;
  intensity: number;
  damage_report: string;
  created_at: string;
}

interface SeismicAlertProps {
  earthquake: USGSEarthquake;
  distanceKm: number;
  position: GeoPosition;
  userRole?: UserRole;
  onDismiss: () => void;
  onReported: () => void;
}

export function SeismicAlert({
  earthquake,
  distanceKm,
  position,
  userRole = 'SOS_ACTIVO',
  onDismiss,
  onReported,
}: SeismicAlertProps) {
  const [step, setStep] = useState<'checking' | 'already_reported' | 'community_map' | 'felt' | 'intensity' | 'status' | 'help' | 'success'>('checking');
  const [existingCheckin, setExistingCheckin] = useState<ExistingCheckin | null>(null);
  const [feltIt, setFeltIt] = useState<boolean | null>(null);
  const [intensity, setIntensity] = useState<QuakeIntensity>(4);
  const [status, setStatus] = useState<QuakeDamage>('OK');
  const [helpMessage, setHelpMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDurationMs, setVoiceDurationMs] = useState<number>(0);
  const [isEditing, setIsEditing] = useState(false);
  const [lastReportIntensity, setLastReportIntensity] = useState<number>(4);
  const [lastReportStatus, setLastReportStatus] = useState<string>('OK');
  const { toast } = useToast();

  // Get epicenter coordinates
  const [epicenterLng, epicenterLat] = earthquake.geometry.coordinates;

  // Celebration confetti effect
  const triggerConfetti = useCallback(() => {
    // Fire confetti from both sides
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      origin: { x: 0.2, y: 0.7 },
    });
    fire(0.2, {
      spread: 60,
      origin: { x: 0.8, y: 0.7 },
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      origin: { x: 0.5, y: 0.7 },
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      origin: { x: 0.5, y: 0.7 },
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.7 },
    });
  }, []);

  // Trigger confetti when step changes to success
  useEffect(() => {
    if (step === 'success') {
      triggerConfetti();
      // Also trigger haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
    }
  }, [step, triggerConfetti]);

  // Check if user already reported this earthquake
  useEffect(() => {
    const checkExistingReport = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStep('felt');
          return;
        }

        const { data, error } = await supabase
          .from('quake_checkins')
          .select('id, intensity, damage_report, created_at')
          .eq('user_id', user.id)
          .eq('usgs_event_id', earthquake.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking existing report:', error);
          setStep('felt');
          return;
        }

        if (data) {
          setExistingCheckin(data);
          setIntensity(data.intensity as QuakeIntensity);
          setStatus(data.damage_report as QuakeDamage);
          setStep('already_reported');
        } else {
          setStep('felt');
        }
      } catch (err) {
        console.error('Error checking existing report:', err);
        setStep('felt');
      }
    };

    checkExistingReport();
  }, [earthquake.id]);

  // Play alert sound and vibration when component mounts (if enabled)
  useEffect(() => {
    if (areEarthquakeSoundsEnabled() && step === 'felt') {
      playAlertWithVibration();
    }
  }, [step]);

  const mag = earthquake.properties.mag;
  const place = earthquake.properties.place;
  const distanceStr = formatDistance(distanceKm);

  // Intensity descriptions
  const intensityLabels: Record<number, string> = {
    1: 'No sentido',
    2: 'Apenas perceptible',
    3: 'Débil',
    4: 'Leve',
    5: 'Moderado',
    6: 'Fuerte',
    7: 'Muy fuerte',
    8: 'Severo',
    9: 'Violento',
    10: 'Extremo',
  };

  const handleFelt = (felt: boolean) => {
    setFeltIt(felt);
    if (felt) {
      setStep('intensity');
    } else {
      // Submit "not felt" report and dismiss
      submitReport(false, 1, 'OK');
    }
  };

  const handleIntensityNext = () => {
    setStep('status');
  };

  const handleStatusNext = () => {
    if (status === 'DAMAGE' || status === 'UNSURE') {
      setStep('help');
    } else {
      submitReport(true, intensity, status);
    }
  };

  const submitReport = async (felt: boolean, reportIntensity: QuakeIntensity, reportStatus: QuakeDamage) => {
    setSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Debes iniciar sesión para reportar",
        });
        return;
      }

      let checkinId: string;

      if (isEditing && existingCheckin) {
        // Update existing checkin
        const { error: updateError } = await supabase
          .from('quake_checkins')
          .update({
            intensity: reportIntensity,
            damage_report: reportStatus,
            lat: position.lat,
            lng: position.lng,
          })
          .eq('id', existingCheckin.id);

        if (updateError) {
          console.error('Error updating checkin:', updateError);
          throw updateError;
        }
        checkinId = existingCheckin.id;
      } else {
        // Insert new quake checkin
        const { data: checkinData, error: checkinError } = await supabase
          .from('quake_checkins')
          .insert({
            user_id: user.id,
            usgs_event_id: earthquake.id,
            intensity: reportIntensity,
            damage_report: reportStatus,
            lat: position.lat,
            lng: position.lng,
          })
          .select()
          .single();

        if (checkinError) {
          console.error('Error submitting checkin:', checkinError);
          // Handle unique constraint violation - user already reported
          if (checkinError.code === '23505' || checkinError.message?.includes('unique') || checkinError.message?.includes('duplicate')) {
            toast({
              title: "Ya reportaste este sismo",
              description: "Solo puedes hacer un reporte por sismo. Puedes editar tu reporte existente.",
            });
            // Refresh to get the existing checkin
            const { data: existingData } = await supabase
              .from('quake_checkins')
              .select('id, intensity, damage_report, created_at')
              .eq('user_id', user.id)
              .eq('usgs_event_id', earthquake.id)
              .maybeSingle();
            
            if (existingData) {
              setExistingCheckin(existingData);
              setIntensity(existingData.intensity as QuakeIntensity);
              setStatus(existingData.damage_report as QuakeDamage);
              setStep('already_reported');
            }
            return;
          }
          throw checkinError;
        }
        checkinId = checkinData.id;
      }

      let helpRequestId: string | null = null;

      // If needs help, create help request
      if (reportStatus === 'DAMAGE' || reportStatus === 'UNSURE') {
        const { data: helpData, error: helpError } = await supabase
          .from('help_requests')
          .insert({
            user_id: user.id,
            kind: 'SISMO_AYUDA_14',
            quake_event_id: earthquake.id,
            lat: position.lat,
            lng: position.lng,
            message: helpMessage || `Sismo M${mag.toFixed(1)} - ${reportStatus === 'DAMAGE' ? 'Reporto daños / Ayuda necesaria' : 'No estoy seguro'}`,
          })
          .select()
          .single();

        if (helpError) {
          console.error('Error creating help request:', helpError);
        } else {
          helpRequestId = helpData.id;
          
          // Notify nearby users about damage report
          try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            await fetch(`${supabaseUrl}/functions/v1/notify-quake-damage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lat: position.lat,
                lng: position.lng,
                magnitude: mag,
                place: place,
                intensity: reportIntensity,
                damageReport: reportStatus,
                creatorId: user.id,
              }),
            });
            console.log('Nearby users notified about quake damage');
          } catch (notifyError) {
            console.error('Error notifying nearby users:', notifyError);
          }
        }
      }

      // Upload media files if present
      const reportId = helpRequestId || checkinId;
      const reportType = helpRequestId ? 'help_request' : 'quake_checkin';

      // Upload images
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        const filePath = `${user.id}/${reportType}/${reportId}/image_${i}_${Date.now()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('reports_media')
          .upload(filePath, file, { contentType: file.type });

        if (!uploadError) {
          await supabase.from('report_media').insert({
            report_id: reportId,
            report_type: reportType,
            media_type: 'image',
            mime_type: file.type,
            storage_path: filePath,
          });
        } else {
          console.error('Error uploading image:', uploadError);
        }
      }

      // Upload voice recording if present
      if (voiceBlob) {
        const mimeType = voiceBlob.type || 'audio/webm';
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        const voicePath = `${user.id}/${reportType}/${reportId}/voice_${Date.now()}.${ext}`;

        const { error: voiceUploadError } = await supabase.storage
          .from('reports_media')
          .upload(voicePath, voiceBlob, { contentType: mimeType });

        if (!voiceUploadError) {
          await supabase.from('report_media').insert({
            report_id: reportId,
            report_type: reportType,
            media_type: 'audio',
            mime_type: mimeType,
            storage_path: voicePath,
            duration_ms: voiceDurationMs,
          });
        } else {
          console.error('Error uploading voice:', voiceUploadError);
        }
      }

      // Store last report info for success screen
      setLastReportIntensity(reportIntensity);
      setLastReportStatus(reportStatus);
      
      // Show success screen instead of dismissing
      setStep('success');
      onReported();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar el reporte. Intenta de nuevo.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!existingCheckin) return;
    
    setSubmitting(true);
    try {
      // Note: quake_checkins doesn't allow DELETE per RLS, so we'll just close and show message
      toast({
        title: "ℹ️ Información",
        description: "Los reportes de sismos no se pueden eliminar para mantener la integridad de los datos. Puedes editar tu reporte si necesitas cambiar la información.",
      });
      onDismiss();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReport = () => {
    setIsEditing(true);
    setStep('intensity');
  };

  const handleHelpSubmit = () => {
    submitReport(true, intensity, status);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OK': return 'Todo bien';
      case 'UNSURE': return 'No estoy seguro';
      case 'DAMAGE': return 'Daños reportados';
      default: return status;
    }
  };

  return (
    <Dialog open onOpenChange={() => onDismiss()}>
      <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            ¡ALERTA SÍSMICA!
          </DialogTitle>
        </DialogHeader>

        {/* Earthquake info */}
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl font-bold text-destructive">M{mag.toFixed(1)}</span>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{distanceStr} de ti</span>
            </div>
          </div>
          <p className="text-sm text-foreground">{place}</p>
        </div>

        {/* Step: Checking existing report */}
        {step === 'checking' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground text-sm">Verificando reportes anteriores...</p>
          </div>
        )}

        {/* Step: Already reported */}
        {step === 'already_reported' && existingCheckin && (
          <div className="space-y-4">
            {/* Thank you message */}
            <div className="bg-safe/10 border border-safe/30 rounded-lg p-4 text-center">
              <CheckCircle className="w-12 h-12 text-safe mx-auto mb-2" />
              <p className="text-lg font-semibold text-safe">¡Gracias por tu reporte!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ya reportaste este sismo
              </p>
            </div>

            {/* Current report summary */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Tu reporte actual:</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Intensidad:</span>
                <span className="font-semibold text-primary">{existingCheckin.intensity}/10</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estado:</span>
                <span className={cn(
                  "font-semibold",
                  existingCheckin.damage_report === 'OK' && "text-safe",
                  existingCheckin.damage_report === 'UNSURE' && "text-warning",
                  existingCheckin.damage_report === 'DAMAGE' && "text-destructive"
                )}>
                  {getStatusLabel(existingCheckin.damage_report)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                ¿Qué deseas hacer?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleEditReport}
                  className="flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep('community_map')}
                  className="flex items-center gap-2"
                >
                  <Map className="w-4 h-4" />
                  Ver mapa
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={onDismiss}
                className="w-full flex items-center gap-2 justify-center"
              >
                <CheckCircle className="w-4 h-4" />
                Cerrar
              </Button>
            </div>
          </div>
        )}

        {/* Step: Community Map */}
        {step === 'community_map' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Reportes de la comunidad</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('already_reported')}
                className="h-8"
              >
                ← Volver
              </Button>
            </div>
            
            <QuakeCheckinMap
              eventId={earthquake.id}
              epicenterLat={epicenterLat}
              epicenterLng={epicenterLng}
              magnitude={earthquake.properties.mag}
            />
            
            <Button
              variant="outline"
              onClick={onDismiss}
              className="w-full"
            >
              Cerrar
            </Button>
          </div>
        )}

        {/* Step: Success - after submitting report */}
        {step === 'success' && (
          <div className="space-y-4">
            {/* Success message */}
            <div className="bg-safe/10 border border-safe/30 rounded-lg p-4 text-center">
              <CheckCircle className="w-12 h-12 text-safe mx-auto mb-2" />
              <p className="text-lg font-semibold text-safe">
                {isEditing ? '¡Reporte actualizado!' : '¡Gracias por tu reporte!'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Tu información ayuda a la comunidad
              </p>
            </div>

            {/* Report summary */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Tu reporte:</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Intensidad:</span>
                <span className="font-semibold text-primary">{lastReportIntensity}/10</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estado:</span>
                <span className={cn(
                  "font-semibold",
                  lastReportStatus === 'OK' && "text-safe",
                  lastReportStatus === 'UNSURE' && "text-warning",
                  lastReportStatus === 'DAMAGE' && "text-destructive"
                )}>
                  {getStatusLabel(lastReportStatus)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => setStep('community_map')}
                className="w-full flex items-center gap-2 justify-center"
              >
                <Map className="w-4 h-4" />
                Ver reportes de la comunidad
              </Button>
              <Button
                variant="default"
                onClick={onDismiss}
                className="w-full"
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}

        {/* Step: Did you feel it? */}
        {step === 'felt' && (
          <div className="space-y-4">
            <p className="text-center text-lg font-medium text-foreground">
              ¿Sentiste el sismo?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                size="lg"
                className="h-24 flex flex-col gap-2"
                onClick={() => handleFelt(false)}
              >
                <span className="text-3xl">🙅</span>
                <span>No lo sentí</span>
              </Button>
              <Button
                variant="default"
                size="lg"
                className="h-24 flex flex-col gap-2 bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={() => handleFelt(true)}
              >
                <span className="text-3xl">😰</span>
                <span>Sí, lo sentí</span>
              </Button>
            </div>
            
            {/* Confirm received button */}
            <Button
              variant="ghost"
              onClick={onDismiss}
              className="w-full flex items-center gap-2 justify-center text-muted-foreground hover:text-foreground"
            >
              <CheckCircle className="w-4 h-4" />
              Confirmar Recibido
            </Button>
          </div>
        )}

        {/* Step: Intensity */}
        {step === 'intensity' && (
          <div className="space-y-6">
            <p className="text-center text-lg font-medium text-foreground">
              ¿Qué tan fuerte lo sentiste?
            </p>
            
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-5xl font-bold text-primary">{intensity}</span>
                <span className="text-2xl text-muted-foreground">/10</span>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {intensityLabels[intensity]}
              </p>
              <Slider
                value={[intensity]}
                onValueChange={(v) => setIntensity(v[0] as QuakeIntensity)}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>1 - Leve</span>
                <span>10 - Extremo</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setIntensity(4); setStatus('OK'); submitReport(true, 4, 'OK'); }}
                disabled={submitting}
              >
                Todo bien (Rápido)
              </Button>
              <Button
                onClick={handleIntensityNext}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step: Status */}
        {step === 'status' && (
          <div className="space-y-6">
            <p className="text-center text-lg font-medium text-foreground">
              ¿Estás bien? ¿Necesitas ayuda?
            </p>

            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as QuakeDamage)}
              className="space-y-3"
            >
              <div className={cn(
                "flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer",
                status === 'OK' 
                  ? "border-safe bg-safe/10" 
                  : "border-border hover:border-muted-foreground"
              )}>
                <RadioGroupItem value="OK" id="ok" />
                <Label htmlFor="ok" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CheckCircle className="w-5 h-5 text-safe" />
                  <div>
                    <div className="font-medium">Estoy bien</div>
                    <div className="text-xs text-muted-foreground">Sin daños ni lesiones</div>
                  </div>
                </Label>
              </div>

              <div className={cn(
                "flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer",
                status === 'UNSURE' 
                  ? "border-warning bg-warning/10" 
                  : "border-border hover:border-muted-foreground"
              )}>
                <RadioGroupItem value="UNSURE" id="unsure" />
                <Label htmlFor="unsure" className="flex items-center gap-2 cursor-pointer flex-1">
                  <HelpCircle className="w-5 h-5 text-warning" />
                  <div>
                    <div className="font-medium">No estoy seguro</div>
                    <div className="text-xs text-muted-foreground">Verificando daños</div>
                  </div>
                </Label>
              </div>

              <div className={cn(
                "flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer",
                status === 'DAMAGE' 
                  ? "border-destructive bg-destructive/10" 
                  : "border-border hover:border-muted-foreground"
              )}>
                <RadioGroupItem value="DAMAGE" id="damage" />
                <Label htmlFor="damage" className="flex items-center gap-2 cursor-pointer flex-1">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <div>
                    <div className="font-medium">Reporto Daños / Ayuda Necesaria</div>
                    <div className="text-xs text-muted-foreground">Hay daños o lesiones</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <Button
              className="w-full"
              onClick={handleStatusNext}
              disabled={submitting}
            >
              {status === 'OK' ? 'Enviar reporte' : 'Continuar'}
            </Button>
          </div>
        )}

        {/* Step: Help details */}
        {step === 'help' && (
          <div className="space-y-4">
            {userRole === 'FAMILIAR' && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
                ⚠️ FAMILIAR – NO PARAMÉDICO
              </div>
            )}

            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-center">
              <p className="text-destructive font-bold">🆘 Reporto Daños / Ayuda Necesaria</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tu ubicación será compartida con la comunidad
              </p>
            </div>

            {/* Tabs for different input types */}
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text" className="text-xs">
                  Texto
                </TabsTrigger>
                <TabsTrigger value="photo" className="text-xs flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  Foto
                </TabsTrigger>
                <TabsTrigger value="voice" className="text-xs flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  Voz
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-4">
                <div>
                  <Label htmlFor="help-message" className="text-sm font-medium">
                    Describe la situación (opcional)
                  </Label>
                  <Textarea
                    id="help-message"
                    value={helpMessage}
                    onChange={(e) => setHelpMessage(e.target.value)}
                    placeholder="Ej: Atrapado, lesión en pierna, edificio dañado..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="photo" className="mt-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Fotos de daños (opcional)
                  </Label>
                  <MediaCapture
                    onImagesSelected={setMediaFiles}
                    maxImages={3}
                  />
                  {mediaFiles.length > 0 && (
                    <p className="text-xs text-safe text-center">
                      ✓ {mediaFiles.length} foto(s) lista(s) para enviar
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="voice" className="mt-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Nota de voz (opcional)
                  </Label>
                  <VoiceRecorder
                    onRecordingComplete={(blob, durationMs) => {
                      setVoiceBlob(blob);
                      setVoiceDurationMs(durationMs);
                    }}
                    onClear={() => {
                      setVoiceBlob(null);
                      setVoiceDurationMs(0);
                    }}
                    maxDurationMs={30000}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Summary of attachments */}
            {(mediaFiles.length > 0 || voiceBlob) && (
              <div className="bg-muted/50 rounded-lg p-2 text-xs text-muted-foreground flex items-center gap-2 justify-center flex-wrap">
                <span>Adjuntos:</span>
                {mediaFiles.length > 0 && (
                  <span className="flex items-center gap-1 bg-background px-2 py-0.5 rounded">
                    <Camera className="w-3 h-3" /> {mediaFiles.length} foto(s)
                  </span>
                )}
                {voiceBlob && (
                  <span className="flex items-center gap-1 bg-background px-2 py-0.5 rounded">
                    <Mic className="w-3 h-3" /> Nota de voz
                  </span>
                )}
              </div>
            )}

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleHelpSubmit}
              disabled={submitting}
            >
              {submitting ? 'Enviando...' : '🆘 Enviar Reporte de Daños'}
            </Button>
          </div>
        )}

        {/* Quick dismiss option */}
        {step === 'felt' && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onDismiss}
          >
            Cerrar sin reportar
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SeismicAlert;
