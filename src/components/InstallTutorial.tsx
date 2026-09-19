import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, Smartphone, Share, Plus, MoreVertical, Check,
  Monitor, ChevronLeft, ChevronRight, Zap, Wifi, Bell, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Platform = 'android' | 'ios' | 'windows' | 'mac';

interface InstallTutorialProps {
  onClose: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallTutorial: React.FC<InstallTutorialProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>('android');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /android/.test(ua);
    const isMac = /macintosh|mac os x/.test(ua) && !isIOS;
    
    if (isIOS) {
      setDetectedPlatform('ios');
    } else if (isAndroid) {
      setDetectedPlatform('android');
    } else if (isMac) {
      setDetectedPlatform('mac');
    } else {
      setDetectedPlatform('windows');
    }

    // Handle beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          onClose();
        }
      } finally {
        setInstalling(false);
        setDeferredPrompt(null);
      }
    }
  };

  const getPlatformLabel = (platform: Platform) => {
    switch (platform) {
      case 'android': return 'Android';
      case 'ios': return 'iPhone / iPad';
      case 'windows': return 'Windows';
      case 'mac': return 'Mac';
    }
  };

  const steps = [
    {
      id: 'intro',
      title: '📲 Instala la App',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Accede más rápido a <strong>M.A.T.S. for Emergency Personnel</strong> desde tu pantalla de inicio.
          </p>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Smartphone className="h-4 w-4" />
            Detectamos: {getPlatformLabel(detectedPlatform)}
          </div>

          {deferredPrompt && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="h-6 w-6 text-primary" />
                <p className="font-semibold">¡Instalación rápida disponible!</p>
              </div>
              <Button 
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full"
              >
                {installing ? 'Instalando...' : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Instalar Ahora
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-card border text-center">
              <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium">Acceso Rápido</p>
            </div>
            <div className="p-3 rounded-lg bg-card border text-center">
              <Wifi className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium">Funciona Offline</p>
            </div>
            <div className="p-3 rounded-lg bg-card border text-center">
              <Bell className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium">Notificaciones</p>
            </div>
            <div className="p-3 rounded-lg bg-card border text-center">
              <Shield className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs font-medium">Seguro</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'android',
      title: '📱 Android (Chrome/Edge)',
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 text-green-500 text-sm">
            <Smartphone className="h-4 w-4" />
            Chrome, Samsung Internet, Edge
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
              <div>
                <p className="font-semibold">Abre el menú del navegador</p>
                <p className="text-sm text-muted-foreground">Toca los 3 puntos verticales (⋮) arriba a la derecha</p>
                <div className="mt-2 flex justify-center p-3 bg-muted rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-primary">
                    <MoreVertical className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
              <div>
                <p className="font-semibold">Busca "Instalar aplicación"</p>
                <p className="text-sm text-muted-foreground">También puede ser "Añadir a pantalla de inicio"</p>
                <div className="mt-2 flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Download className="h-5 w-5 text-primary" />
                  <span className="font-medium">Instalar aplicación</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
              <div>
                <p className="font-semibold">Confirma la instalación</p>
                <p className="text-sm text-muted-foreground">Toca "Instalar" y la app aparecerá en tu pantalla</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'ios',
      title: '🍎 iPhone / iPad (Safari)',
      content: (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm">
              <strong className="text-amber-500">⚠️ Importante:</strong> En iOS, <strong>solo Safari</strong> permite instalar apps web.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
              <div>
                <p className="font-semibold">Toca el botón Compartir</p>
                <p className="text-sm text-muted-foreground">Cuadrado con flecha hacia arriba, en la barra inferior</p>
                <div className="mt-2 flex justify-center p-3 bg-muted rounded-lg">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center ring-2 ring-blue-500">
                    <Share className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
              <div>
                <p className="font-semibold">"Agregar a pantalla de inicio"</p>
                <p className="text-sm text-muted-foreground">Desplázate hacia abajo en el menú</p>
                <div className="mt-2 flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <div className="w-7 h-7 rounded-lg bg-gray-500/20 flex items-center justify-center">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">Agregar a pantalla de inicio</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
              <div>
                <p className="font-semibold">Toca "Agregar"</p>
                <p className="text-sm text-muted-foreground">Está en la esquina superior derecha</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'desktop',
      title: '💻 Windows / Mac',
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 text-blue-500 text-sm">
            <Monitor className="h-4 w-4" />
            Chrome, Edge, Brave
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
              <div>
                <p className="font-semibold">Busca el ícono de instalación</p>
                <p className="text-sm text-muted-foreground">En la barra de direcciones, lado derecho</p>
                <div className="mt-2 flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <div className="flex-1 h-7 bg-background rounded flex items-center px-2">
                    <span className="text-xs text-muted-foreground truncate">mats-app.com</span>
                  </div>
                  <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center ring-2 ring-primary">
                    <Download className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
              <div>
                <p className="font-semibold">Haz clic en "Instalar"</p>
                <p className="text-sm text-muted-foreground">O abre el menú (⋮) → Instalar aplicación</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-safe text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold">¡Listo!</p>
                <p className="text-sm text-muted-foreground">La app aparecerá en tu menú de inicio / Dock</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'faq',
      title: '❓ Preguntas Frecuentes',
      content: (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-card border">
            <p className="font-semibold text-sm">¿Es seguro?</p>
            <p className="text-xs text-muted-foreground mt-1">
              ¡Sí! Las PWA se ejecutan en el navegador con las mismas protecciones de seguridad.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-card border">
            <p className="font-semibold text-sm">¿Ocupa mucho espacio?</p>
            <p className="text-xs text-muted-foreground mt-1">
              No. Menos de 5 MB, muy poco comparado con apps tradicionales.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-card border">
            <p className="font-semibold text-sm">¿Funciona sin internet?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sí, tiene funcionalidad offline básica. Al reconectarte, todo se sincroniza.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-card border">
            <p className="font-semibold text-sm">¿Cómo la desinstalo?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Móvil: mantén presionado el ícono → Eliminar. PC: Configuración → Apps.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[10100] flex items-start justify-center bg-black/80 p-4 pt-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-background rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg">Cómo Instalar</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress */}
        <div className="px-4 pt-3">
          <div className="flex gap-1">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  idx <= currentStep ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Paso {currentStep + 1} de {steps.length}
          </p>
        </div>

        {/* Content */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-xl font-bold mb-4">{steps[currentStep].title}</h3>
              {steps[currentStep].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentStep === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </Button>

          <Button onClick={goNext} className="gap-1">
            {currentStep === steps.length - 1 ? 'Cerrar' : 'Siguiente'}
            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
