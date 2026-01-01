// Privacy Consent and Terms of Service Dialog for COMUNIDAD EX SOS
// Users must accept before sharing location and medical info

import React, { useState, useCallback } from 'react';
import { Shield, MapPin, HeartPulse, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import { cn } from '@/lib/utils';

interface PrivacyConsentDialogProps {
  open: boolean;
  onAccept: (shareLocation: boolean, shareMedicalInfo: boolean) => void;
  onDecline: () => void;
}

export const PrivacyConsentDialog: React.FC<PrivacyConsentDialogProps> = ({
  open,
  onAccept,
  onDecline,
}) => {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [shareLocation, setShareLocation] = useState(true);
  const [shareMedicalInfo, setShareMedicalInfo] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setAcceptedTerms(false);
      setShareLocation(true);
      setShareMedicalInfo(true);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleAccept = useCallback(() => {
    if (isSubmitting) return;
    if (acceptedTerms) {
      setIsSubmitting(true);
      // Small delay to show loading state
      setTimeout(() => {
        onAccept(shareLocation, shareMedicalInfo);
      }, 100);
    }
  }, [acceptedTerms, shareLocation, shareMedicalInfo, onAccept, isSubmitting]);

  const handleLocationToggle = useCallback(() => {
    setShareLocation(prev => !prev);
  }, []);

  const handleMedicalToggle = useCallback(() => {
    setShareMedicalInfo(prev => !prev);
  }, []);

  const handleTermsToggle = useCallback(() => {
    setAcceptedTerms(prev => !prev);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDecline()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Aviso de Privacidad y Términos de Uso
          </DialogTitle>
          <DialogDescription>
            Información sobre el uso de tus datos
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto pr-4 overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="space-y-4 text-sm pb-4">
            {/* Main Notice */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Propósito de la Plataforma
              </h3>
              <p className="text-muted-foreground">
                Comunidad SOS es una plataforma de apoyo voluntario para emergencias.
                Su objetivo es facilitar la comunicación y coordinación entre miembros de la
                comunidad durante situaciones de emergencia, sismos y desastres naturales.
              </p>
            </div>

            {/* Location Sharing */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Compartir Ubicación en Tiempo Real
              </h3>
              <p className="text-muted-foreground mb-3">
                Al activar esta opción, tu ubicación será visible para otros miembros
                verificados de la comunidad. Esta información se utiliza exclusivamente para:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Facilitar la asistencia en caso de emergencia</li>
                <li>Permitir que rescatistas te localicen si solicitas ayuda</li>
                <li>Coordinar respuestas comunitarias ante desastres</li>
              </ul>
            </div>

            {/* Medical Info Sharing */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-safe" />
                Compartir Información Médica de Emergencia
              </h3>
              <p className="text-muted-foreground mb-3">
                Al activar esta opción, tu información médica (tipo de sangre, alergias,
                condiciones médicas) será accesible para rescatistas verificados cuando
                solicites ayuda. Esto permite:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Atención médica más rápida y segura</li>
                <li>Evitar administración de medicamentos que te afecten</li>
                <li>Comunicar tu información vital a servicios de emergencia</li>
              </ul>
            </div>

            {/* Disclaimer */}
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Deslinde de Responsabilidad
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                La plataforma Comunidad SOS y sus creadores no se hacen responsables por:
              </p>
              <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1 ml-2 mt-2">
                <li>El mal uso de la información compartida por terceros</li>
                <li>La precisión o veracidad de la información proporcionada por los usuarios</li>
                <li>Daños derivados de la respuesta o falta de respuesta ante emergencias</li>
                <li>La disponibilidad o funcionamiento continuo de la plataforma</li>
                <li>Las acciones u omisiones de otros miembros de la comunidad</li>
              </ul>
              <p className="text-muted-foreground text-xs mt-3">
                <strong>Al usar esta plataforma, reconoces que:</strong>
              </p>
              <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1 ml-2 mt-1">
                <li>
                  Proporcionas tu información de forma <strong>voluntaria</strong>
                </li>
                <li>
                  La ayuda proporcionada es <strong>voluntaria y sin garantías</strong>
                </li>
                <li>Eres responsable de mantener tu información actualizada</li>
                <li>Puedes desactivar el compartir en cualquier momento desde Configuración</li>
              </ul>
            </div>

            {/* Data Protection */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h3 className="font-semibold text-foreground mb-2">Protección de Datos</h3>
              <p className="text-muted-foreground text-xs">
                Tu información es almacenada de forma segura y solo es accesible para
                usuarios autenticados de la comunidad. No vendemos ni compartimos tu
                información con terceros externos. Puedes solicitar la eliminación de
                tu cuenta y todos tus datos en cualquier momento desde la sección de
                Configuración.
              </p>
            </div>
          </div>
        </div>


        {/* Consent Options */}
        <div className="space-y-3 pt-4 border-t border-border">
          <button 
            type="button"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors w-full text-left",
              shareLocation ? "bg-primary/10 border border-primary/30" : "bg-muted/50 border border-border"
            )}
            onClick={handleLocationToggle}
          >
            <Checkbox 
              checked={shareLocation} 
              className="mt-0.5 pointer-events-none"
              tabIndex={-1}
            />
            <div>
              <p className="font-medium text-sm text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Compartir mi ubicación con la comunidad
              </p>
              <p className="text-xs text-muted-foreground">
                Otros miembros podrán ver tu ubicación en el mapa
              </p>
            </div>
          </button>

          <button 
            type="button"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors w-full text-left",
              shareMedicalInfo ? "bg-safe/10 border border-safe/30" : "bg-muted/50 border border-border"
            )}
            onClick={handleMedicalToggle}
          >
            <Checkbox 
              checked={shareMedicalInfo} 
              className="mt-0.5 pointer-events-none"
              tabIndex={-1}
            />
            <div>
              <p className="font-medium text-sm text-foreground flex items-center gap-2">
                <HeartPulse className="w-4 h-4" />
                Compartir mi información médica con rescatistas
              </p>
              <p className="text-xs text-muted-foreground">
                Visible solo cuando solicites ayuda de emergencia
              </p>
            </div>
          </button>

          <button 
            type="button"
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors w-full text-left",
              acceptedTerms ? "bg-mats-green/10 border border-mats-green/30" : "bg-muted/50 border border-border"
            )}
            onClick={handleTermsToggle}
          >
            <Checkbox 
              checked={acceptedTerms} 
              className="mt-0.5 pointer-events-none"
              tabIndex={-1}
            />
            <div>
              <p className="font-medium text-sm text-foreground">
                Acepto el Aviso de Privacidad y Términos de Uso *
              </p>
              <p className="text-xs text-muted-foreground">
                He leído y entiendo que la información que comparto es voluntaria
              </p>
            </div>
          </button>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDecline}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={!acceptedTerms || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              'Aceptar y Continuar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
