import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Download, 
  Smartphone, 
  Share, 
  Plus, 
  MoreVertical, 
  Check, 
  ArrowLeft,
  Monitor,
  Apple,
  Chrome,
  Zap,
  Wifi,
  Bell,
  Shield,
  ChevronDown
} from "lucide-react";
import { Link } from "react-router-dom";
import { MatsLogo } from "@/components/MatsLogo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import QRCode from "qrcode";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "windows" | "mac";

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>("windows");
  const [installing, setInstalling] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const installUrl = typeof window !== 'undefined' ? `${window.location.origin}/install` : 'https://safe-guard-link.lovable.app/install';

  // Generate QR code
  useEffect(() => {
    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL(installUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error("Error generating QR code:", err);
      }
    };
    generateQR();
  }, [installUrl]);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /android/.test(ua);
    const isMac = /macintosh|mac os x/.test(ua) && !isIOS;
    
    if (isIOS) {
      setDetectedPlatform("ios");
    } else if (isAndroid) {
      setDetectedPlatform("android");
    } else if (isMac) {
      setDetectedPlatform("mac");
    } else {
      setDetectedPlatform("windows");
    }

    // Handle beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setIsStandalone(true);
        }
      } finally {
        setInstalling(false);
        setDeferredPrompt(null);
      }
    }
  };

  const getPlatformLabel = (platform: Platform) => {
    switch (platform) {
      case "android": return "Android";
      case "ios": return "iPhone / iPad";
      case "windows": return "Windows";
      case "mac": return "Mac";
    }
  };

  if (isStandalone) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto animate-in zoom-in duration-500">
            <Check className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">¡Ya está instalada!</h2>
          <p className="text-muted-foreground text-lg">
            La aplicación M.A.T.S. for Emergency Personnel ya está instalada en tu dispositivo. Puedes cerrar esta ventana.
          </p>
          <Link to="/">
            <Button size="lg" className="mt-4">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Ir a la App
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-background to-muted/30 overflow-y-auto">
      <Helmet>
        <title>Instalar M.A.T.S. for Emergency Personnel en tu teléfono | M.A.T.S.</title>
        <meta name="description" content="Instala la app M.A.T.S. for Emergency Personnel (M.A.T.S.) en Android, iPhone o PC en menos de un minuto: alertas sísmicas, botón SOS y seguimiento de viajes sin tienda de apps." />
        <link rel="canonical" href="https://mats-app.com/install" />
        <meta property="og:title" content="Instalar M.A.T.S. for Emergency Personnel en tu teléfono | M.A.T.S." />
        <meta property="og:url" content="https://mats-app.com/install" />
        <meta property="og:description" content="Guía rápida para instalar la app de emergencias M.A.T.S. for Emergency Personnel en Android, iPhone o escritorio." />
      </Helmet>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <MatsLogo size={36} showText />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
              <Download className="h-10 w-10 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center border-4 border-background">
              <Check className="h-4 w-4 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Instala la App
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Accede más rápido a M.A.T.S. for Emergency Personnel desde tu pantalla de inicio
          </p>
          
          {/* Platform Detection Badge */}
          <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Smartphone className="h-4 w-4" />
            Detectamos: {getPlatformLabel(detectedPlatform)}
          </div>

          {/* QR Code Section */}
          {qrCodeUrl && (
            <div className="mt-8 flex flex-col items-center">
              <a
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-white rounded-2xl shadow-lg border border-border inline-block cursor-pointer hover:scale-[1.02] transition-transform"
                aria-label="Abrir enlace de instalación"
                title="Toca el código para abrir el enlace de instalación"
              >
                <img 
                  src={qrCodeUrl} 
                  alt="Código QR para instalar la app" 
                  className="w-40 h-40 md:w-48 md:h-48"
                />
              </a>
              <p className="mt-3 text-sm text-muted-foreground text-center">
                Escanea el código QR para abrir esta página en otro dispositivo
              </p>
              <a
                href={installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary mt-1 underline underline-offset-2"
              >
                ¿Estás en el mismo teléfono? Toca aquí para abrir la instalación
              </a>
            </div>
          )}
        </div>

        {/* Quick Install Button (when available) */}
        {deferredPrompt && (
          <Card className="mb-8 border-primary bg-gradient-to-r from-primary/10 to-primary/5 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-lg">¡Instalación rápida disponible!</h3>
                  <p className="text-muted-foreground">
                    Tu navegador soporta instalación directa con un solo clic
                  </p>
                </div>
                <Button 
                  size="lg" 
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="w-full sm:w-auto"
                >
                  {installing ? (
                    <>Instalando...</>
                  ) : (
                    <>
                      <Download className="h-5 w-5 mr-2" />
                      Instalar Ahora
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Benefits Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <BenefitCard icon={<Zap className="h-5 w-5" />} title="Acceso Rápido" description="Desde tu pantalla de inicio" />
          <BenefitCard icon={<Wifi className="h-5 w-5" />} title="Sin Conexión" description="Funciona offline" />
          <BenefitCard icon={<Bell className="h-5 w-5" />} title="Notificaciones" description="Alertas de emergencia" />
          <BenefitCard icon={<Shield className="h-5 w-5" />} title="Seguro" description="Sin tiendas de apps" />
        </div>

        {/* Instructions Sections */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center mb-6">
            Instrucciones por Plataforma
          </h2>

          <Accordion 
            type="single" 
            collapsible 
            defaultValue={detectedPlatform}
            className="space-y-4"
          >
            {/* Android Section */}
            <AccordionItem value="android" className="border rounded-xl overflow-hidden bg-card">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Android</p>
                    <p className="text-sm text-muted-foreground">Chrome, Samsung Internet, Edge, Huawei</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Chrome/Edge on Android */}
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
                      Google Chrome / Microsoft Edge
                    </h4>
                    <div className="space-y-4">
                      <InstallStep 
                        number={1}
                        title="Abre el menú del navegador"
                        description="Toca los 3 puntos verticales (⋮) en la esquina superior derecha"
                        visual={
                          <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary ring-offset-2 ring-offset-muted animate-pulse">
                              <MoreVertical className="h-5 w-5 text-primary" />
                            </div>
                          </div>
                        }
                      />
                      <InstallStep 
                        number={2}
                        title='Busca "Instalar aplicación"'
                        description='También puede aparecer como "Añadir a pantalla de inicio" o "Instalar app"'
                        visual={
                          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                            <Download className="h-5 w-5 text-primary" />
                            <span className="font-medium">Instalar aplicación</span>
                          </div>
                        }
                      />
                      <InstallStep 
                        number={3}
                        title="Confirma la instalación"
                        description='Toca "Instalar" en el diálogo que aparece. La app se añadirá a tu pantalla de inicio.'
                      />
                    </div>
                  </div>

                  {/* Samsung Internet */}
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
                      Samsung Internet
                    </h4>
                    <div className="space-y-4">
                      <InstallStep 
                        number={1}
                        title="Abre el menú del navegador"
                        description="Toca las 3 líneas horizontales (☰) en la barra inferior"
                      />
                      <InstallStep 
                        number={2}
                        title='Selecciona "Agregar página a"'
                        description='Luego elige "Pantalla de inicio"'
                      />
                      <InstallStep 
                        number={3}
                        title="Confirma"
                        description="El ícono de la app aparecerá en tu pantalla de inicio"
                      />
                    </div>
                  </div>

                  {/* Huawei (sin Google Play Services) */}
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="text-base">📱</span> Huawei (Sin Google Play Services)
                    </h4>
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                      <p className="text-sm">
                        <strong className="text-amber-600 dark:text-amber-400">💡 Buenas noticias:</strong> Los dispositivos Huawei sin Google Play Services funcionan perfectamente con esta aplicación web. No necesitas instalar nada de Google.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <InstallStep 
                        number={1}
                        title="Abre el Navegador Huawei"
                        description="Usa el navegador que viene preinstalado en tu Huawei o descarga Microsoft Edge desde AppGallery"
                        visual={
                          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                              <span className="text-lg">🌐</span>
                            </div>
                            <span className="font-medium">Navegador Huawei o Edge</span>
                          </div>
                        }
                      />
                      <InstallStep 
                        number={2}
                        title="Abre el menú del navegador"
                        description="Toca los 3 puntos (⋮) en la esquina inferior o superior derecha"
                      />
                      <InstallStep 
                        number={3}
                        title='Busca "Agregar a pantalla de inicio"'
                        description='También puede aparecer como "Crear acceso directo" o "Añadir a inicio"'
                        visual={
                          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                            <Plus className="h-5 w-5 text-primary" />
                            <span className="font-medium">Agregar a pantalla de inicio</span>
                          </div>
                        }
                      />
                      <InstallStep 
                        number={4}
                        title="Confirma la instalación"
                        description="La app se instalará sin necesidad de Play Store y funcionará como una app nativa"
                      />
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground">
                        <strong>✓ Compatible:</strong> Huawei P40, P50, Mate 40, Mate 50, Nova series y todos los dispositivos con HarmonyOS o EMUI sin Google Services.
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* iOS Section */}
            <AccordionItem value="ios" className="border rounded-xl overflow-hidden bg-card">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-500/10 flex items-center justify-center">
                    <Apple className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">iPhone / iPad</p>
                    <p className="text-sm text-muted-foreground">Safari (requerido)</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-6">
                  <p className="text-sm">
                    <strong className="text-amber-600 dark:text-amber-400">⚠️ Importante:</strong> En iPhone y iPad, <strong>solo Safari</strong> permite instalar aplicaciones web. Si estás usando Chrome u otro navegador, abre esta página en Safari primero.
                  </p>
                </div>

                <div className="space-y-4">
                  <InstallStep 
                    number={1}
                    title="Toca el botón Compartir"
                    description="Es el ícono cuadrado con una flecha hacia arriba, ubicado en la barra inferior de Safari"
                    visual={
                      <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center ring-2 ring-blue-500 ring-offset-2 ring-offset-muted">
                          <Share className="h-6 w-6 text-blue-500" />
                        </div>
                      </div>
                    }
                  />
                  <InstallStep 
                    number={2}
                    title='Busca "Agregar a pantalla de inicio"'
                    description="Desplázate hacia abajo en el menú de opciones hasta encontrar esta opción con el ícono +"
                    visual={
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <div className="w-8 h-8 rounded-lg bg-gray-500/20 flex items-center justify-center">
                          <Plus className="h-5 w-5 text-gray-600" />
                        </div>
                        <span className="font-medium">Agregar a pantalla de inicio</span>
                      </div>
                    }
                  />
                  <InstallStep 
                    number={3}
                    title='Toca "Agregar"'
                    description="Está en la esquina superior derecha. Puedes editar el nombre si lo deseas antes de agregar."
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Windows Section */}
            <AccordionItem value="windows" className="border rounded-xl overflow-hidden bg-card">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Monitor className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Windows</p>
                    <p className="text-sm text-muted-foreground">Chrome, Edge, Brave</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Chrome on Windows */}
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Chrome className="h-4 w-4" />
                      Google Chrome
                    </h4>
                    <div className="space-y-4">
                      <InstallStep 
                        number={1}
                        title="Busca el ícono de instalación"
                        description="En la barra de direcciones, del lado derecho, verás un ícono de monitor con una flecha hacia abajo"
                        visual={
                          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                            <div className="flex-1 h-8 bg-background rounded flex items-center px-3">
                              <span className="text-xs text-muted-foreground truncate">https://mats-app.com</span>
                            </div>
                            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center ring-2 ring-primary animate-pulse">
                              <Download className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                        }
                      />
                      <InstallStep 
                        number={2}
                        title='Haz clic en "Instalar"'
                        description="Aparecerá un cuadro de diálogo preguntando si deseas instalar la aplicación"
                      />
                      <InstallStep 
                        number={3}
                        title="¡Listo!"
                        description="La app se abrirá en su propia ventana y aparecerá en tu menú de inicio de Windows"
                      />
                    </div>
                  </div>

                  {/* Edge on Windows */}
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21.86 17.86q.14 0 .25.12.1.13.1.25t-.11.33l-.32.46-.43.53-.44.5q-.21.25-.38.42l-.22.23q-.58.53-1.34 1.04-.76.51-1.6.91-.86.4-1.74.64t-1.67.24q-.9 0-1.69-.28-.79-.28-1.48-.77-.68-.49-1.18-1.17-.5-.69-.72-1.53-.2-.67-.2-1.47v-.07q.27.34.72.72.44.37.96.68.52.31 1.08.54.56.22 1.05.29.5.1 1.02.1.93 0 1.78-.28.85-.28 1.58-.77.72-.49 1.26-1.16.54-.67.84-1.48.09-.22.17-.44.08-.22.14-.44.06-.22.1-.44.03-.22.03-.45 0-.47-.12-.92-.12-.45-.36-.87-.23-.42-.58-.78-.34-.37-.8-.63-.39-.22-.87-.35-.48-.12-.94-.12h-.38q-.19 0-.37.02t-.36.05q-.15.02-.29.05l-.24.06q-.16.04-.33.09-.17.05-.34.12-.16.06-.31.14-.15.07-.27.17-.09.06-.18.15-.09.08-.18.18-.09.1-.17.22-.08.12-.14.26-.37-.32-.67-.67t-.52-.72q-.22-.38-.37-.78-.15-.4-.22-.81-.06-.32-.09-.66-.04-.33-.04-.67 0-.56.08-1.1.08-.54.23-1.07.16-.53.4-1.03t.55-.97q.42-.61.99-1.14.56-.53 1.25-.93.68-.4 1.48-.65.8-.26 1.68-.26.49 0 .97.07t.96.21q.47.14.92.35.46.22.87.51.41.29.78.66.36.37.67.81.3.45.53.97.24.52.39 1.12.22.67.31 1.38.09.7.09 1.45 0 .74-.09 1.44-.09.7-.26 1.37-.17.67-.42 1.31-.25.63-.58 1.22-.33.58-.75 1.12-.41.53-.91 1-.5.47-1.08.86-.58.4-1.24.69-.66.3-1.39.48-.73.18-1.52.18z"/>
                      </svg>
                      Microsoft Edge
                    </h4>
                    <div className="space-y-4">
                      <InstallStep 
                        number={1}
                        title="Abre el menú de Edge"
                        description='Haz clic en los tres puntos (...) en la esquina superior derecha'
                      />
                      <InstallStep 
                        number={2}
                        title='Selecciona "Aplicaciones"'
                        description='Luego haz clic en "Instalar este sitio como una aplicación"'
                        visual={
                          <div className="p-3 bg-muted rounded-lg space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span>📱</span>
                              <span>Aplicaciones</span>
                              <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                            </div>
                            <div className="ml-6 text-sm text-primary font-medium">
                              → Instalar este sitio como una aplicación
                            </div>
                          </div>
                        }
                      />
                      <InstallStep 
                        number={3}
                        title="Confirma la instalación"
                        description="La app aparecerá en tu menú de inicio y en el escritorio"
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Mac Section */}
            <AccordionItem value="mac" className="border rounded-xl overflow-hidden bg-card">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-500/10 flex items-center justify-center">
                    <Apple className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Mac</p>
                    <p className="text-sm text-muted-foreground">Safari, Chrome, Edge</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-6">
                  {/* Safari on Mac */}
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      🧭 Safari (macOS Sonoma 14+)
                    </h4>
                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4">
                      <p className="text-sm">
                        <strong>Nota:</strong> La instalación de apps web en Safari requiere macOS Sonoma (14.0) o posterior.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <InstallStep 
                        number={1}
                        title="Abre el menú Archivo"
                        description='En la barra de menú superior, haz clic en "Archivo"'
                      />
                      <InstallStep 
                        number={2}
                        title='Selecciona "Agregar al Dock..."'
                        description="Esta opción aparecerá si tu Mac tiene macOS Sonoma o posterior"
                        visual={
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="text-sm space-y-1">
                              <div className="opacity-50">Nueva ventana</div>
                              <div className="opacity-50">Nueva pestaña</div>
                              <div className="text-primary font-medium">Agregar al Dock...</div>
                            </div>
                          </div>
                        }
                      />
                      <InstallStep 
                        number={3}
                        title="Confirma"
                        description="La app aparecerá en tu Dock como una aplicación independiente"
                      />
                    </div>
                  </div>

                  {/* Chrome on Mac */}
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Chrome className="h-4 w-4" />
                      Google Chrome
                    </h4>
                    <div className="space-y-4">
                      <InstallStep 
                        number={1}
                        title="Busca el ícono de instalación"
                        description="En la barra de direcciones, del lado derecho, verás un ícono de instalación"
                      />
                      <InstallStep 
                        number={2}
                        title='Haz clic en "Instalar"'
                        description="O abre el menú (⋮) y selecciona 'Instalar M.A.T.S. for Emergency Personnel...'"
                      />
                      <InstallStep 
                        number={3}
                        title="¡Listo!"
                        description="La app se abrirá en su propia ventana y aparecerá en tu Dock y Launchpad"
                      />
                    </div>
                  </div>

                  {/* Edge on Mac */}
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
                      Microsoft Edge
                    </h4>
                    <div className="space-y-4">
                      <InstallStep 
                        number={1}
                        title="Abre el menú de Edge"
                        description='Haz clic en los tres puntos (...) en la esquina superior derecha'
                      />
                      <InstallStep 
                        number={2}
                        title='Selecciona "Apps" → "Instalar este sitio como una app"'
                        description="Edge te permitirá personalizar el nombre antes de instalar"
                      />
                      <InstallStep 
                        number={3}
                        title="Confirma"
                        description="La app aparecerá en tu Launchpad y podrás agregarla al Dock"
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* FAQ Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-center mb-6">Preguntas Frecuentes</h2>
          <div className="space-y-4">
            <FAQItem 
              question="¿Es seguro instalar la app de esta manera?"
              answer="¡Sí! Las Progressive Web Apps (PWA) son seguras porque se ejecutan en el navegador con las mismas protecciones de seguridad. No pueden acceder a partes de tu dispositivo sin tu permiso explícito."
            />
            <FAQItem 
              question="¿Ocupa mucho espacio?"
              answer="No. A diferencia de las apps tradicionales, las PWA ocupan muy poco espacio (generalmente menos de 5 MB) porque la mayoría de los recursos se cargan desde internet cuando los necesitas."
            />
            <FAQItem 
              question="¿Funciona sin internet?"
              answer="Sí, la app tiene funcionalidad offline básica. Puedes ver información guardada previamente y algunas funciones seguirán disponibles. Cuando vuelvas a tener conexión, todo se sincronizará automáticamente."
            />
            <FAQItem 
              question="¿Cómo desinstalo la app?"
              answer="En móviles: mantén presionado el ícono y selecciona 'Eliminar' o 'Desinstalar'. En Windows: ve a Configuración → Apps. En Mac: arrastra el ícono del Dock o Launchpad a la papelera."
            />
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            ¿Tienes problemas para instalar? Contáctanos para ayudarte.
          </p>
          <Link to="/">
            <Button variant="outline" size="lg">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Volver a la App
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

// Helper Components

function BenefitCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-4 rounded-xl bg-card border text-center">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 text-primary">
        {icon}
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function InstallStep({ 
  number, 
  title, 
  description, 
  visual 
}: { 
  number: number; 
  title: string; 
  description: string;
  visual?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
        {number}
      </div>
      <div className="flex-1 space-y-2">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {visual && <div className="mt-3">{visual}</div>}
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-semibold mb-2">{question}</p>
        <p className="text-sm text-muted-foreground">{answer}</p>
      </CardContent>
    </Card>
  );
}