import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, Download, Sparkles, Smartphone, Share, Plus, Chrome, Globe, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useUpdateCheck, useUpdateAvailable } from "@/hooks/useUpdateCheck";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Non-intrusive update notification - uses toast instead of blocking banner
export function UpdatePrompt() {
  const { updateAvailable, applyUpdate, dismissUpdate } = useUpdateCheck();
  const [hasShownToast, setHasShownToast] = useState(false);

  // Show a non-blocking toast when update becomes available
  useEffect(() => {
    if (updateAvailable && !hasShownToast) {
      const wasDismissed = sessionStorage.getItem("update-dismissed") === "true";
      if (wasDismissed) return;
      
      setHasShownToast(true);
      
      // Delay slightly to not interrupt initial page load
      const timer = setTimeout(() => {
        toast.info('Nueva versión disponible', {
          description: 'Actualiza para obtener las últimas mejoras',
          duration: 10000,
          icon: <Sparkles className="h-4 w-4 text-primary" />,
          action: {
            label: 'Actualizar',
            onClick: () => {
              toast.success('Actualizando...');
              applyUpdate();
            },
          },
          cancel: {
            label: 'Después',
            onClick: () => {
              dismissUpdate();
            },
          },
        });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [updateAvailable, hasShownToast, applyUpdate, dismissUpdate]);

  // Reset toast flag when update is dismissed
  useEffect(() => {
    if (!updateAvailable) {
      setHasShownToast(false);
    }
  }, [updateAvailable]);

  // No visible UI - uses toast instead
  return null;
}

// Small floating indicator for persistent but non-intrusive update notice
export function UpdateIndicator() {
  const updateAvailable = useUpdateAvailable();
  const { applyUpdate } = useUpdateCheck();
  
  const wasDismissed = sessionStorage.getItem("update-dismissed") === "true";
  
  if (!updateAvailable || wasDismissed) return null;
  
  return (
    <button
      onClick={() => {
        toast.success('Actualizando...');
        applyUpdate();
      }}
      className="fixed bottom-24 right-4 z-[900] flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-full shadow-lg animate-in slide-in-from-right-4 duration-300 hover:scale-105 transition-transform"
      aria-label="Actualizar aplicación"
    >
      <Sparkles className="h-4 w-4" />
      <span className="text-xs font-medium">Actualizar</span>
    </button>
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
        let registrations: readonly ServiceWorkerRegistration[] = [];
        
        try {
          registrations = await withTimeout(
            navigator.serviceWorker.getRegistrations(),
            SW_READY_TIMEOUT
          );
        } catch (regError) {
          console.warn('Could not get SW registrations:', regError);
        }
        
        if (registrations.length > 0) {
          const reg = registrations[0];
          
          // Force update check
          try {
            await withTimeout(reg.update(), UPDATE_CHECK_TIMEOUT);
          } catch (updateError) {
            console.warn('Update check timed out:', updateError);
          }
          
          // Check if there's a waiting worker OR if controller exists
          if (reg.waiting) {
            setHasUpdate(true);
            toast.info('Nueva versión disponible - Instala ahora');
          } else if (reg.installing) {
            setHasUpdate(true);
            toast.info('Nueva versión instalándose...');
          } else {
            setHasUpdate(false);
            toast.success('Ya tienes la última versión');
          }
          setLastChecked(new Date());
        } else {
          // No service worker registered - just show success
          setHasUpdate(false);
          toast.success('Ya tienes la última versión');
          setLastChecked(new Date());
        }
      } else {
        // No service worker support - offer page reload
        toast.info('Recarga la página para actualizar', {
          action: {
            label: 'Recargar',
            onClick: () => window.location.reload(),
          },
        });
        setLastChecked(new Date());
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
    toast.info('Aplicando actualización...');
    
    try {
      // Clear ALL caches first
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('Cleared caches:', cacheNames);
      }
      
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        if (registrations.length > 0 && registrations[0].waiting) {
          registrations[0].waiting.postMessage({ type: 'SKIP_WAITING' });
          // Wait a bit for the message to be processed
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Force reload ignoring cache
      window.location.reload();
    } catch (error) {
      console.error('Apply update error:', error);
      // Fallback: just reload
      window.location.reload();
    }
  };

  const forceRefresh = async () => {
    toast.info('Limpiando caché y recargando...');
    
    try {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('Unregistered all service workers');
      }
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('Cleared all caches');
      }
      
      // Small delay then reload
      setTimeout(() => {
        window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
      }, 300);
    } catch (error) {
      console.error('Force refresh error:', error);
      window.location.reload();
    }
  };

  return (
    <div className="space-y-3 w-full">
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
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={forceRefresh}
      >
        <RefreshCw className="h-3 w-3 mr-2" />
        Forzar Recarga
      </Button>
      
      <p className="text-xs text-muted-foreground text-center">
        Si hay problemas, usa "Forzar Recarga" para limpiar caché y reinstalar
      </p>
      
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
