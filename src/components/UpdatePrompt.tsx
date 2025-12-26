import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, Download, Sparkles, Smartphone, Share, Plus, Chrome, Globe, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UpdatePrompt() {
  const { updateAvailable, applyUpdate, dismissUpdate } = useUpdateCheck();

  // Don't show if dismissed this session
  const wasDismissed = sessionStorage.getItem("update-dismissed") === "true";

  if (!updateAvailable || wasDismissed) {
    return null;
  }

  const handleUpdate = () => {
    toast.success("Actualizando...");
    applyUpdate();
  };

  return (
    <div className="fixed top-14 left-0 right-0 z-50 px-3 animate-in slide-in-from-top-4 duration-300">
      <div className="max-w-lg mx-auto bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl p-4 shadow-2xl border border-primary-foreground/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">¡Nueva versión disponible!</p>
            <p className="text-xs text-primary-foreground/80 mt-0.5">
              Actualiza para obtener las últimas mejoras y correcciones
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 flex-shrink-0"
            onClick={dismissUpdate}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            className="flex-1 bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold"
            onClick={handleUpdate}
          >
            <Download className="h-4 w-4 mr-2" />
            Actualizar Ahora
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={dismissUpdate}
          >
            Más tarde
          </Button>
        </div>
      </div>
    </div>
  );
}

// Manual update check button for settings with Android-safe timeouts
export function UpdateButton() {
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

  // Timeout constants
  const SW_READY_TIMEOUT = 5000;
  const UPDATE_CHECK_TIMEOUT = 8000;

  // Helper to create a timeout promise
  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout'));
      }, ms);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  const checkForUpdates = async () => {
    setChecking(true);
    setCheckFailed(false);
    
    try {
      if ('serviceWorker' in navigator) {
        // Get current registration without waiting for ready (which can hang on Android)
        const registrations = await withTimeout(
          navigator.serviceWorker.getRegistrations(),
          SW_READY_TIMEOUT
        );
        
        if (registrations.length > 0) {
          const reg = registrations[0];
          
          // Wrap update check in timeout
          try {
            await withTimeout(reg.update(), UPDATE_CHECK_TIMEOUT);
          } catch (updateError) {
            console.warn('Update check timed out, checking waiting state:', updateError);
          }
          
          if (reg.waiting) {
            setHasUpdate(true);
            toast.info('Nueva versión disponible');
          } else {
            setHasUpdate(false);
            toast.success('Ya tienes la última versión');
          }
          setLastChecked(new Date());
        } else {
          // No service worker registered
          setHasUpdate(false);
          toast.success('Ya tienes la última versión');
          setLastChecked(new Date());
        }
      } else {
        toast.info('Recargando página...');
        window.location.reload();
      }
    } catch (error) {
      console.error('Update check error:', error);
      setCheckFailed(true);
      toast.error('No se pudo verificar actualizaciones', {
        description: 'Usa "Forzar Recarga" si hay problemas',
        duration: 4000,
      });
    } finally {
      setChecking(false);
    }
  };

  const applyUpdate = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await withTimeout(
          navigator.serviceWorker.getRegistrations(),
          SW_READY_TIMEOUT
        );
        
        if (registrations.length > 0 && registrations[0].waiting) {
          registrations[0].waiting.postMessage({ type: 'SKIP_WAITING' });
          toast.success('Actualizando...');
          // Give time for the skip waiting to process
          setTimeout(() => window.location.reload(), 500);
        } else {
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    } catch (error) {
      // Fallback: just reload
      window.location.reload();
    }
  };

  const forceRefresh = () => {
    toast.info('Recargando aplicación...');
    // Clear caches and force reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    window.location.reload();
  };

  return (
    <div className="space-y-3">
      {hasUpdate ? (
        <Button
          className="w-full bg-primary hover:bg-primary/90"
          onClick={applyUpdate}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Instalar Actualización
        </Button>
      ) : (
        <Button
          variant={checkFailed ? 'destructive' : 'outline'}
          className="w-full"
          onClick={checkForUpdates}
          disabled={checking}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Buscando...' : checkFailed ? 'Reintentar' : 'Buscar Actualizaciones'}
        </Button>
      )}
      
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={forceRefresh}
      >
        <RefreshCw className="h-3 w-3 mr-2" />
        Forzar Recarga
      </Button>
      
      {lastChecked && (
        <p className="text-xs text-muted-foreground text-center">
          Última verificación: {lastChecked.toLocaleTimeString('es-MX')}
        </p>
      )}
      
      {checkFailed && !checking && (
        <p className="text-xs text-destructive text-center">
          La verificación falló. Usa "Forzar Recarga" si hay problemas.
        </p>
      )}
    </div>
  );
}

// ============= Install Button for Settings =============

type Platform = "ios" | "android" | "samsung" | "desktop-chrome" | "desktop-edge" | "desktop-firefox" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [showInstructions, setShowInstructions] = useState(false);

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
    const standalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    setPlatform(detectPlatform());

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, [detectPlatform]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          toast.success("¡App instalada correctamente!");
        }
      } catch (error) {
        console.error("Install prompt error:", error);
        setShowInstructions(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  };

  const getInstructionContent = () => {
    switch (platform) {
      case "ios":
        return {
          title: "Instalar en iPhone/iPad",
          steps: [
            { icon: <Share className="h-4 w-4" />, title: "Toca el botón Compartir", description: "En Safari, toca el ícono de compartir en la barra inferior" },
            { icon: <Plus className="h-4 w-4" />, title: "Agregar a pantalla de inicio", description: "Desplázate y selecciona 'Agregar a pantalla de inicio'" },
            { icon: <Smartphone className="h-4 w-4" />, title: "Confirma la instalación", description: "Toca 'Agregar' y la app aparecerá en tu pantalla" }
          ]
        };
      case "samsung":
        return {
          title: "Instalar en Samsung",
          steps: [
            { icon: <Globe className="h-4 w-4" />, title: "Abre el menú del navegador", description: "Toca el ícono de menú (⋮) en la esquina superior" },
            { icon: <Plus className="h-4 w-4" />, title: "Agregar a pantalla de inicio", description: "Selecciona 'Agregar página a' → 'Pantalla de inicio'" },
            { icon: <Smartphone className="h-4 w-4" />, title: "Confirma", description: "La app aparecerá como ícono en tu pantalla" }
          ]
        };
      case "android":
        return {
          title: "Instalar en Android",
          steps: [
            { icon: <Globe className="h-4 w-4" />, title: "Abre el menú del navegador", description: "Toca el ícono de menú (⋮) en la esquina superior derecha" },
            { icon: <Download className="h-4 w-4" />, title: "Instalar aplicación", description: "Busca 'Instalar app' o 'Agregar a pantalla de inicio'" },
            { icon: <Smartphone className="h-4 w-4" />, title: "Confirma", description: "Toca 'Instalar' y la app aparecerá en tu pantalla" }
          ]
        };
      case "desktop-firefox":
        return {
          title: "Instalar en Firefox",
          steps: [
            { icon: <Globe className="h-4 w-4" />, title: "Abre el menú de Firefox", description: "Haz clic en el ícono de menú (☰) arriba a la derecha" },
            { icon: <Plus className="h-4 w-4" />, title: "Instalar sitio como aplicación", description: "Selecciona 'Instalar sitio como aplicación'" },
            { icon: <Smartphone className="h-4 w-4" />, title: "Confirma", description: "Haz clic en 'Instalar' en el diálogo" }
          ]
        };
      default:
        return {
          title: "Instalar la aplicación",
          steps: [
            { icon: <Chrome className="h-4 w-4" />, title: "Usa Chrome o Edge", description: "Para mejor compatibilidad, abre esta página en Chrome o Edge" },
            { icon: <Download className="h-4 w-4" />, title: "Busca el ícono de instalación", description: "Aparecerá en la barra de direcciones o en el menú (⋮)" },
            { icon: <Smartphone className="h-4 w-4" />, title: "Confirma", description: "Haz clic en 'Instalar' cuando aparezca" }
          ]
        };
    }
  };

  const instructions = getInstructionContent();

  if (isStandalone) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-safe/10 text-safe">
        <Smartphone className="h-4 w-4" />
        <span className="text-sm font-medium">App instalada correctamente</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <Button
          className="w-full"
          onClick={handleInstallClick}
        >
          <Download className="h-4 w-4 mr-2" />
          Instalar App en Dispositivo
        </Button>
        
        <a 
          href="/install" 
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Ver guía de instalación completa
        </a>
      </div>

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
