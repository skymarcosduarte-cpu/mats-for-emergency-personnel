// Guía del Usuario Paso a Paso — M.A.T.S.
// Texto grande, muy descriptiva, muchas páginas

import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Heart,
  AlertTriangle,
  MapPin,
  Bell,
  Car,
  Users,
  Shield,
  Video,
  Phone,
  BookOpen,
  Settings,
  MessageSquare,
  Radio,
  Flame,
  Siren,
  Lock,
  Download,
  Share2,
  Navigation,
  Eye,
  Ambulance,
  HeartPulse,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MatsLogo } from '@/components/MatsLogo';
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
  // ── 1. BIENVENIDA ──
  {
    icon: <Heart className="w-14 h-14" />,
    title: '¡Bienvenido a M.A.T.S.!',
    accentColor: 'text-primary',
    sections: [
      {
        paragraphs: [
          'M.A.T.S. significa Mutual Aid Tracking System (Sistema de Rastreo de Apoyo Mutuo).',
          'Es una aplicación comunitaria donde todos nos cuidamos entre sí. No es una empresa de seguridad privada, sino una red de personas reales que se ayudan mutuamente.',
          'La app te permite enviar alertas de emergencia, ver dónde están los miembros de tu comunidad en un mapa, recibir avisos de sismos, registrar viajes por carretera y mucho más.',
        ],
        tip: 'Para la mejor experiencia, instala la app en tu teléfono desde el navegador. Así recibirás notificaciones incluso con la pantalla apagada.',
      },
      {
        heading: '¿Cómo está organizada la app?',
        paragraphs: [
          'En la parte inferior de la pantalla verás 5 botones principales: Inicio, Alertas, Mapa, Comunidad y Ajustes.',
          'Cada sección tiene funciones específicas que iremos explicando paso a paso en las siguientes páginas.',
        ],
      },
    ],
  },

  // ── 2. PANTALLA DE INICIO ──
  {
    icon: <Shield className="w-14 h-14" />,
    title: 'Pantalla de Inicio',
    accentColor: 'text-primary',
    sections: [
      {
        paragraphs: [
          'La pantalla de inicio es lo primero que ves al abrir la app. Aquí encontrarás un resumen de todo lo importante.',
          'En la parte superior está el BOTÓN SOS de color rojo. Este botón es el más importante de toda la app — te permite pedir ayuda inmediata en caso de emergencia.',
          'También verás tu nombre, el número de miembros conectados y accesos directos a las secciones principales.',
        ],
      },
      {
        heading: 'El Botón SOS',
        paragraphs: [
          'El botón SOS se encuentra siempre visible en la esquina superior derecha de la pantalla.',
          'Al presionarlo, se abrirá un menú con dos opciones:',
          '• SOS / Ambulancia: Para emergencias personales. Envía tu ubicación exacta a los rescatistas más cercanos y a tus contactos de emergencia.',
          '• CLAVE 100: Solo para desastres mayores como terremotos fuertes o inundaciones graves. Esta opción alerta a TODOS los miembros de la comunidad.',
        ],
        warning: 'El uso indebido del botón SOS o la Clave 100 puede resultar en tu baja de la comunidad. Úsalo solo en emergencias reales.',
      },
    ],
  },

  // ── 3. GRABACIÓN DE EMERGENCIA ──
  {
    icon: <Video className="w-14 h-14" />,
    title: 'Grabación de Emergencia',
    accentColor: 'text-destructive',
    sections: [
      {
        paragraphs: [
          'En la pantalla de inicio verás un pequeño ícono de cámara con un brillo rojo. Este es el botón de Grabación de Emergencia.',
          'Al activarlo, tu teléfono comenzará a grabar clips de video de 15 segundos automáticamente. Estos clips se envían al chat comunitario para que todos puedan ver lo que está ocurriendo.',
        ],
      },
      {
        heading: '¿Para qué sirve?',
        paragraphs: [
          'Sirve para documentar emergencias en tiempo real. Por ejemplo, si hay un incendio, una inundación o cualquier situación peligrosa, la grabación permite que la comunidad vea lo que está pasando.',
          'Los videos incluyen tu ubicación GPS y se notifica a tus contactos de emergencia.',
          'Los videos están disponibles por 7 días y SOLO tú puedes borrarlos.',
        ],
        tip: 'El ícono es pequeño a propósito, para que puedas grabar discretamente si estás en peligro.',
        warning: 'Esta función es solo para emergencias reales. El mal uso causa la baja definitiva de la red.',
      },
    ],
  },

  // ── 4. CONTACTOS DE EMERGENCIA ──
  {
    icon: <Phone className="w-14 h-14" />,
    title: 'Contactos de Emergencia',
    accentColor: 'text-panic',
    sections: [
      {
        paragraphs: [
          'Los contactos de emergencia son las personas que serán notificadas automáticamente cuando actives el botón SOS o la grabación de emergencia.',
          'Puedes agregar hasta 5 contactos de emergencia. Cada contacto necesita un nombre, número de teléfono y opcionalmente un correo electrónico.',
        ],
      },
      {
        heading: '¿Cómo configuro mis contactos?',
        paragraphs: [
          '1. Ve a la sección de Ajustes (ícono de engranaje en la barra inferior).',
          '2. Busca la sección "Contactos de Emergencia".',
          '3. Presiona "Agregar contacto" y llena los datos.',
          '4. Puedes marcar un contacto como "principal" para que sea el primero en ser notificado.',
        ],
        tip: 'Agrega al menos 2 contactos de emergencia. Así siempre habrá alguien que reciba tu alerta.',
      },
    ],
  },

  // ── 5. MAPA - COMUNIDAD ──
  {
    icon: <MapPin className="w-14 h-14" />,
    title: 'Mapa — Vista Comunidad',
    accentColor: 'text-primary',
    sections: [
      {
        paragraphs: [
          'El Mapa es una de las funciones más útiles de M.A.T.S. Tiene dos vistas que puedes cambiar con los botones en la parte superior: "Comunidad" y "En Vivo".',
          'La vista de Comunidad muestra la ubicación en tiempo real de todos los miembros de la app que tienen su ubicación compartida.',
        ],
      },
      {
        heading: '¿Qué puedo ver en el mapa?',
        paragraphs: [
          '• Puntos verdes: Miembros activos de la comunidad.',
          '• Puntos rojos con sirena: Alertas SOS activas.',
          '• Íconos de auto: Miembros que están en un viaje registrado.',
          '• Íconos de ambulancia: Miembros con capacidad médica.',
          'Puedes tocar cualquier marcador para ver más detalles sobre esa persona o evento.',
        ],
        tip: 'Para que los demás te vean en el mapa, activa "Compartir ubicación" en Ajustes → Privacidad.',
      },
    ],
  },

  // ── 6. MAPA - EN VIVO ──
  {
    icon: <Radio className="w-14 h-14" />,
    title: 'Mapa — Vista En Vivo',
    accentColor: 'text-warning',
    sections: [
      {
        paragraphs: [
          'La vista "En Vivo" del mapa muestra eventos naturales y meteorológicos en tiempo real sobre el mapa.',
          'Esta vista es ideal para monitorear peligros naturales cerca de ti o en las zonas donde viajan tus seres queridos.',
        ],
      },
      {
        heading: '¿Qué se muestra?',
        paragraphs: [
          '🔴 Sismos: Datos del USGS (mundial) y SSN (México). Muestra magnitud, profundidad y ubicación.',
          '🟠 Incendios: Puntos de calor detectados por satélite NASA/FIRMS.',
          '🌀 Ciclones: Trayectorias de ciclones tropicales activos.',
          '🌧️ Radar de Lluvia: Capa de precipitación en tiempo real + pronóstico de 30-60 minutos.',
          '📡 Radares Doppler: 8 estaciones de radar SMN en México con cobertura de 250 km cada una.',
          '🛰️ Satélite IR: Imagen de nubes por satélite infrarrojo.',
        ],
        tip: 'Los colores del radar indican la intensidad de la lluvia: verde es ligera, amarillo moderada, rojo fuerte y morado muy fuerte.',
      },
    ],
  },

  // ── 7. ALERTAS ──
  {
    icon: <Bell className="w-14 h-14" />,
    title: 'Sección de Alertas',
    accentColor: 'text-warning',
    sections: [
      {
        paragraphs: [
          'La sección de Alertas agrupa todas las herramientas para monitorear peligros y emergencias.',
          'Aquí encontrarás varias subsecciones:',
        ],
      },
      {
        heading: 'Alertas Sísmicas',
        paragraphs: [
          'La app detecta sismos automáticamente usando datos del USGS (mundial) y SSN (México).',
          'Cuando ocurre un sismo cercano, recibes una notificación con sonido y vibración.',
          'Después del sismo, la app te pregunta "¿Estás bien?" y puedes reportar la intensidad que sentiste.',
          'Puedes configurar el radio de detección (de 20 a 400 km) en Ajustes → Alertas.',
        ],
      },
      {
        heading: 'Alertas SMN y CONAGUA',
        paragraphs: [
          'La app también muestra alertas oficiales del Servicio Meteorológico Nacional (SMN) de México, incluyendo avisos de lluvias, tormentas, frentes fríos y ciclones.',
        ],
        tip: 'Activa las notificaciones del teléfono para recibir alertas incluso cuando no tengas la app abierta.',
      },
    ],
  },

  // ── 8. VIAJES / TRÁNSITO ──
  {
    icon: <Car className="w-14 h-14" />,
    title: 'Registro de Viajes',
    accentColor: 'text-accent',
    sections: [
      {
        paragraphs: [
          'La sección de Tránsito te permite registrar tus viajes por carretera o vuelos para que la comunidad sepa tu ruta y pueda ayudarte si algo sale mal.',
        ],
      },
      {
        heading: '¿Cómo registro un viaje?',
        paragraphs: [
          '1. Ve a la sección de Tránsito (ícono de auto en la barra inferior o desde Inicio).',
          '2. Presiona "Nuevo Viaje".',
          '3. Llena los datos: origen, destino, hora estimada de llegada, tipo de transporte.',
          '4. Opcionalmente agrega: placas del vehículo, acompañantes, número de vuelo.',
          '5. Presiona "Iniciar Viaje".',
        ],
      },
      {
        heading: '¿Qué pasa si no llego a tiempo?',
        paragraphs: [
          'Si no confirmas tu llegada antes de la hora estimada, la app enviará una alerta automática a la comunidad avisando que podrías estar en problemas.',
          'Puedes compartir tu viaje con personas fuera de la app mediante un enlace especial.',
        ],
        tip: 'Usa esta función especialmente para viajes largos o en carreteras peligrosas.',
        warning: 'Recuerda confirmar tu llegada cuando llegues a tu destino para evitar falsas alarmas.',
      },
    ],
  },

  // ── 9. REPORTES DE CARRETERA ──
  {
    icon: <AlertTriangle className="w-14 h-14" />,
    title: 'Reportes de Carretera',
    accentColor: 'text-warning',
    sections: [
      {
        paragraphs: [
          'Mientras viajas, puedes reportar incidentes en la carretera para advertir a otros miembros de la comunidad.',
        ],
      },
      {
        heading: 'Tipos de reportes',
        paragraphs: [
          '• Accidente vial: Choques, volcaduras o vehículos detenidos.',
          '• Obra en carretera: Construcción, desvíos o carril cerrado.',
          '• Condición climática: Lluvia fuerte, neblina, granizo.',
          '• Peligro en vía: Baches, derrumbes, objetos en la carretera.',
          '• Retén o revisión: Puntos de control militar o policial.',
          'Los reportes se muestran en el mapa para que todos los vean.',
        ],
        tip: 'Otros miembros pueden verificar tus reportes para confirmar que siguen activos.',
      },
    ],
  },

  // ── 10. COMUNIDAD ──
  {
    icon: <Users className="w-14 h-14" />,
    title: 'Sección de Comunidad',
    accentColor: 'text-safe',
    sections: [
      {
        paragraphs: [
          'La sección de Comunidad es el corazón social de la app. Aquí puedes interactuar con otros miembros.',
        ],
      },
      {
        heading: 'AviSOS (Chat Comunitario)',
        paragraphs: [
          'Es un tablero de publicaciones donde puedes escribir avisos, compartir información importante o enviar mensajes a toda la comunidad.',
          'También incluye un chat en tiempo real donde puedes enviar texto, fotos y mensajes de voz.',
        ],
      },
      {
        heading: 'Noticias',
        paragraphs: [
          'Muestra noticias de última hora de fuentes confiables, enfocadas en desastres naturales, seguridad y temas relevantes para la comunidad.',
        ],
      },
      {
        heading: 'Marketplace',
        paragraphs: [
          'Un espacio para comprar, vender o intercambiar productos y servicios entre miembros de la comunidad.',
        ],
      },
      {
        heading: 'Galería del Recuerdo',
        paragraphs: [
          'Un álbum compartido donde los miembros suben fotos de eventos comunitarios, reuniones y momentos especiales.',
        ],
      },
    ],
  },

  // ── 11. BOLSA DE TRABAJO ──
  {
    icon: <BookOpen className="w-14 h-14" />,
    title: 'Bolsa de Trabajo',
    accentColor: 'text-primary',
    sections: [
      {
        paragraphs: [
          'M.A.T.S. incluye una bolsa de trabajo exclusiva para miembros de la comunidad.',
        ],
      },
      {
        heading: 'Si buscas empleo',
        paragraphs: [
          '1. Ve a Comunidad → Bolsa de Trabajo.',
          '2. Presiona "Publicar Perfil".',
          '3. Llena tu información: nombre, título profesional, experiencia.',
          '4. Puedes adjuntar tu Currículum Vitae (PDF o Word).',
          '5. Puedes incluir tu enlace de LinkedIn.',
        ],
      },
      {
        heading: 'Si ofreces trabajo',
        paragraphs: [
          '1. En la misma sección, marca la opción "Ofrezco Trabajo".',
          '2. Describe la vacante y los requisitos.',
          '3. Los miembros interesados podrán contactarte directamente.',
        ],
        tip: 'Revisa las publicaciones periódicamente. La comunidad es grande y hay buenas oportunidades.',
      },
    ],
  },

  // ── 12. RECURSOS (RECURSOS) ──
  {
    icon: <HeartPulse className="w-14 h-14" />,
    title: 'RecurSOS',
    accentColor: 'text-destructive',
    sections: [
      {
        paragraphs: [
          'RecurSOS es la sección de recursos de emergencia. Puedes acceder desde el menú principal.',
        ],
      },
      {
        heading: 'Directorio PC y Cruz Roja',
        paragraphs: [
          'Un directorio completo con teléfonos de emergencia de Protección Civil y la Cruz Roja en 12 países.',
          'Puedes buscar por país, ciudad o usar tu GPS para encontrar los números más cercanos.',
          'Incluye marcado rápido (un toque para llamar) y enlaces de navegación GPS para llegar a las oficinas.',
          'El directorio se descarga automáticamente y funciona SIN INTERNET.',
        ],
      },
      {
        heading: 'Guías de Emergencias',
        paragraphs: [
          'Tarjetas con información práctica sobre qué hacer en distintas emergencias:',
          '• Primeros auxilios básicos.',
          '• Qué hacer durante un sismo.',
          '• Cómo evacuar en caso de incendio.',
          '• Protocolos ante inundaciones.',
          '• Y muchos temas más.',
        ],
        tip: 'Lee las guías ANTES de que ocurra una emergencia. En el momento del peligro, tendrás poco tiempo para leer.',
      },
    ],
  },

  // ── 13. MENSAJES INTERNOS ──
  {
    icon: <MessageSquare className="w-14 h-14" />,
    title: 'Mensajes Internos',
    accentColor: 'text-primary',
    sections: [
      {
        paragraphs: [
          'M.A.T.S. tiene un sistema de mensajes internos que te permite comunicarte de forma privada con otros miembros de la comunidad.',
        ],
      },
      {
        heading: '¿Cómo envío un mensaje?',
        paragraphs: [
          '1. Ve al mapa y toca el marcador de un miembro.',
          '2. En el menú que aparece, elige "Enviar mensaje".',
          '3. Escribe tu mensaje y envíalo.',
          'También puedes enviar fotos y mensajes de voz.',
          'Recibirás una notificación cuando te respondan.',
        ],
        tip: 'Usa los mensajes internos para coordinar ayuda durante emergencias o simplemente saludar.',
      },
    ],
  },

  // ── 14. AJUSTES — PERFIL ──
  {
    icon: <Settings className="w-14 h-14" />,
    title: 'Ajustes — Tu Perfil',
    accentColor: 'text-muted-foreground',
    sections: [
      {
        paragraphs: [
          'En la sección de Ajustes puedes personalizar tu experiencia en la app y configurar toda tu información personal.',
        ],
      },
      {
        heading: 'Información Personal',
        paragraphs: [
          '• Nombre completo y apodo (nickname).',
          '• Número de teléfono.',
          '• Fecha de cumpleaños (la comunidad te felicitará).',
          '• Especialidades: Si eres bombero, paramédico, médico, electricista, etc.',
        ],
      },
      {
        heading: 'Información Médica',
        paragraphs: [
          'Puedes guardar tu información médica para que los rescatistas la vean si necesitas ayuda:',
          '• Tipo de sangre.',
          '• Alergias.',
          '• Condiciones médicas.',
          '• Medicamentos actuales.',
          '• Notas médicas adicionales.',
        ],
        tip: 'Esta información puede salvar tu vida en una emergencia. Tómate un momento para llenarla.',
      },
    ],
  },

  // ── 15. AJUSTES — PRIVACIDAD ──
  {
    icon: <Lock className="w-14 h-14" />,
    title: 'Ajustes — Privacidad',
    accentColor: 'text-warning',
    sections: [
      {
        paragraphs: [
          'Tu privacidad es importante. En Ajustes puedes controlar exactamente qué información compartes.',
        ],
      },
      {
        heading: 'Compartir Ubicación',
        paragraphs: [
          'Si activas "Compartir ubicación", los demás miembros podrán ver tu posición en el mapa.',
          'Si la desactivas, no aparecerás en el mapa, pero tampoco podrás ver a los demás.',
        ],
      },
      {
        heading: 'Compartir Información Médica',
        paragraphs: [
          'Si activas esta opción, los rescatistas podrán ver tu tipo de sangre, alergias y condiciones médicas cuando te estén ayudando.',
          'Si la desactivas, nadie verá tu información médica.',
        ],
      },
      {
        heading: 'Mostrar Nombre en el Mapa',
        paragraphs: [
          'Decide si tu nombre aparece junto a tu marcador en el mapa, o si prefieres que solo vean tu ícono.',
        ],
        tip: 'Recomendamos compartir tu ubicación para que la comunidad pueda encontrarte en caso de emergencia.',
      },
    ],
  },

  // ── 16. AJUSTES — NOTIFICACIONES ──
  {
    icon: <Bell className="w-14 h-14" />,
    title: 'Ajustes — Notificaciones',
    accentColor: 'text-accent',
    sections: [
      {
        paragraphs: [
          'Las notificaciones son esenciales para que la app funcione correctamente. Sin ellas, no recibirás alertas de emergencia.',
        ],
      },
      {
        heading: '¿Cómo activo las notificaciones?',
        paragraphs: [
          '1. Ve a Ajustes.',
          '2. En la sección "Notificaciones", presiona "Activar Notificaciones".',
          '3. Tu teléfono te pedirá permiso. Acepta.',
          '4. Puedes probar que funcionen con el botón "Enviar Prueba".',
        ],
      },
      {
        heading: 'Sonidos personalizables',
        paragraphs: [
          'Puedes activar o desactivar los sonidos para distintos tipos de alertas:',
          '• Sonido de alerta SOS: Suena cuando alguien pide ayuda.',
          '• Sonido de sismo: Suena cuando se detecta un sismo cercano.',
          '• Sonido de SkyAlert: Para alertas sísmicas de SkyAlert.',
        ],
        warning: 'Si desactivas los sonidos, podrías no escuchar alertas importantes. Déjalos activados.',
      },
    ],
  },

  // ── 17. INSTALAR LA APP ──
  {
    icon: <Download className="w-14 h-14" />,
    title: 'Instalar la App',
    accentColor: 'text-safe',
    sections: [
      {
        paragraphs: [
          'M.A.T.S. funciona directamente desde el navegador, pero funciona MUCHO MEJOR si la instalas como una app en tu teléfono.',
        ],
      },
      {
        heading: 'En Android (Chrome)',
        paragraphs: [
          '1. Abre M.A.T.S. en Chrome.',
          '2. Toca los tres puntos (⋮) en la esquina superior derecha.',
          '3. Selecciona "Instalar aplicación" o "Añadir a pantalla de inicio".',
          '4. Confirma la instalación.',
          '5. ¡Listo! Verás el ícono de M.A.T.S. en tu pantalla de inicio.',
        ],
      },
      {
        heading: 'En iPhone (Safari)',
        paragraphs: [
          '1. Abre M.A.T.S. en Safari (debe ser Safari, no Chrome).',
          '2. Toca el botón de compartir (□↑) en la barra inferior.',
          '3. Desplázate hacia abajo y selecciona "Agregar a pantalla de inicio".',
          '4. Confirma con "Agregar".',
          '5. ¡Listo! La app aparecerá en tu pantalla de inicio.',
        ],
        tip: 'Instalar la app permite recibir notificaciones en segundo plano y tener la pantalla completa sin barras del navegador.',
      },
    ],
  },

  // ── 18. COMUNIDAD CERRADA ──
  {
    icon: <Lock className="w-14 h-14" />,
    title: 'Comunidad por Invitación',
    accentColor: 'text-warning',
    sections: [
      {
        paragraphs: [
          'M.A.T.S. es una comunidad cerrada. Solo puedes unirte si alguien que ya es miembro te invita.',
        ],
      },
      {
        heading: '¿Cómo invito a alguien?',
        paragraphs: [
          '1. Ve a Ajustes.',
          '2. Presiona "Generar Código de Invitación".',
          '3. Se creará un código único y un código QR.',
          '4. Comparte el código o el QR con la persona que quieras invitar.',
          '5. Esa persona podrá registrarse usando tu código.',
        ],
        tip: 'Solo invita a personas de confianza. La seguridad de la comunidad depende de todos.',
        warning: 'Los códigos de invitación tienen un número limitado de usos. Cada código solo puede ser usado un cierto número de veces.',
      },
    ],
  },

  // ── 19. ¡LISTO! ──
  {
    icon: <CheckCircle className="w-14 h-14" />,
    title: '¡Ya conoces M.A.T.S.!',
    accentColor: 'text-safe',
    sections: [
      {
        paragraphs: [
          '¡Felicidades! Ya conoces todas las funciones principales de la app.',
          'Recuerda que M.A.T.S. es una comunidad de apoyo mutuo. Entre más miembros participen activamente, más fuerte y segura es nuestra red.',
        ],
      },
      {
        heading: 'Próximos pasos recomendados',
        paragraphs: [
          '✅ Configura tus contactos de emergencia en Ajustes.',
          '✅ Activa tu ubicación para aparecer en el mapa.',
          '✅ Llena tu información médica.',
          '✅ Activa las notificaciones para recibir alertas.',
          '✅ Instala la app en tu teléfono.',
          '✅ Invita a tus familiares y amigos de confianza.',
        ],
      },
      {
        heading: 'Gracias por ser parte',
        paragraphs: [
          'Juntos somos más fuertes. Cuida a tu comunidad y tu comunidad te cuidará a ti.',
          '¡Bienvenido a la familia M.A.T.S.! 🤝',
        ],
        tip: 'Puedes volver a ver esta guía en cualquier momento desde Ajustes → Guía del Usuario.',
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
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
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
