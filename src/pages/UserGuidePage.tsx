// M.A.T.S. User Guide - Printable/PDF documentation (Print-optimized with white background)
import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Map, 
  Activity, 
  Car, 
  Users, 
  BookOpen, 
  Settings, 
  Bell, 
  AlertTriangle,
  Navigation,
  Phone,
  MessageCircle,
  Wifi,
  Heart,
  Zap,
  Radio,
  Camera,
  Mic,
  Clock,
  MapPin,
  Route,
  Eye,
  Share2,
  Download,
  Printer,
  ArrowUp,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatsLogo } from '@/components/MatsLogo';
import { APP_VERSION } from '@/lib/versionCheck';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function UserGuidePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    
    setIsGeneratingPdf(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const options = {
        margin: [15, 15, 15, 15],
        filename: `MATS_Guia_Usuario_v${APP_VERSION}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(options).from(contentRef.current).save();
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF. Intenta usar la opción de imprimir.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen h-screen bg-white overflow-y-auto">
      {/* Action Buttons - Hidden when printing */}
      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2 flex-wrap justify-end">
        <Button 
          onClick={handleDownloadPdf} 
          className="shadow-lg bg-orange-500 hover:bg-orange-600 text-white"
          disabled={isGeneratingPdf}
        >
          {isGeneratingPdf ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
        </Button>
        <Button onClick={handlePrint} variant="outline" className="shadow-lg border-gray-300 text-gray-700 hover:bg-gray-100">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
        <Button variant="outline" onClick={() => window.history.back()} className="border-gray-300 text-gray-700 hover:bg-gray-100">
          Volver
        </Button>
      </div>

      {/* Document Content - White background for print optimization */}
      <div ref={contentRef} className="max-w-4xl mx-auto p-8 print:p-4 print:max-w-none bg-white">
        
        {/* Cover Page */}
        <header className="text-center mb-16 print:mb-8 page-break-after">
          <div className="flex justify-center mb-6">
            <MatsLogo size={96} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            M.A.T.S.
          </h1>
          <h2 className="text-2xl text-orange-600 mb-2 font-medium">
            Monitoreo Activo de Tránsito y Seguridad
          </h2>
          <p className="text-lg text-gray-700 font-medium mb-8">
            Comunidad EX SOS
          </p>
          <div className="inline-block bg-gray-100 border border-gray-200 rounded-lg px-6 py-4">
            <p className="text-base text-gray-700 font-medium">Guía del Usuario</p>
            <p className="text-sm text-gray-800 font-semibold mt-1">Versión {APP_VERSION}</p>
          </div>
        </header>

        {/* Table of Contents */}
        <section className="mb-12 print:mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-orange-500" />
            Contenido
          </h2>
          <nav className="space-y-2 text-gray-800">
            <div className="flex justify-between border-b border-gray-200 pb-1">
              <span>1. Introducción</span>
              <span className="text-gray-500">1</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-1">
              <span>2. Mapa en Tiempo Real</span>
              <span className="text-gray-500">2</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-1">
              <span>3. Alertas Sísmicas y Naturales</span>
              <span className="text-gray-500">3</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-1">
              <span>4. Tránsito y Viajes</span>
              <span className="text-gray-500">4</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-1">
              <span>5. Comunidad</span>
              <span className="text-gray-500">5</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-1">
              <span>6. RecurSOS - Recursos</span>
              <span className="text-gray-500">6</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-1">
              <span>7. Configuración y Perfil</span>
              <span className="text-gray-500">7</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-1">
              <span>8. Funciones de Emergencia</span>
              <span className="text-gray-500">8</span>
            </div>
          </nav>
        </section>

        {/* Section 1: Introduction */}
        <section className="mb-12 print:mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            1. Introducción
          </h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong className="text-gray-900">M.A.T.S.</strong> (Monitoreo Activo de Tránsito y Seguridad) es una plataforma 
              integral de seguridad comunitaria diseñada para la respuesta ante desastres y ayuda mutua. 
              Desarrollada por la <strong className="text-gray-900">Comunidad EX SOS</strong>, esta aplicación proporciona herramientas 
              de coordinación en tiempo real, alertas sísmicas, seguimiento de viajes y comunicación comunitaria.
            </p>
            
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Roles de Usuario</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Familiar:</strong> Usuario estándar con acceso a todas las funciones básicas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Rescatista:</strong> Personal capacitado que puede responder a emergencias</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">SOS Activo:</strong> Miembro activo con capacidades administrativas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">EX SOS:</strong> Miembro veterano con privilegios extendidos</span>
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Requisitos</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Navegador web moderno (Chrome, Safari, Firefox)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Permiso de ubicación GPS (recomendado)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Permiso de notificaciones (para alertas en tiempo real)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Conexión a internet</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 2: Real-time Map */}
        <section className="mb-12 print:mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Map className="w-6 h-6 text-orange-500" />
            2. Mapa en Tiempo Real
          </h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              El mapa interactivo es el corazón de M.A.T.S., mostrando la ubicación de todos los 
              miembros de la comunidad que comparten su ubicación, así como eventos y alertas activas.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Funcionalidades</h3>
            
            <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-orange-500" />
                  Ubicación de Miembros
                </h4>
                <p className="text-sm text-gray-600">
                  Visualiza la ubicación en tiempo real de los miembros de la comunidad con iconos 
                  diferenciados según su rol y especialidad.
                </p>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <Navigation className="w-4 h-4 text-orange-500" />
                  Viajeros Activos
                </h4>
                <p className="text-sm text-gray-600">
                  Muestra los viajes en curso con velocidad actual, destino y ETA estimado.
                </p>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Reportes de Carretera
                </h4>
                <p className="text-sm text-gray-600">
                  Visualiza reportes comunitarios de bloqueos, accidentes, manifestaciones y otros incidentes.
                </p>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <Radio className="w-4 h-4 text-orange-500" />
                  Filtro por Especialidad
                </h4>
                <p className="text-sm text-gray-600">
                  Filtra el mapa para mostrar solo miembros con habilidades específicas 
                  (paramédicos, bomberos, radioaficionados, etc.).
                </p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Modos de Vista</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Comunidad:</strong> Vista estándar con todos los miembros</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">En Vivo:</strong> Modo de respuesta a desastres con información filtrada</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 3: Seismic Alerts */}
        <section className="mb-12 print:mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-orange-500" />
            3. Alertas Sísmicas y Naturales
          </h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              M.A.T.S. integra múltiples fuentes de datos sísmicos y de desastres naturales 
              para proporcionar alertas tempranas y monitoreo continuo.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Fuentes de Datos</h3>
            <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">🇲🇽 SSN (México)</h4>
                <p className="text-sm text-gray-600">
                  Servicio Sismológico Nacional - sismos detectados en territorio mexicano.
                </p>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">🌍 USGS (Global)</h4>
                <p className="text-sm text-gray-600">
                  United States Geological Survey - sismos a nivel mundial.
                </p>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">⚡ SkyAlert</h4>
                <p className="text-sm text-gray-600">
                  Alertas sísmicas en tiempo real con tiempos de arribo de ondas P y S.
                </p>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">🌀 NHC / GDACS</h4>
                <p className="text-sm text-gray-600">
                  Huracanes, ciclones tropicales y alertas internacionales.
                </p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Pestañas Disponibles</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Sismos:</strong> Lista de sismos recientes con magnitud y distancia</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">SkyAlert:</strong> Alertas sísmicas en tiempo real</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">México:</strong> Ciclones tropicales y puntos de calor (incendios)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Internacional:</strong> Alertas GDACS y AEMET</span>
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Check-in "Todo Bien"</h3>
            <p className="text-gray-700">
              Después de un sismo significativo, puedes reportar que estás bien con el botón 
              "Todo bien" para que la comunidad sepa tu estado.
            </p>
          </div>
        </section>

        {/* Section 4: Transit */}
        <section className="mb-12 print:mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Car className="w-6 h-6 text-orange-500" />
            4. Tránsito y Viajes
          </h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              El módulo de Tránsito te permite registrar viajes, compartir tu ubicación en tiempo real, 
              y reportar incidentes en carretera para la comunidad.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Iniciar un Viaje</h3>
            <ol className="space-y-2 text-gray-700 list-decimal list-inside">
              <li>Selecciona el tipo de viaje (Carretera, Vuelo, Taxi, etc.)</li>
              <li>Ingresa el origen y destino</li>
              <li>Configura la hora estimada de llegada (ETA)</li>
              <li>Opcionalmente, agrega foto del vehículo y placas</li>
              <li>Para vuelos: número de vuelo y pase de abordar</li>
            </ol>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Durante el Viaje</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Tu ubicación se actualiza automáticamente en el mapa</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>El ETA se recalcula basado en tu velocidad actual</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Se registra el historial de tu ruta</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Puedes compartir un enlace de seguimiento con familiares</span>
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Reportes de Carretera</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Tipos de reportes disponibles:</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                <span>🚧 Bloqueo</span>
                <span>🚨 Accidente</span>
                <span>✊ Manifestación</span>
                <span>⚠️ Peligro</span>
                <span>🔧 Tramo en reparación</span>
                <span>🚛 Tráfico pesado</span>
                <span>🛑 Tráfico detenido</span>
                <span>🌫️ Neblina</span>
                <span>❄️ Granizo/Nieve</span>
                <span>⛔ Caseta cerrada</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Community */}
        <section className="mb-12 print:mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" />
            5. Comunidad
          </h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              La sección de Comunidad es el espacio social de M.A.T.S., donde puedes compartir 
              eventos, ver noticias y conectar con otros miembros.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Pestañas</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-orange-500" />
                  Tablero
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  Publicaciones de la comunidad incluyendo:
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>🎂 Cumpleaños</li>
                  <li>📅 Eventos</li>
                  <li>💍 Aniversarios</li>
                  <li>🕯️ Decesos</li>
                  <li>📰 Noticias relevantes</li>
                  <li>💡 Recomendaciones</li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <Car className="w-4 h-4 text-orange-500" />
                  Viajeros
                </h4>
                <p className="text-sm text-gray-600">
                  Lista de viajes activos de la comunidad. Puedes ver la ubicación en tiempo real 
                  de cualquier viajero y su ruta recorrida.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  Breaking News
                </h4>
                <p className="text-sm text-gray-600">
                  Noticias de emergencia en tiempo real de fuentes mexicanas.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-orange-500" />
                  Sala de Lectura
                </h4>
                <p className="text-sm text-gray-600">
                  Colección de recursos educativos y de emergencia.
                </p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Mensajería Interna</h3>
            <p className="text-gray-700">
              Puedes enviar mensajes directos a otros miembros de la comunidad, incluyendo 
              texto, imágenes y notas de voz.
            </p>
          </div>
        </section>

        {/* Section 6: Resources */}
        <section className="mb-12 print:mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-orange-500" />
            6. RecurSOS - Recursos
          </h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              RecurSOS es una biblioteca de recursos de emergencia, médicos y educativos 
              organizados por categorías para fácil acceso.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Categorías</h3>
            <div className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
              <div className="flex items-center gap-2 text-gray-700">
                <span>🌤️</span><span>Clima y Fenómenos Naturales</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span>💰</span><span>Finanzas y Economía</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span>📖</span><span>Diccionario de Emergencias</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span>🥗</span><span>Nutrición</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span>⚕️</span><span>Información Médica</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span>📚</span><span>Libros y Manuales</span>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Funcionalidades</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Búsqueda por texto y voz</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Filtros por categoría, audiencia y nivel</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Favoritos para acceso rápido</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Historial de recursos vistos</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 7: Settings */}
        <section className="mb-12 print:mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-6 h-6 text-orange-500" />
            7. Configuración y Perfil
          </h2>
          <div className="prose prose-slate max-w-none">
            
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Perfil de Usuario</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Nombre completo y apodo:</strong> Cómo te identificas en la comunidad</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Especialidades:</strong> Habilidades que puedes ofrecer en emergencias</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Información médica:</strong> Tipo de sangre, alergias, medicamentos (opcional)</span>
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Privacidad</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Compartir ubicación:</strong> Activar/desactivar el compartir tu ubicación</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Mostrar nombre en mapa:</strong> Si tu nombre aparece junto a tu marcador</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span><strong className="text-gray-900">Compartir info médica:</strong> Disponibilidad de tu información médica en emergencias</span>
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Notificaciones</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Alertas sísmicas (SkyAlert, SSN, USGS)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Alertas de ciclones e incendios</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Mensajes de la comunidad</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Alertas Clave 100</span>
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Contactos de Emergencia</h3>
            <p className="text-gray-700">
              Puedes registrar contactos de emergencia que serán notificados automáticamente 
              cuando uses el botón de pánico o cuando un viaje se retrase.
            </p>
          </div>
        </section>

        {/* Section 8: Emergency Functions */}
        <section className="mb-12 print:mb-8 page-break-before">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            8. Funciones de Emergencia
          </h2>
          <div className="prose prose-slate max-w-none">
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-gray-900 font-medium">
                ⚠️ Estas funciones están diseñadas para situaciones reales de emergencia.
                Úsalas responsablemente.
              </p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Botón de Pánico</h3>
            <p className="text-gray-700 mb-4">
              El botón de pánico envía una alerta inmediata a los rescatistas cercanos con:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                <span>Tu ubicación GPS exacta</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                <span>Mensaje de texto o nota de voz (opcional)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                <span>Foto de la situación (opcional)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                <span>Tu información médica (si está compartida)</span>
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Ayuda 14 (Daños por Sismo)</h3>
            <p className="text-gray-700">
              Función especializada para reportar daños después de un sismo. Permite documentar 
              la situación con fotos y notas de voz para una respuesta coordinada.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Clave 100</h3>
            <p className="text-gray-700 mb-4">
              Sistema de comunicación prioritaria para situaciones críticas. Incluye:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Check-in masivo de la comunidad</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Chat de emergencia grupal</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Simulacros programados</span>
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Respuesta a Emergencias</h3>
            <p className="text-gray-700">
              Cuando alguien activa una emergencia, los rescatistas cercanos reciben una notificación 
              y pueden indicar que van en camino. El sistema muestra:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Quién está respondiendo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Tiempo estimado de llegada</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Ruta del rescatista en tiempo real</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200 text-center">
          <div className="flex justify-center mb-4">
            <MatsLogo size={48} />
          </div>
          <p className="text-base text-orange-600 font-medium">
            M.A.T.S. - Monitoreo Activo de Tránsito y Seguridad
          </p>
          <p className="text-sm text-gray-700 mt-1">
            Comunidad EX SOS • Versión {APP_VERSION}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Este documento fue generado desde la aplicación M.A.T.S.
          </p>
        </footer>
      </div>

      {/* Print Styles - Optimized for white background printing */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          
          * {
            background-color: transparent !important;
          }
          
          .bg-gray-50, .bg-gray-100 {
            background-color: #f9fafb !important;
          }
          
          .page-break-before {
            page-break-before: always;
          }
          
          .page-break-after {
            page-break-after: always;
          }
          
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          h1, h2, h3, h4, strong {
            color: #111827 !important;
          }
          
          p, li, span {
            color: #374151 !important;
          }
        }
      `}</style>

      {/* Scroll to Top Button */}
      <Button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-6 right-6 z-50 rounded-full w-12 h-12 p-0 shadow-lg transition-all duration-300 print:hidden bg-orange-500 hover:bg-orange-600",
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
        size="icon"
        aria-label="Volver al inicio"
      >
        <ArrowUp className="w-5 h-5 text-white" />
      </Button>
    </div>
  );
}
