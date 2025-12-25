import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Smartphone, Share, MoreVertical, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if user dismissed the banner recently
    const dismissed = localStorage.getItem("install-banner-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Handle the beforeinstallprompt event (Android/Desktop Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!standalone) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Show banner for iOS after a delay if not installed
    if (iOS && !standalone) {
      setTimeout(() => setShowBanner(true), 2000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowInstructions(true);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("install-banner-dismissed", Date.now().toString());
  };

  if (isStandalone || !showBanner) {
    return null;
  }

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

      {/* iOS Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Instalar en iPhone/iPad</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium">Toca el botón Compartir</p>
                <p className="text-sm text-muted-foreground mt-1">
                  En Safari, toca el ícono <Share className="h-4 w-4 inline mx-1" /> en la barra inferior
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium">Desplázate y selecciona</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Busca <Plus className="h-4 w-4 inline mx-1" /> "Agregar a pantalla de inicio"
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium">Confirma la instalación</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Toca "Agregar" y la app aparecerá en tu pantalla de inicio
                </p>
              </div>
            </div>
          </div>
          <Button onClick={() => setShowInstructions(false)} className="w-full">
            Entendido
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
