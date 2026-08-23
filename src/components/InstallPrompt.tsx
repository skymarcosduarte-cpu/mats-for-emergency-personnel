import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Smartphone, Share, Plus, Chrome, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isNative } from "@/lib/capacitor";


interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "samsung" | "desktop-chrome" | "desktop-edge" | "desktop-firefox" | "other";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [isStandalone, setIsStandalone] = useState(false);

  // Detect platform
  const detectPlatform = useCallback((): Platform => {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(ua) && !(window as any).MSStream;
    const isSamsung = /samsungbrowser/.test(ua);
    const isAndroid = /android/.test(ua);
    const isChrome = /chrome/.test(ua) && !/edg/.test(ua);
    const isEdge = /edg/.test(ua);
    const isFirefox = /firefox/.test(ua);

    if (isIOS) return "ios";
    if (isSamsung) return "samsung";
    if (isAndroid) return "android";
    if (isEdge) return "desktop-edge";
    if (isFirefox) return "desktop-firefox";
    if (isChrome) return "desktop-chrome";
    return "other";
  }, []);

  useEffect(() => {
    // En la app nativa (Capacitor) nunca mostrar instrucciones de instalación web
    if (isNative()) {
      setIsStandalone(true);
      return;
    }

    // Check if already installed as PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;


    // Detect platform
    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);

    // Check if user dismissed the banner recently
    const dismissed = localStorage.getItem("install-banner-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 3 days (reduced from 7)
      if (Date.now() - dismissedTime < 3 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Handle the beforeinstallprompt event (Android/Desktop Chrome/Edge)
    const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Auto-show banner immediately
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // For platforms without native prompt OR Android (as fallback), show banner after short delay
    // Android is included because beforeinstallprompt may not fire if user dismissed previously
    const showForManualInstall = ["ios", "samsung", "desktop-firefox", "android"].includes(detectedPlatform);
    if (showForManualInstall) {
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, [detectPlatform]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setShowBanner(false);
          localStorage.removeItem("install-banner-dismissed");
        }
      } catch (error) {
        console.error("Install prompt error:", error);
      }
      setDeferredPrompt(null);
    } else {
      // Show manual instructions for platforms without native prompt
      setShowInstructions(true);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("install-banner-dismissed", Date.now().toString());
  };

  const getInstructionContent = () => {
    switch (platform) {
      case "ios":
        return {
          title: "Instalar en iPhone/iPad",
          steps: [
            {
              icon: <Share className="h-4 w-4" />,
              title: "Toca el botón Compartir",
              description: "En Safari, toca el ícono de compartir en la barra inferior"
            },
            {
              icon: <Plus className="h-4 w-4" />,
              title: "Agregar a pantalla de inicio",
              description: "Desplázate y selecciona 'Agregar a pantalla de inicio'"
            },
            {
              icon: <Smartphone className="h-4 w-4" />,
              title: "Confirma la instalación",
              description: "Toca 'Agregar' y la app aparecerá en tu pantalla"
            }
          ]
        };
      case "android":
        return {
          title: "Instalar en Android",
          steps: [
            {
              icon: <Chrome className="h-4 w-4" />,
              title: "Toca el menú ⋮",
              description: "Los 3 puntos verticales arriba a la derecha del navegador"
            },
            {
              icon: <Download className="h-4 w-4" />,
              title: "Busca 'Instalar aplicación'",
              description: "O 'Añadir a pantalla de inicio' en el menú desplegable"
            },
            {
              icon: <Smartphone className="h-4 w-4" />,
              title: "Confirma la instalación",
              description: "Toca 'Instalar' en el diálogo que aparece"
            }
          ]
        };
      case "samsung":
        return {
          title: "Instalar en Samsung",
          steps: [
            {
              icon: <Globe className="h-4 w-4" />,
              title: "Abre el menú del navegador",
              description: "Toca el ícono de menú (tres líneas) en la esquina inferior"
            },
            {
              icon: <Plus className="h-4 w-4" />,
              title: "Agregar a pantalla de inicio",
              description: "Selecciona 'Agregar página a' → 'Pantalla de inicio'"
            },
            {
              icon: <Smartphone className="h-4 w-4" />,
              title: "Confirma la instalación",
              description: "La app aparecerá como ícono en tu pantalla"
            }
          ]
        };
      case "desktop-firefox":
        return {
          title: "Instalar en Firefox",
          steps: [
            {
              icon: <Globe className="h-4 w-4" />,
              title: "Abre el menú de Firefox",
              description: "Haz clic en el ícono de menú (tres líneas) arriba a la derecha"
            },
            {
              icon: <Plus className="h-4 w-4" />,
              title: "Instalar sitio como aplicación",
              description: "Selecciona 'Instalar sitio como aplicación' o 'Más herramientas'"
            },
            {
              icon: <Smartphone className="h-4 w-4" />,
              title: "Confirma",
              description: "Haz clic en 'Instalar' en el diálogo que aparece"
            }
          ]
        };
      default:
        return {
          title: "Instalar la aplicación",
          steps: [
            {
              icon: <Chrome className="h-4 w-4" />,
              title: "Usa Chrome o Edge",
              description: "Para mejor compatibilidad, abre esta página en Chrome o Edge"
            },
            {
              icon: <Download className="h-4 w-4" />,
              title: "Busca el ícono de instalación",
              description: "Aparecerá en la barra de direcciones o en el menú"
            },
            {
              icon: <Smartphone className="h-4 w-4" />,
              title: "Confirma la instalación",
              description: "Haz clic en 'Instalar' cuando aparezca el diálogo"
            }
          ]
        };
    }
  };

  if (isStandalone || !showBanner) {
    return null;
  }

  const instructions = getInstructionContent();

  return (
    <>
      {/* Install Banner */}
      <Card className="fixed bottom-20 left-4 right-4 z-50 bg-card border-primary/50 shadow-lg animate-in slide-in-from-bottom-4">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Instala la App</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Accede más rápido desde tu pantalla de inicio
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleInstallClick}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Instalar Ahora
                </Button>
                <Button size="sm" variant="ghost" onClick={dismissBanner}>
                  Ahora no
                </Button>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={dismissBanner}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Platform-Specific Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">{instructions.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {instructions.steps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {step.icon}
                    {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={() => setShowInstructions(false)} className="w-full">
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}