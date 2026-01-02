// Comprehensive Tutorial Component for COMUNIDAD EX SOS / M.A.T.S.
// Full walkthrough of all app features with emphasis on emergency alerts

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  MapPin, 
  Bell, 
  Car, 
  Users, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Heart,
  Shield,
  Ambulance,
  Phone,
  Settings,
  MessageCircle,
  Navigation,
  Volume2,
  UserPlus,
  BadgeCheck,
  Siren,
  Radio,
  Eye,
  Lock,
  ShoppingBag,
  HelpCircle,
  X,
  Stethoscope,
  FileHeart,
  BookOpen,
  AlertCircle
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
              <strong>M.A.T.S.</strong> (Mutual Aid Tracking System) es una aplicación de <strong>apoyo mutuo y seguridad comunitaria</strong>.
            </p>
            <p>
              Aquí te conectas con rescatistas, paramédicos, bomberos y voluntarios capacitados que pueden ayudarte en emergencias reales.
            </p>
            <div className="bg-primary/10 rounded-lg p-4 mt-4">
              <p className="text-sm font-medium text-primary">
                🤝 Esta NO es una app de seguridad privada. Es una <strong>comunidad</strong> donde nos cuidamos entre todos.
              </p>
            </div>
          </div>
        ),
        tip: 'Instala la app en tu teléfono para recibir alertas incluso con la pantalla apagada',
      },
      {
        title: '¿Qué puedes hacer aquí?',
        content: (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Siren className="w-5 h-5 text-panic mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Enviar alertas de emergencia</p>
                <p className="text-sm text-muted-foreground">SOS, solicitar ambulancia, Clave 100</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Ver a la comunidad en el mapa</p>
                <p className="text-sm text-muted-foreground">Ubicación en tiempo real de miembros cercanos</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Bell className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Recibir alertas sísmicas</p>
                <p className="text-sm text-muted-foreground">Notificaciones automáticas de sismos cercanos</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Car className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Registrar tus viajes</p>
                <p className="text-sm text-muted-foreground">Comparte tu ruta cuando viajes por carretera</p>
              </div>
            </div>
          </div>
        ),
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
        title: '🆘 Botón de Pánico (SOS)',
        content: (
          <div className="space-y-4">
            <p>
              El <strong>Botón SOS</strong> está siempre visible en la esquina superior derecha de la pantalla. Úsalo cuando necesites ayuda urgente.
            </p>
            <div className="bg-panic/10 border border-panic/30 rounded-lg p-4">
              <p className="font-medium text-panic mb-2">¿Qué sucede cuando presionas SOS?</p>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Tu <strong>ubicación exacta</strong> se envía a rescatistas cercanos</li>
                <li>Recibes <strong>notificaciones en vivo</strong> de quién viene a ayudarte</li>
                <li>Puedes ver el <strong>tiempo estimado de llegada</strong> del rescatista</li>
                <li>Se notifica a tus <strong>contactos de emergencia</strong> (si los configuraste)</li>
              </ol>
            </div>
          </div>
        ),
        tip: 'Configura tus contactos de emergencia en Configuración para que también sean notificados',
        important: true,
      },
      {
        title: '🚑 Solicitar Ambulancia',
        content: (
          <div className="space-y-4">
            <p>
              Si necesitas atención médica de emergencia, puedes <strong>solicitar una ambulancia</strong> directamente desde la app.
            </p>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="font-medium text-destructive mb-2">Para solicitar ambulancia:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Presiona el botón <strong>SOS</strong></li>
                <li>Selecciona <strong>"Solicitar Ambulancia"</strong></li>
                <li>Confirma tu ubicación</li>
                <li>Agrega detalles opcionales (qué pasó, síntomas)</li>
              </ol>
            </div>
            <p className="text-sm text-muted-foreground">
              Los miembros con ambulancias y paramédicos cercanos serán notificados inmediatamente.
            </p>
          </div>
        ),
        important: true,
      },
      {
        title: '🚨 CLAVE 100 - Emergencia Máxima',
        content: (
          <div className="space-y-4">
            <div className="bg-destructive text-destructive-foreground rounded-lg p-4 text-center">
              <p className="text-xl font-bold">⚠️ CLAVE 100 ⚠️</p>
              <p className="text-sm mt-1">Solo para desastres o siniestros mayores</p>
            </div>
            <p>
              <strong>CLAVE 100</strong> es la alerta más grave. Envía un mensaje de emergencia a <strong>TODOS</strong> los usuarios activos de la comunidad.
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="font-medium">Úsala SOLO para:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Terremotos con daños graves</li>
                <li>Incendios de gran escala</li>
                <li>Inundaciones o desastres naturales</li>
                <li>Emergencias que afecten a muchas personas</li>
              </ul>
            </div>
            <div className="bg-warning/20 border border-warning/50 rounded-lg p-3">
              <p className="text-sm font-medium text-warning">
                ⚠️ NO uses Clave 100 para emergencias personales. Para eso está el botón SOS.
              </p>
            </div>
          </div>
        ),
        tip: 'Clave 100 incluye sonido de alerta máxima y vibración intensa en todos los dispositivos',
        important: true,
      },
      {
        title: 'Respondiendo a Emergencias',
        content: (
          <div className="space-y-4">
            <p>
              Cuando alguien cerca de ti envía una alerta, recibirás una <strong>notificación con su ubicación</strong>.
            </p>
            <div className="bg-primary/10 rounded-lg p-4 space-y-3">
              <p className="font-medium text-primary">Si decides ayudar:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Presiona <strong>"Voy en camino"</strong> para notificar a la persona</li>
                <li>Selecciona cómo te mueves (caminando, auto, bici)</li>
                <li>La persona verá tu <strong>ubicación en tiempo real</strong> y tiempo estimado</li>
                <li>Al llegar, marca <strong>"He llegado"</strong></li>
              </ol>
            </div>
            <p className="text-sm text-muted-foreground">
              No estás obligado a responder, pero cualquier ayuda puede salvar vidas.
            </p>
          </div>
        ),
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
        title: 'Mapa en Tiempo Real',
        content: (
          <div className="space-y-4">
            <p>
              El mapa muestra la <strong>ubicación en tiempo real</strong> de todos los miembros que tienen su ubicación activada.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-mats-green flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-medium">SOS Activo</p>
                <p className="text-xs text-muted-foreground">Rescatista activo</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-primary flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-medium">EX-SOS</p>
                <p className="text-xs text-muted-foreground">Ex-rescatista</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-red-500 flex items-center justify-center">
                  <Ambulance className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-medium">Ambulancia</p>
                <p className="text-xs text-muted-foreground">Con vehículo médico</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-blue-500 flex items-center justify-center">
                  <Stethoscope className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-medium">Médico/Paramédico</p>
                <p className="text-xs text-muted-foreground">Puede dar asistencia</p>
              </div>
            </div>
          </div>
        ),
        tip: 'Toca cualquier marcador para ver información de ese usuario y enviarle un mensaje',
      },
      {
        title: 'Mensajería Interna',
        content: (
          <div className="space-y-4">
            <p>
              Puedes enviar <strong>mensajes directos</strong> a cualquier miembro de la comunidad desde el mapa.
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <p className="font-medium">Mensajes de texto</p>
              </div>
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary" />
                <p className="font-medium">Notas de voz</p>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <p className="font-medium">Compartir fotos</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Busca el ícono de mensaje 💬 en la esquina superior para ver tus conversaciones.
            </p>
          </div>
        ),
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
        title: 'Alertas Sísmicas Automáticas',
        content: (
          <div className="space-y-4">
            <p>
              La app detecta <strong>sismos cercanos a tu ubicación</strong> automáticamente usando datos oficiales del USGS y SSN (México).
            </p>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <p className="font-medium text-warning mb-2">Cuando hay un sismo cercano:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Recibes una <strong>notificación inmediata</strong> con sonido y vibración</li>
                <li>Se muestra magnitud, distancia y ubicación del epicentro</li>
                <li>Se te pregunta: <strong>"¿Sentiste el sismo?"</strong></li>
                <li>Reportas tu estado y la intensidad percibida</li>
              </ol>
            </div>
            <div className="bg-primary/10 rounded-lg p-4 space-y-2">
              <p className="font-medium text-primary mb-2">Configura en Ajustes → Alertas:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li><strong>Radio de detección</strong>: De 20 km hasta 400 km para sismos cercanos</li>
                <li><strong>Umbral alerta nacional SSN</strong>: Magnitud mínima (5.0 a 8.0) para alertas de sismos en México que te avisan sin importar la distancia</li>
              </ul>
            </div>
          </div>
        ),
        tip: 'Reportar que estás bien ayuda a tu comunidad a saber que no necesitas ayuda',
      },
      {
        title: '📊 Reportar Estado tras un Sismo',
        content: (
          <div className="space-y-4">
            <div className="bg-safe/10 border border-safe/30 rounded-lg p-4 text-center">
              <p className="font-medium text-safe text-lg mb-2">¡Tu reporte es vital!</p>
              <p className="text-sm">Cada reporte ayuda a la comunidad a entender la situación en tiempo real</p>
            </div>
            <p>
              Cuando sientas o percibas un sismo, la app te guiará para reportar:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <span className="text-xl">📏</span>
                <div>
                  <p className="font-medium">Intensidad percibida (1-10)</p>
                  <p className="text-xs text-muted-foreground">¿Qué tan fuerte lo sentiste en tu ubicación?</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <span className="text-xl">✅</span>
                <div>
                  <p className="font-medium">Tu estado personal</p>
                  <p className="text-xs text-muted-foreground">¿Estás bien? ¿Hay daños? ¿Necesitas ayuda?</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <span className="text-xl">📍</span>
                <div>
                  <p className="font-medium">Tu ubicación</p>
                  <p className="text-xs text-muted-foreground">Se registra automáticamente para el mapa de reportes</p>
                </div>
              </div>
            </div>
          </div>
        ),
        important: true,
      },
      {
        title: '🗺️ Mapa de Reportes de la Comunidad',
        content: (
          <div className="space-y-4">
            <p>
              Después de reportar, puedes ver un <strong>mapa en tiempo real</strong> con los reportes de toda la comunidad.
            </p>
            <div className="bg-primary/10 rounded-lg p-4 space-y-3">
              <p className="font-medium text-primary">El mapa te muestra:</p>
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div className="bg-safe/20 rounded p-2">
                  <span className="text-lg">✓</span>
                  <p className="mt-1">Todo bien</p>
                </div>
                <div className="bg-warning/20 rounded p-2">
                  <span className="text-lg">?</span>
                  <p className="mt-1">No seguro</p>
                </div>
                <div className="bg-destructive/20 rounded p-2">
                  <span className="text-lg">⚠</span>
                  <p className="mt-1">Daños</p>
                </div>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm">
                <strong>Solo puedes hacer UN reporte por sismo.</strong> Si necesitas cambiar tu información, usa el botón <strong>"Editar"</strong>.
              </p>
            </div>
          </div>
        ),
        tip: 'Al completar tu reporte verás una celebración con confetti - ¡gracias por ayudar!',
      },
      {
        title: 'Tipos de Alertas',
        content: (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">SOS / Pánico</p>
                <p className="text-sm text-muted-foreground">Emergencias personales, necesitas ayuda inmediata</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
              <Ambulance className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-500">Solicitud de Ambulancia</p>
                <p className="text-sm text-muted-foreground">Emergencia médica</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/30">
              <Bell className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-warning">Alerta Sísmica</p>
                <p className="text-sm text-muted-foreground">Sismo detectado en tu zona</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-panic/10 rounded-lg border border-panic/30">
              <Siren className="w-5 h-5 text-panic mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-panic">CLAVE 100</p>
                <p className="text-sm text-muted-foreground">Desastre o siniestro mayor</p>
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: 'transit',
    title: 'Tránsito',
    icon: <Car className="w-6 h-6" />,
    color: 'text-accent',
    steps: [
      {
        title: 'Registro de Viajes',
        content: (
          <div className="space-y-4">
            <p>
              Cuando salgas de viaje, especialmente en <strong>carretera</strong>, registra tu ruta para que tu comunidad sepa dónde estás.
            </p>
            <div className="bg-accent/10 rounded-lg p-4 space-y-2">
              <p className="font-medium">¿Qué registrar?</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Origen y destino</li>
                <li>Hora estimada de llegada</li>
                <li>Tipo de transporte (auto, camión, vuelo)</li>
                <li>Placas del vehículo (opcional)</li>
                <li>Acompañantes (opcional)</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              Si no llegas a tiempo, se enviará una alerta a la comunidad.
            </p>
          </div>
        ),
        tip: 'Puedes compartir tu viaje con personas fuera de la app mediante un link',
      },
      {
        title: 'Reportes de Carretera',
        content: (
          <div className="space-y-4">
            <p>
              Durante tu viaje, puedes <strong>reportar incidentes</strong> en la carretera para alertar a otros viajeros:
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted rounded p-2 text-center">🚧 Obra en la vía</div>
              <div className="bg-muted rounded p-2 text-center">🚗 Accidente</div>
              <div className="bg-muted rounded p-2 text-center">⚠️ Peligro</div>
              <div className="bg-muted rounded p-2 text-center">🚨 Retén policial</div>
              <div className="bg-muted rounded p-2 text-center">🌧️ Mal clima</div>
              <div className="bg-muted rounded p-2 text-center">🦌 Animal en la vía</div>
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
        title: 'Tu Comunidad',
        content: (
          <div className="space-y-4">
            <p>
              En la sección <strong>Comunidad</strong> puedes ver eventos, cumpleaños y actividades de tus compañeros.
            </p>
            <div className="bg-safe/10 rounded-lg p-4 space-y-2">
              <p className="font-medium text-safe">Tipos de eventos:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>🎂 Cumpleaños de miembros</li>
                <li>📢 Anuncios importantes</li>
                <li>🏥 Avisos de salud</li>
                <li>🤝 Solicitudes de apoyo</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              También puedes ver el Marketplace de productos y servicios de la comunidad.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'settings',
    title: 'Configuración',
    icon: <Settings className="w-6 h-6" />,
    color: 'text-muted-foreground',
    steps: [
      {
        title: 'Tu Rol en la Comunidad',
        content: (
          <div className="space-y-4">
            <p>
              Existen <strong>tres roles</strong> en la comunidad:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-mats-green/10 rounded-lg border border-mats-green/30">
                <BadgeCheck className="w-5 h-5 text-mats-green mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-mats-green">SOS Activo</p>
                  <p className="text-sm text-muted-foreground">Rescatistas activos, paramédicos, bomberos en activo</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/30">
                <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-primary">EX-SOS</p>
                  <p className="text-sm text-muted-foreground">Ex-rescatistas, personal capacitado retirado</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Users className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Familiar</p>
                  <p className="text-sm text-muted-foreground">Familiares y amigos de la comunidad</p>
                </div>
              </div>
            </div>
          </div>
        ),
        tip: 'Puedes cambiar tu rol en cualquier momento desde Configuración',
      },
      {
        title: 'Seleccionar tu Especialidad',
        content: (
          <div className="space-y-4">
            <p>
              Si eres rescatista o profesional de emergencias, <strong>indica tus especialidades</strong> para que otros sepan cómo puedes ayudar.
            </p>
            <div className="bg-muted rounded-lg p-4">
              <p className="font-medium mb-2">Especialidades disponibles:</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-background rounded">Paramédico</span>
                <span className="px-2 py-1 bg-background rounded">Bombero</span>
                <span className="px-2 py-1 bg-background rounded">Médico</span>
                <span className="px-2 py-1 bg-background rounded">Enfermero</span>
                <span className="px-2 py-1 bg-background rounded">Rescatista urbano</span>
                <span className="px-2 py-1 bg-background rounded">Buzo</span>
                <span className="px-2 py-1 bg-background rounded">Radioaficionado</span>
                <span className="px-2 py-1 bg-background rounded">+ más</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Ve a <strong>Configuración → Especialidades</strong> para seleccionar las tuyas.
            </p>
          </div>
        ),
      },
      {
        title: 'Información Médica',
        content: (
          <div className="space-y-4">
            <p>
              Puedes agregar tu <strong>información médica personal</strong> para que rescatistas puedan ayudarte mejor en una emergencia.
            </p>
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileHeart className="w-5 h-5 text-destructive" />
                <p className="font-medium">Información opcional:</p>
              </div>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Tipo de sangre</li>
                <li>Alergias</li>
                <li>Condiciones médicas</li>
                <li>Medicamentos actuales</li>
                <li>Notas para emergencias</li>
              </ul>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Solo visible para rescatistas cuando hay una emergencia activa</span>
            </div>
          </div>
        ),
        tip: 'Esta información puede salvar tu vida si estás inconsciente',
      },
      {
        title: 'Contactos de Emergencia',
        content: (
          <div className="space-y-4">
            <p>
              Configura <strong>contactos de emergencia</strong> que serán notificados cuando envíes una alerta SOS.
            </p>
            <div className="bg-primary/10 rounded-lg p-4 space-y-2">
              <p className="font-medium">Para cada contacto puedes agregar:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Nombre completo</li>
                <li>Número de teléfono</li>
                <li>WhatsApp</li>
                <li>Relación (familiar, amigo, etc.)</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              Ve a <strong>Configuración → Contactos de Emergencia</strong> para configurarlos.
            </p>
          </div>
        ),
        important: true,
      },
      {
        title: 'Privacidad y Ubicación',
        content: (
          <div className="space-y-4">
            <p>
              Tú controlas quién puede ver tu <strong>ubicación</strong> y tu <strong>información</strong>.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span className="text-sm">Compartir ubicación</span>
                </div>
                <div className="w-10 h-5 bg-primary rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  <span className="text-sm">Mostrar nombre en mapa</span>
                </div>
                <div className="w-10 h-5 bg-primary rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Si desactivas tu ubicación, no podrás recibir alertas de emergencias cercanas.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'resources',
    title: 'Recursos',
    icon: <BookOpen className="w-6 h-6" />,
    color: 'text-accent',
    steps: [
      {
        title: '📚 Guías de Apoyo en Emergencias',
        content: (
          <div className="space-y-4">
            <p>
              La sección <strong>Recursos</strong> contiene guías rápidas para saber cómo actuar en diferentes situaciones de emergencia o desastre.
            </p>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-warning mb-1">Importante</p>
                  <p className="text-sm">
                    Estos recursos son <strong>material de apoyo básico</strong>. No sustituyen capacitación profesional, supervisión médica ni protocolos locales oficiales.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              En riesgo vital, siempre activa los servicios de emergencia (911).
            </p>
          </div>
        ),
        important: true,
      },
      {
        title: 'Categorías de Recursos',
        content: (
          <div className="space-y-4">
            <p>
              Encontrarás guías organizadas por <strong>categorías</strong> para acceder rápidamente a lo que necesitas:
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted rounded p-2 text-center">🏠 Preparación</div>
              <div className="bg-muted rounded p-2 text-center">📞 Comunicación</div>
              <div className="bg-muted rounded p-2 text-center">🚨 Evacuación</div>
              <div className="bg-muted rounded p-2 text-center">⚠️ Amenazas</div>
              <div className="bg-muted rounded p-2 text-center">🩹 Primeros Auxilios</div>
              <div className="bg-muted rounded p-2 text-center">🏥 Salud Pública</div>
              <div className="bg-muted rounded p-2 text-center">🧠 Salud Mental</div>
              <div className="bg-muted rounded p-2 text-center">🏕️ Refugios</div>
            </div>
          </div>
        ),
      },
      {
        title: 'Niveles de Contenido',
        content: (
          <div className="space-y-4">
            <p>
              Cada recurso tiene un <strong>nivel</strong> que indica su complejidad:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-safe/10 rounded-lg border border-safe/30">
                <div className="w-6 h-6 rounded-full bg-safe flex items-center justify-center text-white text-xs font-bold">B</div>
                <div>
                  <p className="font-medium text-safe">Básico</p>
                  <p className="text-sm text-muted-foreground">Cualquier persona puede aplicar estas guías</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/30">
                <div className="w-6 h-6 rounded-full bg-warning flex items-center justify-center text-white text-xs font-bold">I</div>
                <div>
                  <p className="font-medium text-warning">Intermedio</p>
                  <p className="text-sm text-muted-foreground">Requiere algo de conocimiento previo</p>
                </div>
              </div>
            </div>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <p className="text-sm font-medium text-destructive">
                ⚕️ Algunas guías están marcadas como <strong>"Solo personal capacitado"</strong>. Estas incluyen procedimientos que requieren entrenamiento formal.
              </p>
            </div>
          </div>
        ),
        tip: 'Los recursos marcados para personal capacitado muestran técnicas avanzadas de rescate y primeros auxilios',
      },
      {
        title: 'Funciones de Recursos',
        content: (
          <div className="space-y-4">
            <p>
              La sección de Recursos incluye varias funciones útiles:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Heart className="w-5 h-5 text-panic mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Favoritos</p>
                  <p className="text-sm text-muted-foreground">Guarda las guías que más uses para acceso rápido</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Eye className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Recientes</p>
                  <p className="text-sm text-muted-foreground">Accede rápido a las guías que has visto recientemente</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Los recursos están disponibles <strong>sin conexión</strong> una vez que los hayas cargado.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    icon: <ShoppingBag className="w-6 h-6" />,
    color: 'text-accent',
    steps: [
      {
        title: '🛒 Marketplace Comunitario',
        content: (
          <div className="space-y-4">
            <p>
              El <strong>Marketplace</strong> es un espacio para que la comunidad ofrezca y encuentre <strong>productos y servicios</strong> entre sus miembros.
            </p>
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
              <p className="font-medium text-accent mb-2">¿Qué puedes hacer?</p>
              <ul className="text-sm space-y-2 list-disc list-inside">
                <li><strong>Publicar</strong> productos o servicios que ofreces</li>
                <li><strong>Buscar</strong> lo que necesitas en la comunidad</li>
                <li><strong>Contactar</strong> directamente a vendedores</li>
                <li><strong>Filtrar</strong> por categoría y precio</li>
              </ul>
            </div>
          </div>
        ),
        tip: 'Fortalece la economía local comprando y vendiendo dentro de la comunidad',
      },
      {
        title: 'Categorías Disponibles',
        content: (
          <div className="space-y-4">
            <p>
              Organiza tus publicaciones y búsquedas por <strong>categoría</strong>:
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted rounded p-2 text-center">🛠️ Servicios</div>
              <div className="bg-muted rounded p-2 text-center">📦 Productos</div>
              <div className="bg-muted rounded p-2 text-center">🏠 Hogar</div>
              <div className="bg-muted rounded p-2 text-center">🚗 Vehículos</div>
              <div className="bg-muted rounded p-2 text-center">👔 Ropa</div>
              <div className="bg-muted rounded p-2 text-center">📱 Tecnología</div>
            </div>
            <p className="text-sm text-muted-foreground">
              Cada publicación tiene una <strong>vigencia</strong> que defines al publicar.
            </p>
          </div>
        ),
      },
      {
        title: 'Cómo Publicar',
        content: (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="font-medium mb-2">Para crear una publicación:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Ve a la sección <strong>Marketplace</strong></li>
                <li>Presiona el botón <strong>"Publicar"</strong></li>
                <li>Agrega título, descripción y categoría</li>
                <li>Define el precio (opcional) y vigencia</li>
                <li>Sube hasta 5 fotos de tu producto</li>
              </ol>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm font-medium text-primary">
                💡 Los interesados te contactarán por el chat interno de M.A.T.S.
              </p>
            </div>
          </div>
        ),
        tip: 'Puedes editar o eliminar tus publicaciones en cualquier momento desde "Mis publicaciones"',
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
        title: '¡Estás listo para empezar!',
        content: (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-safe/20 flex items-center justify-center">
                <Check className="w-10 h-10 text-safe" />
              </div>
              <p className="text-lg font-medium">
                Ya conoces lo esencial de M.A.T.S.
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <p className="font-medium">Próximos pasos recomendados:</p>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs">1</div>
                  <span>Configura tus <strong>contactos de emergencia</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs">2</div>
                  <span>Activa tu <strong>ubicación</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs">3</div>
                  <span>Selecciona tu <strong>rol y especialidades</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs">4</div>
                  <span>Agrega tu <strong>información médica</strong></span>
                </li>
              </ul>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
              <p className="font-medium text-primary">
                🤝 Bienvenido a la familia M.A.T.S.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Juntos nos cuidamos. Juntos somos más fuertes.
              </p>
            </div>
          </div>
        ),
      },
      {
        title: '🔒 Comunidad Exclusiva',
        content: (
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-center">
              <Lock className="w-10 h-10 text-warning mx-auto mb-2" />
              <p className="font-bold text-warning text-lg">Comunidad Cerrada</p>
            </div>
            <p className="text-center">
              <strong>M.A.T.S.</strong> es una aplicación <strong>exclusiva y cerrada</strong> para:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Shield className="w-5 h-5 text-mats-green flex-shrink-0" />
                <p className="text-sm"><strong>Miembros activos</strong> de la comunidad SOS de todo el mundo</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Users className="w-5 h-5 text-primary flex-shrink-0" />
                <p className="text-sm"><strong>Ex-miembros</strong> de brigadas de rescate y emergencias</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Heart className="w-5 h-5 text-panic flex-shrink-0" />
                <p className="text-sm"><strong>Familiares directos</strong> de los miembros de la comunidad</p>
              </div>
            </div>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="text-sm text-center">
                <strong>El acceso es solo por invitación.</strong><br/>
                No compartir códigos de acceso con personas fuera de nuestra red de confianza.
              </p>
            </div>
          </div>
        ),
        important: true,
      },
      {
        title: '💪 Tu Compromiso con la Comunidad',
        content: (
          <div className="space-y-4">
            <p className="text-center font-medium">
              Como miembro de M.A.T.S., te comprometes a:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-safe/10 rounded-lg border border-safe/30">
                <Check className="w-5 h-5 text-safe mt-0.5 flex-shrink-0" />
                <p className="text-sm"><strong>Reportar tu estado</strong> después de sismos o emergencias para mantener informada a la comunidad</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-safe/10 rounded-lg border border-safe/30">
                <Check className="w-5 h-5 text-safe mt-0.5 flex-shrink-0" />
                <p className="text-sm"><strong>Responder cuando puedas</strong> a las alertas de otros miembros cercanos</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-safe/10 rounded-lg border border-safe/30">
                <Check className="w-5 h-5 text-safe mt-0.5 flex-shrink-0" />
                <p className="text-sm"><strong>Mantener la confidencialidad</strong> de la información de otros miembros</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-safe/10 rounded-lg border border-safe/30">
                <Check className="w-5 h-5 text-safe mt-0.5 flex-shrink-0" />
                <p className="text-sm"><strong>Usar las alertas responsablemente</strong> - solo en emergencias reales</p>
              </div>
            </div>
            
            {/* Disclaimer */}
            <div className="bg-muted/50 border border-border rounded-lg p-4 mt-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Importante:</strong> M.A.T.S., sus desarrolladores y creadores, no se responsabilizan por el tipo, recursos, tiempo de respuesta ni efectividad de la respuesta a tus emergencias, así como tampoco por la disponibilidad de esta aplicación. Es responsabilidad de toda la comunidad el ofrecer el mejor apoyo disponible entre todos. Tampoco se responsabiliza a los usuarios que piden y ofrecen ayuda, todo es en un tenor voluntario y en la mejor disposición posible.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-3 font-medium">
                Al aceptar el uso de esta app, aceptas la liberación de responsabilidad de cualquier miembro de esta comunidad, a los desarrolladores, creadores y usuarios de esta aplicación.
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
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [showDisclaimerError, setShowDisclaimerError] = useState(false);

  const section = TUTORIAL_SECTIONS[currentSection];
  const step = section.steps[currentStep];
  const totalSteps = TUTORIAL_SECTIONS.reduce((acc, s) => acc + s.steps.length, 0);
  
  // Calculate global step number
  let globalStep = 0;
  for (let i = 0; i < currentSection; i++) {
    globalStep += TUTORIAL_SECTIONS[i].steps.length;
  }
  globalStep += currentStep + 1;

  // Celebration confetti animation
  const triggerCelebration = useCallback(() => {
    // First burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff6b35', '#f7c94b', '#4ade80', '#3b82f6', '#a855f7'],
    });

    // Second burst after small delay
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ff6b35', '#f7c94b', '#4ade80'],
      });
    }, 150);

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#3b82f6', '#a855f7', '#f7c94b'],
      });
    }, 300);
  }, []);

  const handleNext = async () => {
    if (currentStep < section.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else if (currentSection < TUTORIAL_SECTIONS.length - 1) {
      setCurrentSection(prev => prev + 1);
      setCurrentStep(0);
    } else {
      // Tutorial completed - trigger celebration!
      triggerCelebration();
      localStorage.setItem('comprehensive-tutorial-complete', 'true');
      
      // Save disclaimer acceptance to database
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ tutorial_disclaimer_accepted_at: new Date().toISOString() })
            .eq('id', user.id);
          console.log('[Tutorial] Disclaimer acceptance saved to database');
        }
      } catch (error) {
        console.error('[Tutorial] Error saving disclaimer acceptance:', error);
      }
      
      // Show success toast
      toast.success('¡Tutorial completado!', {
        description: 'Ya estás listo para usar M.A.T.S. Bienvenido a la comunidad.',
        duration: 5000,
      });
      
      // Small delay to let confetti show before closing
      setTimeout(() => {
        onComplete();
      }, 800);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else if (currentSection > 0) {
      const prevSection = TUTORIAL_SECTIONS[currentSection - 1];
      setCurrentSection(prev => prev - 1);
      setCurrentStep(prevSection.steps.length - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('comprehensive-tutorial-complete', 'true');
    onComplete();
  };

  const handleJumpToSection = (sectionIndex: number) => {
    setCurrentSection(sectionIndex);
    setCurrentStep(0);
    setShowTableOfContents(false);
  };

  const isFirstStep = currentSection === 0 && currentStep === 0;
  const isLastStep = currentSection === TUTORIAL_SECTIONS.length - 1 && 
                     currentStep === section.steps.length - 1;

  return (
    <div className="fixed inset-0 z-[10000] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <MatsLogo size={28} />
          <div>
            <h1 className="text-sm font-semibold">Tutorial Completo</h1>
            <p className="text-xs text-muted-foreground">{section.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowTableOfContents(true)}
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Índice
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Section tabs with navigation hint for first page */}
      <div className="relative">
        {/* Arrow hint for first page on mobile */}
        {isFirstStep && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 text-primary"
          >
            <motion.div
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <ChevronRight className="w-5 h-5" />
            </motion.div>
            <span className="text-xs font-medium bg-background/80 px-1 rounded">Desliza</span>
          </motion.div>
        )}
        
        <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-none border-b border-border bg-muted/30">
          {TUTORIAL_SECTIONS.map((s, index) => (
            <button
              key={s.id}
              onClick={() => handleJumpToSection(index)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                index === currentSection
                  ? 'bg-primary text-primary-foreground'
                  : index < currentSection
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {/* Icon with proper color - white when selected to avoid red-on-red */}
              <span className={cn(
                'w-4 h-4',
                index === currentSection 
                  ? 'text-primary-foreground' 
                  : s.color
              )}>
                {s.icon}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(globalStep / totalSteps) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentSection}-${currentStep}`}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ 
              duration: 0.25, 
              ease: [0.4, 0, 0.2, 1],
              opacity: { duration: 0.2 }
            }}
            className="p-6 max-w-lg mx-auto"
          >
            {/* Step title */}
            <motion.div 
              className="flex items-center gap-3 mb-6"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              <motion.div 
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  step.important 
                    ? 'bg-destructive/20 animate-pulse' 
                    : 'bg-muted'
                )}
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.05, type: "spring", stiffness: 300, damping: 20 }}
              >
                <span className={cn('w-6 h-6', section.color)}>
                  {section.icon}
                </span>
              </motion.div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{step.title}</h2>
              </div>
            </motion.div>

            {/* Step content */}
            <motion.div 
              className="mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.25 }}
            >
              {step.content}
            </motion.div>

            {/* Disclaimer acceptance checkbox and button for final step */}
            {isLastStep && (
              <div className="space-y-4 mb-6">
                <motion.label 
                  data-disclaimer-checkbox
                  animate={showDisclaimerError ? { 
                    x: [0, -10, 10, -10, 10, 0],
                    transition: { duration: 0.5 }
                  } : {}}
                  className={cn(
                    "flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 transition-all duration-300",
                    showDisclaimerError 
                      ? "border-destructive bg-destructive/10 shadow-[0_0_15px_rgba(239,68,68,0.3)]" 
                      : disclaimerAccepted 
                        ? "border-safe bg-safe/10"
                        : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => showDisclaimerError && setShowDisclaimerError(false)}
                >
                  <input
                    type="checkbox"
                    checked={disclaimerAccepted}
                    onChange={(e) => {
                      setDisclaimerAccepted(e.target.checked);
                      if (e.target.checked) setShowDisclaimerError(false);
                    }}
                    className={cn(
                      "mt-0.5 w-5 h-5 rounded focus:ring-2",
                      showDisclaimerError 
                        ? "border-destructive text-destructive focus:ring-destructive" 
                        : "border-border text-primary focus:ring-primary"
                    )}
                  />
                  <span className={cn(
                    "text-sm",
                    showDisclaimerError ? "text-destructive font-medium" : "text-foreground"
                  )}>
                    He leído y acepto los términos de uso y la liberación de responsabilidad descritos anteriormente.
                  </span>
                </motion.label>
                
                {showDisclaimerError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-destructive font-medium flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Debes aceptar los términos para continuar
                  </motion.p>
                )}
                
                <Button 
                  size="lg" 
                  className="w-full text-lg py-6"
                  onClick={handleNext}
                  disabled={!disclaimerAccepted}
                >
                  <Check className="w-5 h-5 mr-2" />
                  ¡Entendido!
                </Button>
              </div>
            )}

            {/* Tip box */}
            {step.tip && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 mb-6">
                <p className="text-sm text-primary">
                  💡 <strong>Tip:</strong> {step.tip}
                </p>
              </div>
            )}

            {/* Step dots for current section */}
            {section.steps.length > 1 && (
              <div className="flex justify-center gap-2 mb-4">
                {section.steps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-all',
                      index === currentStep 
                        ? 'w-6 bg-primary' 
                        : index < currentStep
                          ? 'bg-primary/50'
                          : 'bg-muted'
                    )}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation - fixed at bottom with safe area padding */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[10002] p-4 border-t border-border bg-background"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={isFirstStep}
            className={cn(isFirstStep && 'invisible')}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>

          <div className="text-center">
            <span className="text-xs text-muted-foreground">
              {globalStep} / {totalSteps}
            </span>
          </div>

          {isLastStep ? (
            <Button 
              onClick={() => {
                if (!disclaimerAccepted) {
                  setShowDisclaimerError(true);
                  // Scroll to checkbox
                  document.querySelector('[data-disclaimer-checkbox]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                  handleNext();
                }
              }}
              className={!disclaimerAccepted ? 'opacity-50' : ''}
            >
              <Check className="w-4 h-4 mr-1" />
              ¡Entendido!
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
        
        {/* Skip button */}
        <div className="text-center mt-3">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Omitir tutorial
          </button>
        </div>
      </div>

      {/* Table of Contents Drawer */}
      <AnimatePresence>
        {showTableOfContents && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] bg-background/80 backdrop-blur-sm"
            onClick={() => setShowTableOfContents(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-background border-l border-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">Índice del Tutorial</h3>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowTableOfContents(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4 space-y-2 overflow-auto max-h-[calc(100vh-80px)]">
                {TUTORIAL_SECTIONS.map((s, sIndex) => (
                  <div key={s.id}>
                    <button
                      onClick={() => handleJumpToSection(sIndex)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                        sIndex === currentSection
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      )}
                    >
                      <span className={cn('w-5 h-5', s.color)}>{s.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{s.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.steps.length} paso{s.steps.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      {sIndex < currentSection && (
                        <Check className="w-4 h-4 text-safe" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ComprehensiveTutorial;
