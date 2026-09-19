// Guía del Usuario Paso a Paso — M.A.T.S.
// Texto grande, muy descriptiva, muchas páginas

import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, X, Heart, MapPin, Bell, Settings, Radio, HeartPulse, CheckCircle, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MatsLogo } from '@/components/MatsLogo';
import { GuidePdfButton } from '@/components/GuidePdfButton';
import { motion, AnimatePresence } from 'framer-motion';

interface GuidePageData {
  icon: React.ReactNode;
  title: string;
  sections: {
    heading?: string;
    paragraphs: string[];
    tip?: string;
    warning?: string;
  }[];
  accentColor: string;
}

export const GUIDE_PAGES: GuidePageData[] = [
  {
    icon: <Heart className="w-14 h-14" />,
    title: 'M.A.T.S. for Emergency Personnel',
    accentColor: 'text-primary',
    sections: [
      {
        paragraphs: [
          'M.A.T.S. significa Maximum Aid Tracking Service. Está diseñada para personal de protección civil y cuerpos de emergencia.',
          'La pantalla de Inicio reúne seis secciones: Sismos, Mapa, RecurSOS, Red Mesh, Detector de Señales y Ajustes.',
          'La barra inferior ofrece acceso rápido a Inicio, Mapa y Ajustes. Las demás secciones se abren desde Inicio.',
        ],
        tip: 'Activa la ubicación, las notificaciones y Bluetooth para aprovechar las funciones operativas.',
      },
    ],
  },
  {
    icon: <Bell className="w-14 h-14" />,
    title: 'Sismos',
    accentColor: 'text-warning',
    sections: [
      {
        paragraphs: [
          'Abre Sismos desde Inicio para consultar los últimos movimientos registrados por el SSN en México y el USGS a nivel mundial.',
          'Cada registro muestra magnitud, ubicación, hora y distancia aproximada cuando el GPS está disponible.',
        ],
      },
      {
        heading: 'Reportar tu estado',
        paragraphs: [
          'Después de un sismo puedes indicar que estás bien o solicitar ayuda y reportar la intensidad percibida.',
          'Las alertas naturales disponibles también muestran ciclones, incendios y avisos internacionales activos.',
        ],
        tip: 'En Ajustes puedes activar notificaciones y sonidos para recibir avisos importantes.',
      },
    ],
  },
  {
    icon: <MapPin className="w-14 h-14" />,
    title: 'Mapa',
    accentColor: 'text-primary',
    sections: [
      {
        paragraphs: [
          'El Mapa muestra tu posición, personal activo que comparte ubicación, emergencias y riesgos disponibles.',
          'Tu ubicación aparece con la marca “TÚ”. Toca un marcador para consultar sus datos o las acciones disponibles.',
        ],
      },
      {
        heading: 'Capas y ubicación',
        paragraphs: [
          'Usa los controles del mapa para mostrar u ocultar capas meteorológicas, incendios, sismos y otros eventos activos.',
          'Activa “Compartir ubicación” en Ajustes para que el personal autorizado pueda localizarte durante una emergencia.',
        ],
        warning: 'La posición depende de la precisión del GPS y puede variar en interiores o bajo estructuras.',
      },
    ],
  },
  {
    icon: <HeartPulse className="w-14 h-14" />,
    title: 'RecurSOS',
    accentColor: 'text-destructive',
    sections: [
      {
        paragraphs: [
          'RecurSOS contiene el Directorio de Protección Civil y Cruz Roja, además de Guías de Emergencias.',
        ],
      },
      {
        heading: 'Directorio PC y Cruz Roja',
        paragraphs: [
          'Busca teléfonos, ubicaciones y servicios de emergencia por país o ciudad. Puedes llamar o abrir la navegación desde cada registro.',
          'El directorio se guarda en el dispositivo para poder consultarlo sin conexión.',
        ],
      },
      {
        heading: 'Guías de Emergencias',
        paragraphs: [
          'Consulta protocolos breves de primeros auxilios, evacuación, seguridad, preparación y respuesta ante distintos riesgos.',
        ],
        warning: 'Las guías son material de consulta y no sustituyen capacitación ni certificación profesional.',
      },
    ],
  },
  {
    icon: <Radio className="w-14 h-14" />,
    title: 'Red Mesh',
    accentColor: 'text-primary',
    sections: [
      {
        paragraphs: [
          'Red Mesh permite enviar avisos sin wifi ni red telefónica, utilizando Bluetooth disponible entre teléfonos cercanos.',
          'Cada dispositivo puede retransmitir mensajes para extender su alcance. También puedes informar “Estoy bien” o “Necesito ayuda” y agregar una nota.',
        ],
      },
      {
        heading: 'Cómo usarla',
        paragraphs: [
          '1. Abre Red Mesh desde Inicio.',
          '2. Activa la malla y concede permisos de Bluetooth y ubicación.',
          '3. Revisa el buzón, el comprobante de envío y el estado de entrega.',
          '4. Mantén Bluetooth encendido para detectar y retransmitir mensajes.',
        ],
        tip: 'La operación Bluetooth completa requiere la aplicación Android instalada.',
      },
    ],
  },
  {
    icon: <Radar className="w-14 h-14" />,
    title: 'Detector de Señales',
    accentColor: 'text-primary',
    sections: [
      {
        paragraphs: [
          'El Detector busca teléfonos, relojes y audífonos Bluetooth activos para orientar recorridos en zonas de desastre.',
          'Presiona “Iniciar búsqueda”, activa el GPS y camina lentamente por la cuadrícula A1–C3. La marca “TÚ” indica tu sector actual.',
        ],
      },
      {
        heading: 'Mejorar la detección',
        paragraphs: [
          'La guía sonora acelera los pitidos cuando una señal se fortalece.',
          'Realiza el recorrido como Paso 1 y repítelo como Paso 2. Una señal persistente en el mismo sector queda marcada como indicio confirmado.',
          'Puedes marcar un hallazgo en el mapa y limpiar la lista cuando inicies un nuevo barrido.',
        ],
        warning: 'La distancia es aproximada. El concreto y el metal alteran la señal. Esta herramienta no sustituye perros, geófonos ni métodos profesionales.',
      },
    ],
  },
  {
    icon: <Settings className="w-14 h-14" />,
    title: 'Ajustes',
    accentColor: 'text-muted-foreground',
    sections: [
      {
        paragraphs: [
          'En Ajustes puedes actualizar tu perfil, especialidades y datos de contacto, además de controlar privacidad, notificaciones y sonidos.',
        ],
      },
      {
        heading: 'Configuración recomendada',
        paragraphs: [
          '• Revisa que tu nombre de usuario, teléfono, país y especialidad estén correctos.',
          '• Activa el uso de ubicación cuando necesites aparecer en el mapa.',
          '• Autoriza notificaciones y prueba el sonido de alertas.',
          '• Mantén la aplicación actualizada desde la sección de versión.',
        ],
        tip: 'Puedes volver a abrir esta guía y el tutorial desde Ajustes.',
      },
    ],
  },
  {
    icon: <CheckCircle className="w-14 h-14" />,
    title: 'Listo para comenzar',
    accentColor: 'text-safe',
    sections: [
      {
        paragraphs: [
          'Ya conoces las funciones activas de M.A.T.S. for Emergency Personnel.',
          'Comienza revisando Sismos y Mapa; activa Red Mesh o Detector de Señales cuando la operación lo requiera.',
        ],
      },
    ],
  },
];

interface UserGuideStepByStepProps {
  onClose?: () => void;
}

export const UserGuideStepByStep: React.FC<UserGuideStepByStepProps> = ({ onClose }) => {
  const handleClose = onClose || (() => window.history.back());
  const [currentPage, setCurrentPage] = useState(0);
  const page = GUIDE_PAGES[currentPage];
  const isFirst = currentPage === 0;
  const isLast = currentPage === GUIDE_PAGES.length - 1;

  return (
    <div className="fixed inset-0 z-[100000] bg-background flex flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur-sm"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-3">
          <MatsLogo size={28} />
          <h1 className="text-lg font-bold text-foreground">Guía Paso a Paso</h1>
        </div>
        <div className="flex items-center gap-2">
        <GuidePdfButton />
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
        </div>
      </header>


      {/* Progress bar */}
      <div className="px-4 py-2 bg-muted/30">
        <div className="flex gap-0.5">
          {GUIDE_PAGES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx)}
              className={cn(
                'h-2 flex-1 rounded-full transition-colors',
                idx <= currentPage ? 'bg-primary' : 'bg-muted'
              )}
              aria-label={`Ir a página ${idx + 1}`}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-1 text-center font-medium">
          Página {currentPage + 1} de {GUIDE_PAGES.length}
        </p>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="p-6 space-y-6"
          >
            {/* Icon + Title */}
            <div className="text-center space-y-3">
              <div className={cn(
                'w-24 h-24 mx-auto rounded-2xl flex items-center justify-center',
                'bg-gradient-to-br from-card to-muted shadow-lg',
                page.accentColor
              )}>
                {page.icon}
              </div>
              <h2 className="text-2xl font-bold text-foreground leading-tight">
                {page.title}
              </h2>
            </div>

            {/* Sections */}
            {page.sections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-3">
                {section.heading && (
                  <h3 className="text-xl font-bold text-foreground border-b border-border pb-2">
                    {section.heading}
                  </h3>
                )}

                {section.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="text-lg leading-relaxed text-foreground">
                    {p}
                  </p>
                ))}

                {section.tip && (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                    <p className="text-base text-primary leading-relaxed">
                      💡 <strong>Consejo:</strong> {section.tip}
                    </p>
                  </div>
                )}

                {section.warning && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                    <p className="text-base text-destructive leading-relaxed">
                      ⚠️ <strong>Importante:</strong> {section.warning}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>

      {/* Footer nav */}
      <footer
        className="flex gap-3 p-4 border-t border-border bg-card/95"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {!isFirst && (
          <Button variant="outline" onClick={() => setCurrentPage(p => p - 1)} className="flex-1 h-14 text-lg gap-2">
            <ChevronLeft className="w-5 h-5" />
            Anterior
          </Button>
        )}
        <Button
          onClick={() => isLast ? handleClose() : setCurrentPage(p => p + 1)}
          className={cn('flex-1 h-14 text-lg gap-2', isLast && 'bg-safe hover:bg-safe/90')}
        >
          {isLast ? (
            <>
              <CheckCircle className="w-5 h-5" />
              ¡Entendido!
            </>
          ) : (
            <>
              Siguiente
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </footer>
    </div>
  );
};

export default UserGuideStepByStep;
