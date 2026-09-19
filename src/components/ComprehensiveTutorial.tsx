// Comprehensive Tutorial Component for COMUNIDAD EX SOS / M.A.T.S.
// Compact version with emphasis on key features

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { diagLog } from '@/lib/diagnosticLogger';
import { 
  AlertTriangle, 
  MapPin, 
  Bell, 
  Car, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Heart,
  Shield,
  Ambulance,
  Siren,
  Lock,
  X,
  Radio,
  Flame,
  Users,
  Video,
  Phone,
  BookOpen
} from 'lucide-react';
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
    id: 'welcome',
    title: 'Bienvenida',
    icon: <Heart className="w-6 h-6" />,
    color: 'text-primary',
    steps: [
      {
        title: '¡Bienvenido a M.A.T.S.!',
        content: (
          <div className="space-y-4">
            <p className="text-lg">
              <strong>M.A.T.S.</strong> (Mutual Aid Tracking System) es tu app de <strong>apoyo mutuo y seguridad comunitaria</strong>.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <Siren className="w-4 h-4 text-panic flex-shrink-0" />
                <span>Alertas SOS</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Mapa en vivo</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <Bell className="w-4 h-4 text-warning flex-shrink-0" />
                <span>Alertas sísmicas</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <Car className="w-4 h-4 text-accent flex-shrink-0" />
                <span>Viajes seguros</span>
              </div>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm text-primary">
                🤝 Esta NO es una app de seguridad privada. Es una <strong>comunidad</strong> donde nos cuidamos entre todos.
              </p>
            </div>
          </div>
        ),
        tip: 'Instala la app en tu teléfono para recibir alertas incluso con la pantalla apagada',
      },
    ],
  },
  {
    id: 'emergency',
    title: 'Emergencias',
    icon: <AlertTriangle className="w-6 h-6" />,
    color: 'text-panic',
    steps: [
      {
        title: '🆘 Botón SOS y Clave 100',
        content: (
          <div className="space-y-4">
            <p>
              El <strong>Botón SOS</strong> (esquina superior derecha) envía tu ubicación a rescatistas cercanos.
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-panic/10 rounded-lg border border-panic/30">
                <Siren className="w-5 h-5 text-panic mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-panic">SOS / Ambulancia</p>
                  <p className="text-xs text-muted-foreground">Para emergencias personales</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive">CLAVE 100</p>
                  <p className="text-xs text-muted-foreground">Solo para desastres mayores (alerta a TODOS)</p>
                </div>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-sm">
              <strong>Cuando alguien pide ayuda:</strong> Presiona "Voy en camino" y la persona verá tu ubicación en tiempo real.
            </div>
          </div>
        ),
        important: true,
      },
      {
        title: '🎥 Grabación de Emergencia',
        content: (
          <div className="space-y-4">
            <p>
              El botón de <strong>cámara con glow rojo</strong> permite grabar video en vivo durante emergencias.
            </p>
            <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <Video className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">Transmisión en Vivo</p>
                <p className="text-xs text-muted-foreground">Clips de 15 seg automáticos al chat comunitario</p>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-xs space-y-1">
              <p>• Se notifica a tus contactos de emergencia</p>
              <p>• Incluye tu ubicación GPS</p>
              <p>• Videos disponibles por 7 días</p>
              <p>• SOLO tú puedes borrar tus videos</p>
            </div>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-2 text-xs">
              <p className="font-medium text-warning">⚠️ Solo para emergencias reales. El mal uso causa BAJA de la red.</p>
            </div>
          </div>
        ),
        tip: 'El ícono es pequeño a propósito para grabar discretamente',
      },
    ],
  },
  {
    id: 'map',
    title: 'Mapa',
    icon: <MapPin className="w-6 h-6" />,
    color: 'text-primary',
    steps: [
      {
        title: '🗺️ Mapa unificado de Comunidad',
        content: (
          <div className="space-y-4">
            <p>
              Ahora hay <strong>un solo mapa</strong>: la antigua vista "En Vivo" se integró al Mapa de Comunidad.
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/30">
                <Users className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-primary">Personas y viajes</p>
                  <p className="text-xs text-muted-foreground">Miembros con apodo y nombre completo, alertas SOS, rescatistas en camino y viajes activos</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/30">
                <Flame className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-warning">Eventos de riesgo</p>
                  <p className="text-xs text-muted-foreground">Incendios NASA FIRMS, ciclones, clima por punto y reportes de carretera</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs">
              <p className="font-medium text-blue-600">Se eliminaron las capas inestables (las que mostraban "zoom no soportado") para un mapa más rápido.</p>
            </div>
          </div>
        ),
        tip: 'Toca cualquier marcador para ver más detalles del evento o miembro',
      },

    ],
  },
  {
    id: 'alerts',
    title: 'Alertas',
    icon: <Bell className="w-6 h-6" />,
    color: 'text-warning',
    steps: [
      {
        title: '🔔 Alertas Sísmicas',
        content: (
          <div className="space-y-4">
            <p>
              La app detecta <strong>sismos cercanos</strong> automáticamente usando datos del USGS y SSN (México).
            </p>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
              <p className="font-medium text-warning text-sm mb-2">Cuando hay un sismo:</p>
              <ol className="text-xs space-y-1 list-decimal list-inside">
                <li>Recibes notificación con sonido y vibración</li>
                <li>Ves magnitud, distancia y ubicación</li>
                <li>Reportas: "¿Estás bien?" y la intensidad percibida</li>
                <li>Puedes cerrar cada aviso con la ✕ después de leerlo</li>
              </ol>
            </div>
            <p className="text-xs text-muted-foreground">
              Configura el radio de detección (20-400km) en <strong>Ajustes → Alertas</strong>.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'mesh',
    title: 'Red Mesh',
    icon: <Radio className="w-6 h-6" />,
    color: 'text-primary',
    steps: [
      {
        title: '📶 Red Mesh Bluetooth (sin internet)',
        content: (
          <div className="space-y-4">
            <p>
              <strong>Nuevo:</strong> comunicación de emergencia por Bluetooth cuando no hay internet ni señal celular.
            </p>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-xs space-y-1">
              <p>• Los teléfonos cercanos retransmiten los mensajes formando una malla.</p>
              <p>• Las alertas <strong>SOS tienen prioridad</strong> y viajan firmadas y verificadas.</p>
              <p>• Entra desde el botón morado <strong>"Red Mesh"</strong> en Inicio y actívala.</p>
            </div>
            <p className="text-xs text-muted-foreground">
              El alcance completo requiere la app instalada como aplicación nativa (Android/iOS).
            </p>
          </div>
        ),
        important: true,
        tip: 'Mantén el Bluetooth encendido para que la malla funcione',
      },
    ],
  },
  {
    id: 'transit',
    title: 'Viajes',
    icon: <Car className="w-6 h-6" />,
    color: 'text-accent',
    steps: [
      {
        title: '🚗 Registro de Viajes',
        content: (
          <div className="space-y-4">
            <p>
              Registra tus viajes en carretera o en avión para que la comunidad sepa tu ruta.
            </p>
            <div className="bg-accent/10 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Incluye:</p>
              <p className="text-xs text-muted-foreground">Origen, destino (búsqueda mejorada o toque en el mapa), ETA, tipo de transporte, placas y acompañantes</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-xs">
              <strong>Vuelos:</strong> aerolínea y número de vuelo son obligatorios; la matrícula de la aeronave es opcional.
            </div>
            <div className="bg-safe/10 border border-safe/30 rounded-lg p-3 text-xs">
              <strong>Llegada automática:</strong> si olvidas cerrar el viaje, la app lo cierra al detectar que llegaste. Ajusta el radio (100–500 m) en <strong>Ajustes → Alertas</strong>.
            </div>
            <div className="bg-muted rounded-lg p-3 text-xs">
              <strong>Si no llegas a tiempo</strong>, se enviará una alerta automática a la comunidad.
            </div>
          </div>
        ),
      },
    ],
  },

  {
    id: 'community',
    title: 'Comunidad',
    icon: <Users className="w-6 h-6" />,
    color: 'text-safe',
    steps: [
      {
        title: '👥 Secciones de Comunidad',
        content: (
          <div className="space-y-4">
            <p>
              La sección <strong>Comunidad</strong> tiene múltiples áreas para conectar con otros miembros.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                <span>🆘</span>
                <div>
                  <p className="font-medium">AviSOS</p>
                  <p className="text-xs text-muted-foreground">Tablero de publicaciones y chat comunitario</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                <span>📰</span>
                <div>
                  <p className="font-medium">Noticias</p>
                  <p className="text-xs text-muted-foreground">Breaking news en tiempo real</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                <span>🛒</span>
                <div>
                  <p className="font-medium">Marketplace</p>
                  <p className="text-xs text-muted-foreground">Compra, venta e intercambio</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                <span>📸</span>
                <div>
                  <p className="font-medium">Galería del Recuerdo</p>
                  <p className="text-xs text-muted-foreground">Fotos y videos de momentos especiales</p>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        title: '💼 Bolsa de Trabajo',
        content: (
          <div className="space-y-4">
            <p>
              Red de <strong>oportunidades laborales</strong> exclusiva para miembros de la comunidad.
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <span className="text-lg">👤</span>
                <div>
                  <p className="font-medium text-blue-600">Si buscas empleo</p>
                  <p className="text-xs text-muted-foreground">Publica tu perfil profesional</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-safe/10 rounded-lg border border-safe/30">
                <span className="text-lg">🏢</span>
                <div>
                  <p className="font-medium text-safe">Si ofreces trabajo</p>
                  <p className="text-xs text-muted-foreground">Publica vacantes y oportunidades</p>
                </div>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-xs">
              <p className="font-medium mb-1">Puedes incluir:</p>
              <ul className="space-y-1">
                <li>📄 Currículum Vitae (PDF o Word)</li>
                <li>🔗 Enlace a perfil de LinkedIn</li>
                <li>🎯 Título y experiencia profesional</li>
              </ul>
            </div>
          </div>
        ),
        tip: 'Conecta con otros miembros para oportunidades laborales',
      },
    ],
  },
  {
    id: 'recursos',
    title: 'RecurSOS',
    icon: <Shield className="w-6 h-6" />,
    color: 'text-primary',
    steps: [
      {
        title: '📞 RecurSOS — Directorio y Guías',
        content: (
          <div className="space-y-4">
            <p>
              <strong>RecurSOS</strong> está en el menú principal y contiene cuatro secciones:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                <Phone className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Directorio PC y Cruz Roja</p>
                  <p className="text-xs text-muted-foreground">Protección Civil y Cruz Roja de 12 países — teléfonos, ubicaciones y marcado rápido</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-accent/10 rounded-lg border border-accent/30">
                <BookOpen className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-accent">Guías de Emergencias</p>
                  <p className="text-xs text-muted-foreground">Tarjetas con protocolos de primeros auxilios, evacuación, seguridad y más</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-safe/10 rounded-lg border border-safe/30">
                <Radio className="w-5 h-5 text-safe mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-safe">Centro de Monitoreo — feeds de noticias en vivo</p>
                  <p className="text-xs text-muted-foreground">Abre por defecto con N+, CNN en Español, Sky News y TELESUR. Cuadrículas de 1x1 a 3x3 y pantalla completa</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/30">
                <Radio className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-warning">Canal Zello</p>
                  <p className="text-xs text-muted-foreground">Radio PoC de la comunidad EMERGENCIAS ARABA</p>
                </div>
              </div>
            </div>
            <div className="bg-safe/10 border border-safe/30 rounded-lg p-2 text-xs">
              <p className="font-medium text-safe">📥 El directorio se descarga automáticamente y funciona SIN INTERNET</p>
            </div>

          </div>
        ),
        tip: 'Busca por país, ciudad o usa tu GPS para encontrar números de emergencia cercanos',
      },
    ],
  },
  {
    id: 'finish',
    title: '¡Listo!',
    icon: <Check className="w-6 h-6" />,
    color: 'text-safe',
    steps: [
      {
        title: '✅ ¡Estás listo!',
        content: (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-safe/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-safe" />
              </div>
              <p className="font-medium">Ya conoces lo esencial de M.A.T.S.</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="font-medium mb-2">Próximos pasos:</p>
              <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                <li>Configura tus <strong>contactos de emergencia</strong></li>
                <li>Activa tu <strong>ubicación</strong></li>
                <li>Agrega tu <strong>información médica</strong></li>
              </ul>
            </div>
            
            {/* Disclaimer */}
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Importante:</strong> M.A.T.S. no se responsabiliza por el tipo, recursos ni efectividad de la respuesta a emergencias. Todo el apoyo es voluntario. Al usar esta app, aceptas la liberación de responsabilidad.
              </p>
            </div>
          </div>
        ),
      },
    ],
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
              Al continuar, aceptas que M.A.T.S. es una comunidad de apoyo mutuo voluntario y que todo el soporte ofrecido es sin garantías de respuesta.
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
