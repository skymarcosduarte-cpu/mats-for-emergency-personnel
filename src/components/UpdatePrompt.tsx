import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

export function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Check for service worker updates
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
        
        // Check for updates periodically
        const checkForUpdates = () => {
          reg.update().catch(() => {});
        };
        
        // Check every 5 minutes
        const interval = setInterval(checkForUpdates, 5 * 60 * 1000);
        
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
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed top-16 left-4 right-4 z-50 animate-in slide-in-from-top-4">
      <div className="bg-primary text-primary-foreground rounded-lg p-3 shadow-lg flex items-center gap-3">
        <RefreshCw className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Nueva versión disponible</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleUpdate}
          className="flex-shrink-0"
        >
          Actualizar
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          onClick={dismissUpdate}
        >
          <X className="h-4 w-4" />
        </Button>
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
