import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, 
  Smartphone, 
  Share, 
  Plus, 
  MoreVertical, 
  Check, 
  ArrowLeft,
  Globe,
  Monitor,
  ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { MatsLogo } from "@/components/MatsLogo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "desktop";

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>("desktop");
  const [activeTab, setActiveTab] = useState<Platform>("android");

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /android/.test(ua);
    
    if (isIOS) {
      setDetectedPlatform("ios");
      setActiveTab("ios");
    } else if (isAndroid) {
      setDetectedPlatform("android");
      setActiveTab("android");
    } else {
      setDetectedPlatform("desktop");
      setActiveTab("desktop");
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
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    }
  };

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Check className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">¡Ya está instalada!</h1>
          <p className="text-muted-foreground">
            La aplicación COMUNIDAD SOS ya está instalada en tu dispositivo.
          </p>
          <Link to="/landing">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/landing">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <MatsLogo size={32} showText />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Instalar la App</h1>
          <p className="text-muted-foreground">
            Accede más rápido desde tu pantalla de inicio
          </p>
        </div>

        {/* Quick Install Button (if available) */}
        {deferredPrompt && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Instalación rápida disponible</h3>
                  <p className="text-sm text-muted-foreground">
                    Tu navegador soporta instalación directa
                  </p>
                </div>
                <Button onClick={handleInstallClick}>
                  Instalar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Platform Detection Badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground">Detectamos:</span>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            {detectedPlatform === "ios" && "iPhone/iPad"}
            {detectedPlatform === "android" && "Android"}
            {detectedPlatform === "desktop" && "Escritorio"}
          </span>
        </div>

        {/* Platform Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Platform)}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="android" className="gap-2">
              <Smartphone className="h-4 w-4" />
              Android
            </TabsTrigger>
            <TabsTrigger value="ios" className="gap-2">
              <Smartphone className="h-4 w-4" />
              iOS
            </TabsTrigger>
            <TabsTrigger value="desktop" className="gap-2">
              <Monitor className="h-4 w-4" />
              Escritorio
            </TabsTrigger>
          </TabsList>

          {/* Android Instructions */}
          <TabsContent value="android" className="space-y-4">
            {/* Visual Guide for Android - Three Dots Menu */}
            <Card className="overflow-hidden border-primary/30">
              <CardContent className="p-0">
                <div className="bg-muted/50 p-6">
                  <div className="max-w-xs mx-auto">
                    {/* Chrome Top Bar Mockup */}
                    <div className="bg-card rounded-t-xl border p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-muted" />
                        <div className="h-3 w-32 bg-muted rounded" />
                      </div>
                      {/* Three dots menu - highlighted */}
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary ring-offset-2 ring-offset-card animate-pulse">
                        <MoreVertical className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    {/* Content Area */}
                    <div className="bg-card border border-t-0 rounded-b-xl h-28 flex items-center justify-center">
                      <MatsLogo size={48} />
                    </div>
                  </div>
                  <p className="text-center text-sm text-primary font-medium mt-4">
                    ⬆ Toca los 3 puntos aquí
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Chrome / Edge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <InstallStep
                  number={1}
                  title="Toca el menú ⋮"
                  description="Los 3 puntos verticales arriba a la derecha del navegador"
                  icon={<MoreVertical className="h-5 w-5" />}
                />
                <InstallStep
                  number={2}
                  title="Busca 'Instalar aplicación'"
                  description="O 'Añadir a pantalla de inicio' en el menú desplegable"
                  icon={<Download className="h-5 w-5" />}
                />
                <InstallStep
                  number={3}
                  title="Confirma la instalación"
                  description="Toca 'Instalar' en el diálogo que aparece"
                  icon={<Check className="h-5 w-5" />}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-orange-500" />
                  Samsung Internet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <InstallStep
                  number={1}
                  title="Abre el menú ☰"
                  description="Toca las 3 líneas horizontales en la parte inferior"
                  icon={<MoreVertical className="h-5 w-5" />}
                />
                <InstallStep
                  number={2}
                  title="Selecciona 'Agregar página a'"
                  description="Luego elige 'Pantalla de inicio'"
                  icon={<Plus className="h-5 w-5" />}
                />
                <InstallStep
                  number={3}
                  title="Confirma"
                  description="La app aparecerá como ícono en tu pantalla"
                  icon={<Check className="h-5 w-5" />}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* iOS Instructions */}
          <TabsContent value="ios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-500" />
                  Safari (Requerido)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                  <strong className="text-amber-600">Importante:</strong> En iPhone/iPad, solo Safari permite instalar aplicaciones web. Asegúrate de abrir esta página en Safari.
                </div>
                <InstallStep
                  number={1}
                  title="Toca el botón Compartir"
                  description="Es el ícono cuadrado con flecha hacia arriba en la barra inferior"
                  icon={<Share className="h-5 w-5" />}
                />
                <InstallStep
                  number={2}
                  title="Desplázate en el menú"
                  description="Busca la opción 'Agregar a pantalla de inicio'"
                  icon={<Plus className="h-5 w-5" />}
                />
                <InstallStep
                  number={3}
                  title="Toca 'Agregar'"
                  description="En la esquina superior derecha del diálogo"
                  icon={<Check className="h-5 w-5" />}
                />
              </CardContent>
            </Card>

            {/* Visual Guide for iOS */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-muted/50 p-6">
                  <div className="max-w-xs mx-auto">
                    {/* Safari Bar Mockup */}
                    <div className="bg-card rounded-t-xl border border-b-0 p-3">
                      <div className="h-3 w-24 bg-muted rounded mx-auto" />
                    </div>
                    {/* Content Area */}
                    <div className="bg-card border border-t-0 border-b-0 h-32 flex items-center justify-center">
                      <MatsLogo size={48} />
                    </div>
                    {/* Safari Bottom Bar */}
                    <div className="bg-card rounded-b-xl border border-t-0 p-3 flex justify-around">
                      <div className="w-6 h-6 rounded bg-muted" />
                      <div className="w-6 h-6 rounded bg-muted" />
                      <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center ring-2 ring-primary ring-offset-2 ring-offset-card">
                        <Share className="h-4 w-4 text-primary" />
                      </div>
                      <div className="w-6 h-6 rounded bg-muted" />
                      <div className="w-6 h-6 rounded bg-muted" />
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    <ChevronRight className="h-4 w-4 inline rotate-90" />
                    Toca aquí para compartir
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Desktop Instructions */}
          <TabsContent value="desktop" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Chrome
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <InstallStep
                  number={1}
                  title="Busca el ícono de instalación"
                  description="Aparece en la barra de direcciones (lado derecho)"
                  icon={<Download className="h-5 w-5" />}
                />
                <InstallStep
                  number={2}
                  title="Haz clic en 'Instalar'"
                  description="O usa el menú ⋮ → 'Instalar COMUNIDAD SOS...'"
                  icon={<Plus className="h-5 w-5" />}
                />
                <InstallStep
                  number={3}
                  title="Confirma"
                  description="La app se abrirá en su propia ventana"
                  icon={<Check className="h-5 w-5" />}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-500" />
                  Microsoft Edge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <InstallStep
                  number={1}
                  title="Abre el menú de Edge"
                  description="Haz clic en los tres puntos (...) arriba a la derecha"
                  icon={<MoreVertical className="h-5 w-5" />}
                />
                <InstallStep
                  number={2}
                  title="Selecciona 'Aplicaciones'"
                  description="Luego 'Instalar este sitio como una aplicación'"
                  icon={<Download className="h-5 w-5" />}
                />
                <InstallStep
                  number={3}
                  title="Confirma la instalación"
                  description="La app aparecerá en tu menú de inicio"
                  icon={<Check className="h-5 w-5" />}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-orange-500" />
                  Firefox
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-3 rounded-lg bg-muted text-sm">
                  Firefox tiene soporte limitado para PWAs. Recomendamos usar Chrome o Edge para la mejor experiencia.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Benefits Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">¿Por qué instalar?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <BenefitItem text="Acceso rápido desde tu pantalla de inicio" />
              <BenefitItem text="Funciona sin conexión a internet" />
              <BenefitItem text="Recibe notificaciones de emergencia" />
              <BenefitItem text="Experiencia de app nativa" />
              <BenefitItem text="Sin necesidad de tiendas de apps" />
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function InstallStep({ number, title, description, icon }: { 
  number: number; 
  title: string; 
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
        {number}
      </div>
      <div className="flex-1">
        <p className="font-medium flex items-center gap-2">
          {icon}
          {title}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {description}
        </p>
      </div>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Check className="h-3 w-3 text-primary" />
      </div>
      <span className="text-sm">{text}</span>
    </li>
  );
}