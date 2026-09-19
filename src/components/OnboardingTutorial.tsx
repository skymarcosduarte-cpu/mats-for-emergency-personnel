// Tutorial inicial de M.A.T.S. for Emergency Personnel
// Shows key features to new users after registration

import React, { useState } from 'react';
import { 
  Shield, 
  MapPin, 
  Bell, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Radio,
  Heart,
  Activity,
  HeartPulse,
  Radar,
  Settings

} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatsLogo } from '@/components/MatsLogo';
import { GuidePdfButton } from '@/components/GuidePdfButton';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
  color: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    icon: <Heart className="w-12 h-12" />,
    title: 'M.A.T.S. for Emergency Personnel',
    description: 'Maximum Aid Tracking Service reúne herramientas para personal de protección civil y cuerpos de emergencia.',
    tip: 'La barra inferior ofrece acceso rápido a Inicio, Mapa y Ajustes',
    color: 'text-primary',
  },
  {
    icon: <Activity className="w-12 h-12" />,
    title: 'Sismos',
    description: 'Consulta los últimos sismos registrados, revisa su magnitud y distancia, e informa tu estado después de un evento.',
    tip: 'Activa las notificaciones sísmicas en Ajustes',
    color: 'text-warning',
  },
  {
    icon: <MapPin className="w-12 h-12" />,
    title: 'Mapa',
    description: 'Consulta tu ubicación, personal activo, emergencias y capas de riesgo disponibles en un solo mapa.',
    tip: 'Activa el GPS y decide en Ajustes cuándo compartir tu ubicación',
    color: 'text-primary',
  },
  {
    icon: <HeartPulse className="w-12 h-12" />,
    title: 'RecurSOS',
    description: 'Consulta el Directorio de Protección Civil y Cruz Roja, además de guías prácticas de emergencia.',
    tip: 'El directorio permanece disponible sin conexión',
    color: 'text-panic',
  },
  {
    icon: <Radio className="w-12 h-12" />,
    title: 'Red Mesh',
    description: 'Envía avisos vía Mesh sin wifi ni red telefónica, usando solo Bluetooth disponible entre teléfonos cercanos.',
    tip: 'Mantén Bluetooth encendido para enviar y retransmitir mensajes',
    color: 'text-primary',
  },
  {
    icon: <Radar className="w-12 h-12" />,
    title: 'Detector de Señales',
    description: 'Busca dispositivos Bluetooth activos y registra indicios por sectores mientras recorres una zona de desastre.',
    tip: 'Activa GPS, usa la guía sonora y completa dos pasadas',
    color: 'text-primary',
  },
  {
    icon: <Settings className="w-12 h-12" />,
    title: 'Ajustes',
    description: 'Actualiza tu perfil, especialidad y datos de contacto; controla ubicación, notificaciones y versión de la app.',
    tip: 'Revisa tus permisos antes de iniciar una operación',
    color: 'text-muted-foreground',
  },
];

interface OnboardingTutorialProps {
  onComplete: () => void;
  userName?: string;
}

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ 
  onComplete,
  userName 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const step = ONBOARDING_STEPS[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      // Mark onboarding as complete in localStorage
      localStorage.setItem('onboarding-complete', 'true');
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding-complete', 'true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-background flex flex-col">
      {/* Header with skip button */}
      <div className="flex items-center justify-between p-4">
        <MatsLogo size={32} />
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          Omitir
        </Button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 px-4 py-2">
        {ONBOARDING_STEPS.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentStep(index)}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              index === currentStep 
                ? 'w-8 bg-primary' 
                : index < currentStep 
                  ? 'bg-primary/50' 
                  : 'bg-muted'
            )}
            aria-label={`Ir al paso ${index + 1}`}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        {/* Icon with animated background */}
        <div className={cn(
          'relative mb-8 p-6 rounded-full',
          'bg-gradient-to-br from-card to-muted',
          'shadow-lg'
        )}>
          <div className={cn(step.color, 'animate-scale-in')}>
            {step.icon}
          </div>
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping opacity-30" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-4 animate-fade-in">
          {currentStep === 0 && userName ? `¡Hola ${userName}!` : step.title}
        </h1>

        {/* Description */}
        <p className="text-muted-foreground text-lg max-w-md mb-6 animate-fade-in">
          {step.description}
        </p>

        {/* Tip box */}
        {step.tip && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 max-w-sm animate-fade-in">
            <p className="text-sm text-primary">
              💡 {step.tip}
            </p>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div
        className="p-6 border-t border-border bg-background flex items-center justify-between gap-4"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className={cn(currentStep === 0 && 'invisible')}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Anterior
        </Button>

        <div className="flex flex-col items-center gap-1">
          <GuidePdfButton variant="ghost" label="Guía PDF" />
          <span className="text-sm text-muted-foreground">
            {currentStep + 1} / {ONBOARDING_STEPS.length}
          </span>
        </div>


        <Button onClick={handleNext}>
          {isLastStep ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              ¡Empezar!
            </>
          ) : (
            <>
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
