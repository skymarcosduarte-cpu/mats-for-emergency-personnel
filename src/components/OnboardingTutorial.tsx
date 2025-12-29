// Onboarding Tutorial Component for COMUNIDAD EX SOS
// Shows key features to new users after registration

import React, { useState } from 'react';
import { 
  Shield, 
  MapPin, 
  Bell, 
  Car, 
  Users, 
  ChevronRight, 
  ChevronLeft,
  Check,
  AlertTriangle,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatsLogo } from '@/components/MatsLogo';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
  color: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    icon: <Heart className="w-12 h-12" />,
    title: '¡Bienvenido a la Comunidad!',
    description: 'M.A.T.S. es tu red de apoyo y seguridad. Conecta con rescatistas, recibe alertas y mantente seguro junto a tu comunidad.',
    tip: 'Esta app funciona mejor instalada en tu teléfono',
    color: 'text-primary',
  },
  {
    icon: <AlertTriangle className="w-12 h-12" />,
    title: 'Botón de Pánico SOS',
    description: 'En caso de emergencia, presiona el botón SOS en la esquina superior. Envía tu ubicación exacta a rescatistas cercanos y tus contactos de emergencia.',
    tip: 'Configura tus contactos de emergencia en Configuración',
    color: 'text-panic',
  },
  {
    icon: <MapPin className="w-12 h-12" />,
    title: 'Mapa en Tiempo Real',
    description: 'Visualiza la ubicación de todos los miembros de la comunidad. Ve quién está cerca y disponible para ayudar.',
    tip: 'Mantén tu ubicación activa para que otros puedan encontrarte',
    color: 'text-primary',
  },
  {
    icon: <Bell className="w-12 h-12" />,
    title: 'Alertas Sísmicas',
    description: 'Recibe notificaciones de sismos cercanos automáticamente. Después de un sismo, reporta que estás bien con "Todo bien" o solicita ayuda con "14".',
    tip: 'Activa las notificaciones para no perderte ninguna alerta',
    color: 'text-warning',
  },
  {
    icon: <Car className="w-12 h-12" />,
    title: 'Registro de Tránsito',
    description: 'Cuando viajes, registra tu ruta para que tu comunidad sepa dónde estás. Ideal para viajes largos o en carretera.',
    tip: 'También puedes reportar incidentes viales',
    color: 'text-accent',
  },
  {
    icon: <Users className="w-12 h-12" />,
    title: 'Tu Comunidad',
    description: 'Participa en eventos, celebra cumpleaños de miembros y mantente conectado. Juntos somos más fuertes.',
    tip: '¡Ya eres parte de la familia!',
    color: 'text-safe',
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

        <span className="text-sm text-muted-foreground">
          {currentStep + 1} / {ONBOARDING_STEPS.length}
        </span>

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
