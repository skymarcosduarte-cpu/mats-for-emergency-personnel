import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Check for service worker updates on launch
      navigator.serviceWorker.ready.then(async (reg) => {
        setRegistration(reg);
        
        // Immediate update check on launch
        try {
          await reg.update();
          if (reg.waiting) {
            setUpdateAvailable(true);
          }
        } catch (error) {
          console.log("Update check error:", error);
        } finally {
          setIsChecking(false);
        }
        
        // Check for updates periodically (every 2 minutes)
        const checkForUpdates = async () => {
          try {
            await reg.update();
            if (reg.waiting) {
              setUpdateAvailable(true);
            }
          } catch {
            // Ignore errors
          }
        };
        
        const interval = setInterval(checkForUpdates, 2 * 60 * 1000);
        
        // Listen for new service worker
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });

        return () => clearInterval(interval);
      });

      // Listen for controller change (when skipWaiting is called)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    } else {
      setIsChecking(false);
    }
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Tell the waiting service worker to take over
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      toast.success("Actualizando...");
    } else {
      // Force refresh if no waiting worker
      window.location.reload();
    }
  };

  const dismissUpdate = () => {
    setUpdateAvailable(false);
    // Remember dismissal for this session
    sessionStorage.setItem("update-dismissed", "true");
  };

  // Don't show if dismissed this session
  const wasDismissed = sessionStorage.getItem("update-dismissed") === "true";

  if (!updateAvailable || wasDismissed) {
    return null;
  }

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

// Manual update check button for settings
export function UpdateButton() {
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.update();
        
        if (reg.waiting) {
          setHasUpdate(true);
          toast.info("Nueva versión disponible");
        } else {
          setHasUpdate(false);
          toast.success("Ya tienes la última versión");
        }
      } else {
        toast.info("Recargando página...");
        window.location.reload();
      }
      setLastChecked(new Date());
    } catch (error) {
      console.error("Update check error:", error);
      toast.error("Error al buscar actualizaciones");
    } finally {
      setChecking(false);
    }
  };

  const applyUpdate = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
          toast.success("Actualizando...");
        } else {
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    } catch (error) {
      window.location.reload();
    }
  };

  const forceRefresh = () => {
    toast.info("Recargando aplicación...");
    // Clear caches and force reload
    if ("caches" in window) {
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
          variant="outline"
          className="w-full"
          onClick={checkForUpdates}
          disabled={checking}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Buscando..." : "Buscar Actualizaciones"}
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
          Última verificación: {lastChecked.toLocaleTimeString("es-MX")}
        </p>
      )}
    </div>
  );
}
