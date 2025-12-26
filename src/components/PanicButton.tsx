// Panic Button FAB Component for COMUNIDAD EX SOS

import React, { useRef, useState } from 'react';
import { AlertTriangle, X, Ambulance, Shield, Wrench, HardHat, Users, MapPin, Loader2, Phone, Cross } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PanicType, UserRole } from '@/types';
import { useLocation } from '@/hooks/useLocation';
import { toast } from 'sonner';

interface PanicOption {
  type: PanicType;
  label: string;
  icon: React.ReactNode;
}

const PANIC_OPTIONS: PanicOption[] = [
  {
    type: 'AMBULANCIA_PROPIA',
    label: 'Ambulancia Propia',
    icon: <Ambulance className="w-6 h-6" />,
  },
  {
    type: 'AMBULANCIA_TERCERO',
    label: 'Ambulancia Tercero',
    icon: <Ambulance className="w-6 h-6" />,
  },
  {
    type: 'PATRULLA',
    label: 'Patrulla',
    icon: <Shield className="w-6 h-6" />,
  },
  {
    type: 'MECANICO',
    label: 'Mecánico',
    icon: <Wrench className="w-6 h-6" />,
  },
  {
    type: 'PROTECCION_CIVIL',
    label: 'Protección Civil',
    icon: <HardHat className="w-6 h-6" />,
  },
];

// Emergency services quick-dial numbers (Mexico)
const EMERGENCY_NUMBERS = [
  { name: 'Emergencias', number: '911', icon: <Phone className="w-5 h-5" />, color: 'bg-red-500' },
  { name: 'Cruz Roja', number: '065', icon: <Cross className="w-5 h-5" />, color: 'bg-red-600' },
  { name: 'Bomberos', number: '068', icon: <AlertTriangle className="w-5 h-5" />, color: 'bg-orange-500' },
  { name: 'Policía', number: '060', icon: <Shield className="w-5 h-5" />, color: 'bg-blue-600' },
];

interface PanicButtonProps {
  userRole?: UserRole;
  onPanicTriggered?: (type: PanicType, lat: number, lng: number) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Vibrate helper (checks for support)
const vibrate = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore errors
    }
  }
};

export const PanicButton: React.FC<PanicButtonProps> = ({ 
  userRole = 'RESCATISTA',
  onPanicTriggered,
  isOpen: controlledIsOpen,
  onOpenChange
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<PanicType | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [gpsTimeout, setGpsTimeout] = useState(false);
  const { position, getCurrentPosition, loading: locationLoading } = useLocation();
  const openedAtRef = useRef<number>(0);

  const GPS_TIMEOUT_MS = 10000; // 10 seconds

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  
  const setIsOpen = (open: boolean) => {
    if (open) {
      openedAtRef.current = Date.now();
    }

    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
    
    // Show feedback when dialog opens
    if (open) {
      vibrate([100, 50, 100]); // Double short vibration
      toast.warning('Selecciona el tipo de emergencia', {
        duration: 3000,
        icon: '⚠️',
      });
    }
  };

  const handlePanicSelect = async (option: PanicOption) => {
    setSelectedType(option.type);
    setIsGettingLocation(true);

    // Immediate feedback: vibration
    vibrate([200, 100, 200, 100, 300]); // SOS-style pattern

    let lat = position?.lat;
    let lng = position?.lng;

    // Get position with timeout
    if (!lat || !lng) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          setGpsTimeout(true);
          reject(new Error('GPS_TIMEOUT'));
        }, GPS_TIMEOUT_MS);
      });

      try {
        const pos = await Promise.race([getCurrentPosition(), timeoutPromise]);
        lat = pos.lat;
        lng = pos.lng;
        setGpsTimeout(false);
      } catch (error) {
        console.error('Failed to get position:', error);

        if (error instanceof Error && error.message === 'GPS_TIMEOUT') {
          toast.error('El GPS está tardando demasiado', {
            description: 'Intenta en un lugar con mejor señal o activa el GPS manualmente',
            duration: 6000,
          });
        } else {
          toast.error('No se pudo obtener tu ubicación.');
        }

        setSelectedType(null);
        setIsGettingLocation(false);
        setGpsTimeout(false);
        return;
      }
    }

    setIsGettingLocation(false);
    setGpsTimeout(false);

    // Notify parent component (creates the emergency and notifies others via realtime)
    onPanicTriggered?.(option.type, lat, lng);

    toast.success('Alerta enviada a la comunidad', {
      description: 'Los usuarios conectados serán notificados dentro de la app',
      duration: 5000,
    });

    // Close dialog
    setIsOpen(false);
    setSelectedType(null);
  };

  const isProcessingAny = isGettingLocation || selectedType !== null;

  // Prevent Android/iOS "same-tap" from opening and immediately closing the Dialog/Drawer
  const handleOpenChange = (open: boolean) => {
    if (isProcessingAny) return;

    if (!open) {
      const msSinceOpen = Date.now() - openedAtRef.current;
      if (msSinceOpen < 350) return;
    }

    setIsOpen(open);
  };

  const content = (
    <>
      {/* Full-screen loading overlay */}
      {isGettingLocation && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-200">
          <div className="relative">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${gpsTimeout ? 'bg-warning/20' : 'bg-panic/20'}`}>
              <MapPin className={`w-10 h-10 animate-pulse ${gpsTimeout ? 'text-warning' : 'text-panic'}`} />
            </div>
            <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${gpsTimeout ? 'border-warning' : 'border-panic'}`} />
          </div>
          <div className="text-center px-4">
            {gpsTimeout ? (
              <>
                <p className="text-lg font-semibold text-warning">El GPS está tardando...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Verifica que el GPS esté activado o intenta en un lugar con mejor señal
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-foreground">Obteniendo ubicación GPS...</p>
                <p className="text-sm text-muted-foreground mt-1">Por favor espera un momento</p>
              </>
            )}
          </div>
          {gpsTimeout && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsGettingLocation(false);
                setGpsTimeout(false);
                setSelectedType(null);
              }}
              className="mt-2"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      )}

      <header className="px-4 pt-4 text-center sm:text-left">
        <h2 className="flex items-center justify-center sm:justify-start gap-2 text-lg font-semibold leading-none tracking-tight text-foreground">
          <AlertTriangle className="w-5 h-5 text-panic" />
          Selecciona tipo de emergencia
        </h2>
      </header>

      <div className="grid gap-3 py-4 px-4 sm:px-0">
        {PANIC_OPTIONS.map((option) => {
          const isProcessing = locationLoading && selectedType === option.type;
          return (
            <Button
              key={option.type}
              variant="outline"
              className="h-16 justify-start gap-4 text-left border-border hover:bg-muted hover:border-panic/50 transition-all touch-manipulation active:scale-95"
              onClick={() => {
                console.log('[PanicButton] Option clicked:', option.type);
                if (!isProcessing) handlePanicSelect(option);
              }}
              disabled={isProcessing}
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              <div className="w-12 h-12 rounded-lg bg-panic/10 flex items-center justify-center text-panic pointer-events-none">
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-panic border-t-transparent rounded-full animate-spin" />
                ) : (
                  option.icon
                )}
              </div>
              <div className="pointer-events-none">
                <div className="font-semibold text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground">
                  {isProcessing ? 'Obteniendo ubicación...' : 'Envía alerta con ubicación GPS'}
                </div>
              </div>
            </Button>
          );
        })}
      </div>

      {/* Emergency Services Quick Dial */}
      <div className="border-t border-border pt-4 mt-2 px-4 sm:px-0">
        <p className="text-xs text-muted-foreground mb-3 text-center font-medium">
          Llamar a Servicios de Emergencia
        </p>
        <div className="grid grid-cols-4 gap-2">
          {EMERGENCY_NUMBERS.map((service) => (
            <a
              key={service.number}
              href={`tel:${service.number}`}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg ${service.color} text-white hover:opacity-90 transition-opacity touch-manipulation active:scale-95`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              onClick={() => {
                vibrate([100, 50, 100]);
                toast.info(`Llamando a ${service.name}...`);
              }}
            >
              {service.icon}
              <span className="text-xs font-bold">{service.number}</span>
              <span className="text-[10px] opacity-80 truncate w-full text-center">{service.name}</span>
            </a>
          ))}
        </div>
      </div>

      {userRole === 'FAMILIAR' && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning mt-3 mx-4 sm:mx-0">
          ⚠️ FAMILIAR – NO PARAMÉDICO
        </div>
      )}

      <div className="flex items-center gap-2 p-3 rounded-lg mt-3 bg-accent/10 text-foreground border border-accent/20 mx-4 sm:mx-0">
        <Users className="w-4 h-4 text-accent" />
        <span className="text-sm">La alerta se enviará dentro de la app a usuarios conectados</span>
      </div>

      <div className="px-4 pb-6 sm:p-0">
        <Button variant="ghost" onClick={() => setIsOpen(false)} className="mt-2 w-full sm:w-auto">
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[20000]">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/80"
        onClick={() => handleOpenChange(false)}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Selecciona tipo de emergencia"
        className="absolute left-1/2 top-4 z-[20010] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-border bg-card text-card-foreground shadow-lg max-h-[calc(100dvh-2rem)] overflow-y-auto relative"
      >
        <button
          type="button"
          aria-label="Cerrar selector de emergencia"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
          onClick={() => handleOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </button>

        {content}
      </section>
    </div>
  );
};

export default PanicButton;
