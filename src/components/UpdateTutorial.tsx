// Tutorial sencillo para explicar cómo forzar la actualización de la app M.A.T.S.

import React, { useState } from 'react';
import { RefreshCw, CheckCircle, ArrowRight, ArrowLeft, X, Smartphone, Monitor, Globe, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface UpdateTutorialProps {
  onClose: () => void;
}

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  platform: 'all' | 'mobile' | 'desktop';
  steps: string[];
  tip?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Por qué actualizar?',
    description: 'Cada actualización incluye mejoras de seguridad, nuevas funciones y corrección de errores.',
    icon: <RefreshCw className="w-10 h-10 text-primary" />,
    platform: 'all',
    steps: [
      '✅ Acceso a las últimas funciones',
      '✅ Corrección de errores conocidos',
      '✅ Mejoras de rendimiento',
      '✅ Mayor seguridad en emergencias',
    ],
    tip: 'Recomendamos actualizar cada vez que uses la app para asegurar la mejor experiencia.',
  },
  {
    title: 'Actualizar en el Navegador',
    description: 'Si usas M.A.T.S. desde Chrome, Safari, Firefox u otro navegador:',
    icon: <Globe className="w-10 h-10 text-accent" />,
    platform: 'all',
    steps: [
      '1️⃣ Presiona Ctrl + Shift + R (Windows/Linux)',
      '      o Cmd + Shift + R (Mac)',
      '2️⃣ O haz clic derecho → "Recargar" con Shift presionado',
      '3️⃣ Esto fuerza una recarga sin usar caché',
    ],
    tip: 'Si ves un banner de "Nueva versión disponible", toca "Actualizar ahora".',
  },
  {
    title: 'Actualizar en Móvil (PWA)',
    description: 'Si instalaste M.A.T.S. como app en tu celular:',
    icon: <Smartphone className="w-10 h-10 text-safe" />,
    platform: 'mobile',
    steps: [
      '1️⃣ Cierra completamente la app (desliza hacia arriba)',
      '2️⃣ Espera 5 segundos',
      '3️⃣ Vuelve a abrir M.A.T.S.',
      '4️⃣ Si hay actualización, aparecerá un aviso',
    ],
    tip: 'En iPhone: doble clic en botón home o desliza desde abajo, luego cierra la app.',
  },
  {
    title: 'Limpiar Caché (Opción Avanzada)',
    description: 'Si la app no se actualiza con los métodos anteriores:',
    icon: <Trash2 className="w-10 h-10 text-warning" />,
    platform: 'all',
    steps: [
      '1️⃣ Ve a Ajustes del navegador',
      '2️⃣ Busca "Borrar datos de navegación"',
      '3️⃣ Selecciona solo "Imágenes y archivos en caché"',
      '4️⃣ Borra y recarga la página',
    ],
    tip: 'Esto NO borra tus contraseñas ni tu sesión. Solo elimina archivos temporales.',
  },
  {
    title: '¡Listo!',
    description: 'Ya sabes cómo mantener M.A.T.S. actualizada.',
    icon: <CheckCircle className="w-10 h-10 text-safe" />,
    platform: 'all',
    steps: [
      '🎯 Actualiza cada vez que entres a la app',
      '📱 Cierra y abre la app si usas PWA',
      '🔄 Usa Ctrl/Cmd + Shift + R para forzar recarga',
      '💡 Revisa si hay avisos de nueva versión',
    ],
    tip: 'La versión actual aparece en Ajustes → Información de la App.',
  },
];

export const UpdateTutorial: React.FC<UpdateTutorialProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const step = TUTORIAL_STEPS[currentStep];
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirst = currentStep === 0;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-background flex flex-col">
      {/* Header */}
      <header 
        className="flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-sm"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Cómo Actualizar</h1>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Progress indicator */}
      <div className="px-4 py-2 bg-muted/30">
        <div className="flex gap-1">
          {TUTORIAL_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                idx <= currentStep ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Paso {currentStep + 1} de {TUTORIAL_STEPS.length}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
                {step.icon}
              </div>
            </div>

            {/* Title & Description */}
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-foreground">{step.title}</h2>
              <p className="text-muted-foreground">{step.description}</p>
            </div>

            {/* Platform badge */}
            {step.platform !== 'all' && (
              <div className="flex justify-center">
                <span className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  step.platform === 'mobile' ? 'bg-safe/20 text-safe' : 'bg-accent/20 text-accent'
                )}>
                  {step.platform === 'mobile' ? '📱 Móvil' : '🖥️ Escritorio'}
                </span>
              </div>
            )}

            {/* Steps list */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              {step.steps.map((s, idx) => (
                <p key={idx} className="text-foreground text-sm leading-relaxed">
                  {s}
                </p>
              ))}
            </div>

            {/* Tip */}
            {step.tip && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <p className="text-sm text-primary">
                  💡 <strong>Tip:</strong> {step.tip}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer buttons */}
      <footer 
        className="flex gap-3 p-4 border-t border-border bg-card/95"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {!isFirst && (
          <Button
            variant="outline"
            onClick={handlePrev}
            className="flex-1 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </Button>
        )}
        <Button
          onClick={handleNext}
          className={cn(
            'gap-2',
            isFirst ? 'flex-1' : 'flex-1',
            isLast && 'bg-safe hover:bg-safe/90'
          )}
        >
          {isLast ? (
            <>
              <CheckCircle className="w-4 h-4" />
              ¡Entendido!
            </>
          ) : (
            <>
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </footer>
    </div>
  );
};

export default UpdateTutorial;
