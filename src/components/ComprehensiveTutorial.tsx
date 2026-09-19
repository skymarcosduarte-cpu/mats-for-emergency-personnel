// Tutorial operativo de M.A.T.S. for Emergency Personnel
// Compact version with emphasis on key features

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { diagLog } from '@/lib/diagnosticLogger';
import { AlertTriangle, MapPin, Bell, ChevronRight, ChevronLeft, Check, Heart, Shield, X, Radio, Phone, BookOpen, Radar, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatsLogo } from '@/components/MatsLogo';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TutorialSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  steps: TutorialStep[];
}

interface TutorialStep {
  title: string;
  content: React.ReactNode;
  illustration?: React.ReactNode;
  tip?: string;
  important?: boolean;
}

const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    id: 'welcome', title: 'Bienvenida', icon: <Heart className="w-6 h-6" />, color: 'text-primary',
    steps: [{
      title: 'M.A.T.S. for Emergency Personnel',
      content: <div className="space-y-4"><p><strong>Maximum Aid Tracking Service</strong> reúne seis herramientas operativas para personal de protección civil y cuerpos de emergencia.</p><div className="grid grid-cols-2 gap-2 text-sm">{['Sismos', 'Mapa', 'RecurSOS', 'Red Mesh', 'Detector de Señales', 'Ajustes'].map((label) => <div key={label} className="p-2 bg-muted rounded-lg font-medium">{label}</div>)}</div><p className="text-sm text-muted-foreground">Usa Inicio para abrir cada sección. La barra inferior conserva Inicio, Mapa y Ajustes.</p></div>,
      tip: 'Activa ubicación, notificaciones y Bluetooth antes de una operación',
    }],
  },
  {
    id: 'earthquakes', title: 'Sismos', icon: <Bell className="w-6 h-6" />, color: 'text-warning',
    steps: [{
      title: 'Últimos sismos registrados',
      content: <div className="space-y-4"><p>Consulta eventos del <strong>SSN</strong> para México y del <strong>USGS</strong> para el resto del mundo.</p><div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm"><p>Revisa magnitud, ubicación, hora y distancia. Después de un sismo puedes informar que estás bien, registrar la intensidad percibida o solicitar ayuda.</p></div></div>,
      tip: 'Activa las notificaciones sísmicas desde Ajustes',
    }],
  },
  {
    id: 'map', title: 'Mapa', icon: <MapPin className="w-6 h-6" />, color: 'text-primary',
    steps: [{
      title: 'Mapa operativo',
      content: <div className="space-y-4"><p>El mapa muestra tu posición como <strong>“TÚ”</strong>, personal activo que comparte ubicación, emergencias y capas de riesgo disponibles.</p><p className="text-sm text-muted-foreground">Toca los marcadores para consultar detalles y usa el control de capas para elegir la información visible.</p></div>,
      tip: 'Activa Compartir ubicación en Ajustes cuando necesites ser localizado',
    }],
  },
  {
    id: 'resources', title: 'RecurSOS', icon: <Shield className="w-6 h-6" />, color: 'text-destructive',
    steps: [{
      title: 'Directorio y guías',
      content: <div className="space-y-3"><div className="flex gap-3 p-3 bg-destructive/10 rounded-lg"><Phone className="w-5 h-5 text-destructive shrink-0" /><p><strong>Directorio PC y Cruz Roja:</strong> teléfonos, ubicaciones y servicios por país, disponibles también sin conexión.</p></div><div className="flex gap-3 p-3 bg-primary/10 rounded-lg"><BookOpen className="w-5 h-5 text-primary shrink-0" /><p><strong>Guías de Emergencias:</strong> protocolos breves de primeros auxilios, evacuación, seguridad y preparación.</p></div></div>,
      tip: 'Las guías orientan, pero no sustituyen capacitación profesional',
    }],
  },
  {
    id: 'mesh', title: 'Red Mesh', icon: <Radio className="w-6 h-6" />, color: 'text-primary',
    steps: [{
      title: 'Avisos por Bluetooth',
      content: <div className="space-y-4"><p>Avisos vía Mesh sin wifi ni red telefónica, solo Bluetooth disponible.</p><ol className="list-decimal list-inside space-y-2 text-sm"><li>Abre Red Mesh desde Inicio.</li><li>Activa la malla y concede permisos.</li><li>Envía “Estoy bien” o “Necesito ayuda”, con una nota opcional.</li><li>Revisa el buzón y el comprobante de entrega.</li></ol></div>,
      important: true,
      tip: 'Mantén Bluetooth encendido; la función completa requiere la app Android',
    }],
  },
  {
    id: 'detector', title: 'Detector', icon: <Radar className="w-6 h-6" />, color: 'text-primary',
    steps: [{
      title: 'Detector de Señales',
      content: <div className="space-y-4"><p>Busca dispositivos Bluetooth activos para orientar recorridos en zonas de desastre.</p><ol className="list-decimal list-inside space-y-2 text-sm"><li>Activa GPS e inicia la búsqueda.</li><li>Camina lentamente por la cuadrícula A1–C3 siguiendo la marca “TÚ”.</li><li>Usa la guía sonora para reconocer señales más fuertes.</li><li>Repite el recorrido en Paso 2 para confirmar indicios persistentes.</li></ol><div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-xs">No sustituye perros, geófonos ni métodos profesionales de búsqueda.</div></div>,
      tip: 'El concreto y el metal pueden alterar la distancia estimada',
    }],
  },
  {
    id: 'settings', title: 'Ajustes', icon: <Settings className="w-6 h-6" />, color: 'text-muted-foreground',
    steps: [{
      title: 'Perfil y permisos',
      content: <div className="space-y-3"><p>Actualiza tu nombre de usuario, teléfono, país y especialidad. Controla el uso de ubicación y las notificaciones.</p><p className="text-sm text-muted-foreground">También puedes consultar la versión instalada, buscar actualizaciones y volver a abrir esta guía.</p></div>,
      tip: 'Verifica tus datos y permisos antes de iniciar una operación',
    }],
  },
  {
    id: 'finish', title: 'Listo', icon: <Check className="w-6 h-6" />, color: 'text-safe',
    steps: [{
      title: 'Preparación completada',
      content: <div className="space-y-4 text-center"><div className="w-16 h-16 mx-auto rounded-full bg-safe/20 flex items-center justify-center"><Check className="w-8 h-8 text-safe" /></div><p className="font-medium">Ya conoces las seis secciones activas de M.A.T.S.</p><p className="text-sm text-muted-foreground">Mantén la aplicación actualizada y verifica los permisos del teléfono.</p></div>,
    }],
  },
];

interface ComprehensiveTutorialProps {
  onComplete: () => void;
  onClose?: () => void;
}

export const ComprehensiveTutorial: React.FC<ComprehensiveTutorialProps> = ({
  onComplete,
  onClose,
}) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [showTableOfContents, setShowTableOfContents] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const section = TUTORIAL_SECTIONS[currentSection];
  const step = section?.steps[currentStep];
  const totalSteps = TUTORIAL_SECTIONS.reduce((acc, s) => acc + s.steps.length, 0);
  const currentTotalStep = TUTORIAL_SECTIONS.slice(0, currentSection).reduce((acc, s) => acc + s.steps.length, 0) + currentStep + 1;

  const isLastStep = currentSection === TUTORIAL_SECTIONS.length - 1 && 
                     currentStep === section.steps.length - 1;
  const isFirstStep = currentSection === 0 && currentStep === 0;

  const handleNext = useCallback(() => {
    if (currentStep < section.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else if (currentSection < TUTORIAL_SECTIONS.length - 1) {
      setCurrentSection(prev => prev + 1);
      setCurrentStep(0);
    } else {
      // Last step - show disclaimer confirmation
      setShowDisclaimer(true);
    }
  }, [currentSection, currentStep, section?.steps.length]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else if (currentSection > 0) {
      const prevSectionIndex = currentSection - 1;
      setCurrentSection(prevSectionIndex);
      setCurrentStep(TUTORIAL_SECTIONS[prevSectionIndex].steps.length - 1);
    }
  }, [currentSection, currentStep]);

  const handleComplete = async () => {
    // Prevent multiple clicks
    if (isCompleting || isExiting) {
      diagLog.warn('Tutorial', 'handleComplete called while already completing', { isCompleting, isExiting });
      return;
    }
    
    diagLog.buttonClick('Acepto y continúo', 'Tutorial Disclaimer Modal');
    setIsCompleting(true);
    
    // Mark tutorial as completed
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ tutorial_disclaimer_accepted_at: new Date().toISOString() })
          .eq('id', user.id);
        
        if (error) {
          diagLog.error('Tutorial', 'Failed to save tutorial completion', { error: error.message });
        } else {
          diagLog.info('Tutorial', 'Tutorial completion saved to DB');
        }
      }
    } catch (error) {
      diagLog.error('Tutorial', 'Exception saving tutorial completion', { error: String(error) });
      // Continue anyway - don't block the user
    }

    toast.success('¡Bienvenido a M.A.T.S.!', {
      description: 'Ya estás listo para usar la aplicación',
    });

    // Start exit animation FIRST
    diagLog.info('Tutorial', 'Starting exit animation');
    setIsExiting(true);
    setShowDisclaimer(false);
    
    // Fire confetti ONCE after a small delay
    setTimeout(() => {
      diagLog.info('Tutorial', 'Firing confetti');
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        zIndex: 99999,
      });
    }, 100);
    
    // Call onComplete after animation
    setTimeout(() => {
      diagLog.info('Tutorial', 'Calling onComplete callback');
      onComplete();
    }, 400);
  };

  const goToSection = (sectionIndex: number) => {
    diagLog.action('Tutorial', `Navigate to section ${sectionIndex}`, { sectionTitle: TUTORIAL_SECTIONS[sectionIndex]?.title });
    setCurrentSection(sectionIndex);
    setCurrentStep(0);
    setShowTableOfContents(false);
  };

  // Log when disclaimer modal opens
  useEffect(() => {
    if (showDisclaimer) {
      diagLog.dialogOpen('Tutorial Disclaimer');
    }
  }, [showDisclaimer]);

  // Log component mount
  useEffect(() => {
    diagLog.mount('ComprehensiveTutorial');
    return () => diagLog.unmount('ComprehensiveTutorial');
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  if (!section || !step) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <MatsLogo size={32} />
          <div>
            <h2 className="font-semibold text-sm">Tutorial</h2>
            <p className="text-xs text-muted-foreground">{currentTotalStep} de {totalSteps}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTableOfContents(!showTableOfContents)}
            className="text-xs"
          >
            Índice
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(currentTotalStep / totalSteps) * 100}%` }}
        />
      </div>

      {/* Table of Contents Overlay */}
      <AnimatePresence>
        {showTableOfContents && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-0 right-0 bg-background border-b shadow-lg z-10 p-4 max-h-[60vh] overflow-y-auto"
          >
            <h3 className="font-semibold mb-3">Secciones</h3>
            <div className="space-y-2">
              {TUTORIAL_SECTIONS.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => goToSection(idx)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    idx === currentSection 
                      ? "bg-primary/10 border border-primary/30" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <span className={cn("flex-shrink-0", s.color)}>{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.steps.length} paso{s.steps.length > 1 ? 's' : ''}</p>
                  </div>
                  {idx < currentSection && (
                    <Check className="w-4 h-4 text-safe flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content with navigation inside */}
      <div className="flex-1 overflow-y-auto p-4 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentSection}-${currentStep}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-lg mx-auto"
          >
            {/* Section indicator */}
            <div className={cn("flex items-center gap-2 mb-4", section.color)}>
              {section.icon}
              <span className="text-sm font-medium">{section.title}</span>
            </div>

            {/* Step title */}
            <h3 className="text-xl font-bold mb-4">{step.title}</h3>

            {/* Step content */}
            <div className="text-sm leading-relaxed">
              {step.content}
            </div>

            {/* Tip */}
            {step.tip && (
              <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs text-primary">
                  💡 <strong>Tip:</strong> {step.tip}
                </p>
              </div>
            )}

            {/* Navigation buttons - inside content for visibility */}
            <div className="mt-8 pt-6 border-t border-border">
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  disabled={isFirstStep}
                  className="flex items-center gap-2 h-12 px-6"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="font-medium">Anterior</span>
                </Button>

                {/* Section dots */}
                <div className="flex items-center gap-2">
                  {TUTORIAL_SECTIONS.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToSection(idx)}
                      className={cn(
                        "w-3 h-3 rounded-full transition-all",
                        idx === currentSection 
                          ? "bg-primary w-6" 
                          : idx < currentSection 
                            ? "bg-safe" 
                            : "bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>

                <Button
                  onClick={handleNext}
                  className="flex items-center gap-2 h-12 px-6"
                >
                  <span className="font-medium">{isLastStep ? 'Finalizar' : 'Siguiente'}</span>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Disclaimer confirmation modal */}
      {showDisclaimer && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4"
          onClick={(e) => {
            // Only close if clicking the backdrop, not the modal content
            if (e.target === e.currentTarget) {
              setShowDisclaimer(false);
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background rounded-xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Acepto los términos</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6 text-center">
              Al continuar, aceptas que M.A.T.S. es una herramienta de apoyo operativo y que la disponibilidad o precisión de sus datos no garantiza una respuesta de emergencia.
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setShowDisclaimer(false)}
                disabled={isCompleting}
              >
                Volver
              </Button>
              <Button
                className="flex-1 h-12"
                onClick={handleComplete}
                disabled={isCompleting}
              >
                {isCompleting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </span>
                ) : (
                  'Acepto y continúo'
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
