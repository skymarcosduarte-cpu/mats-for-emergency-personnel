// Seismic Alert Component for COMUNIDAD EX SOS
// Shows alert when earthquake is detected near user's location

import React, { useState } from 'react';
import { AlertTriangle, MapPin, ThermometerSun, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { formatDistance, getGoogleMapsLink } from '@/hooks/useLocation';
import type { USGSEarthquake, QuakeIntensity, QuakeDamage, GeoPosition, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  userRole = 'RESCATISTA',
  onDismiss,
  onReported,
}: SeismicAlertProps) {
  const [step, setStep] = useState<'felt' | 'intensity' | 'status' | 'help'>('felt');
  const [feltIt, setFeltIt] = useState<boolean | null>(null);
  const [intensity, setIntensity] = useState<QuakeIntensity>(4);
  const [status, setStatus] = useState<QuakeDamage>('OK');
  const [helpMessage, setHelpMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

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

      // Insert quake checkin
      const { error: checkinError } = await supabase
        .from('quake_checkins')
        .insert({
          user_id: user.id,
          usgs_event_id: earthquake.id,
          intensity: reportIntensity,
          damage_report: reportStatus,
          lat: position.lat,
          lng: position.lng,
        });

      if (checkinError) {
        console.error('Error submitting checkin:', checkinError);
        throw checkinError;
      }

      // If needs help, create help request
      if (reportStatus === 'DAMAGE' || reportStatus === 'UNSURE') {
        const { error: helpError } = await supabase
          .from('help_requests')
          .insert({
            user_id: user.id,
            kind: 'SISMO_AYUDA_14',
            quake_event_id: earthquake.id,
            lat: position.lat,
            lng: position.lng,
            message: helpMessage || `Sismo M${mag.toFixed(1)} - ${reportStatus === 'DAMAGE' ? 'Necesito ayuda' : 'No estoy seguro'}`,
          });

        if (helpError) {
          console.error('Error creating help request:', helpError);
        }

        // Open WhatsApp with emergency message
        const whatsappMessage = `🆘 AYUDA 14 - SISMO M${mag.toFixed(1)}%0A${userRole === 'FAMILIAR' ? '⚠️ FAMILIAR – NO PARAMÉDICO%0A' : ''}📍 ${getGoogleMapsLink(position.lat, position.lng)}%0AIntensidad percibida: ${reportIntensity}/10%0A${helpMessage ? `Mensaje: ${helpMessage}` : ''}`;
        window.open(`https://wa.me/?text=${whatsappMessage}`, '_blank');
      }

      toast({
        title: felt ? "Reporte enviado" : "Gracias por reportar",
        description: felt 
          ? `Intensidad ${reportIntensity}/10 - ${reportStatus}` 
          : "No sentiste el sismo, tu ubicación ayuda a mapear el evento",
      });

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

  const handleHelpSubmit = () => {
    submitReport(true, intensity, status);
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
                onClick={() => { setIntensity(4); handleIntensityNext(); }}
              >
                4 de 10 (Rápido)
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
                    <div className="font-medium">Necesito ayuda (14)</div>
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
              <p className="text-destructive font-bold">🆘 AYUDA 14</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tu ubicación será compartida con la comunidad
              </p>
            </div>

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

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleHelpSubmit}
              disabled={submitting}
            >
              {submitting ? 'Enviando...' : '🆘 Enviar AYUDA 14'}
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
