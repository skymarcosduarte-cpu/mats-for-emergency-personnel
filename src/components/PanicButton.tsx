// Panic Button FAB Component for COMUNIDAD EX SOS

import React, { useState } from 'react';
import { AlertTriangle, X, Ambulance, Shield, Wrench, HardHat, Users, MapPin, Loader2, Phone, Cross } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PanicType, UserRole } from '@/types';
import { useLocation, getGoogleMapsLink, formatCoordinates } from '@/hooks/useLocation';
import { useEmergencyContactsDB } from '@/hooks/useEmergencyContactsDB';
import { toast } from 'sonner';

interface PanicOption {
  type: PanicType;
  label: string;
  icon: React.ReactNode;
  whatsappMessage: (lat: number, lng: number, role: UserRole) => string;
}

const PANIC_OPTIONS: PanicOption[] = [
  {
    type: 'AMBULANCIA_PROPIA',
    label: 'Ambulancia Propia',
    icon: <Ambulance className="w-6 h-6" />,
    whatsappMessage: (lat, lng, role) => 
      `🚑 EMERGENCIA - AMBULANCIA PROPIA%0A${role === 'FAMILIAR' ? '⚠️ FAMILIAR – NO PARAMÉDICO%0A' : ''}📍 ${getGoogleMapsLink(lat, lng)}%0AGPS: ${formatCoordinates(lat, lng)}`,
  },
  {
    type: 'AMBULANCIA_TERCERO',
    label: 'Ambulancia Tercero',
    icon: <Ambulance className="w-6 h-6" />,
    whatsappMessage: (lat, lng, role) => 
      `🚑 EMERGENCIA - AMBULANCIA TERCERO%0A${role === 'FAMILIAR' ? '⚠️ FAMILIAR – NO PARAMÉDICO%0A' : ''}📍 ${getGoogleMapsLink(lat, lng)}%0AGPS: ${formatCoordinates(lat, lng)}`,
  },
  {
    type: 'PATRULLA',
    label: 'Patrulla',
    icon: <Shield className="w-6 h-6" />,
    whatsappMessage: (lat, lng, role) => 
      `🚔 EMERGENCIA - PATRULLA%0A${role === 'FAMILIAR' ? '⚠️ FAMILIAR – NO PARAMÉDICO%0A' : ''}📍 ${getGoogleMapsLink(lat, lng)}%0AGPS: ${formatCoordinates(lat, lng)}`,
  },
  {
    type: 'MECANICO',
    label: 'Mecánico',
    icon: <Wrench className="w-6 h-6" />,
    whatsappMessage: (lat, lng, role) => 
      `🔧 ASISTENCIA - MECÁNICO%0A${role === 'FAMILIAR' ? '⚠️ FAMILIAR – NO PARAMÉDICO%0A' : ''}📍 ${getGoogleMapsLink(lat, lng)}%0AGPS: ${formatCoordinates(lat, lng)}`,
  },
  {
    type: 'PROTECCION_CIVIL',
    label: 'Protección Civil',
    icon: <HardHat className="w-6 h-6" />,
    whatsappMessage: (lat, lng, role) => 
      `🆘 EMERGENCIA - PROTECCIÓN CIVIL%0A${role === 'FAMILIAR' ? '⚠️ FAMILIAR – NO PARAMÉDICO%0A' : ''}📍 ${getGoogleMapsLink(lat, lng)}%0AGPS: ${formatCoordinates(lat, lng)}`,
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
  const { contacts, getSOSWhatsAppUrls, hasMinimumContacts } = useEmergencyContactsDB();

  const GPS_TIMEOUT_MS = 10000; // 10 seconds

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  
  const setIsOpen = (open: boolean) => {
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

    // Open a placeholder window immediately (user gesture) to bypass Android popup blockers.
    // We will redirect it once we have the GPS + message.
    let waWindow: Window | null = null;
    try {
      waWindow = window.open('about:blank', '_blank');
    } catch {
      waWindow = null;
    }

    // Immediate feedback: vibration + toast
    vibrate([200, 100, 200, 100, 300]); // SOS-style pattern

    let lat = position?.lat;
    let lng = position?.lng;

    // Get position with timeout
    if (!lat || !lng) {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          setGpsTimeout(true);
          reject(new Error('GPS_TIMEOUT'));
        }, GPS_TIMEOUT_MS);
      });

      try {
        const pos = await Promise.race([
          getCurrentPosition(),
          timeoutPromise
        ]);
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
        waWindow?.close();
        return;
      }
    }
    
    setIsGettingLocation(false);
    setGpsTimeout(false);

    // Notify parent component
    onPanicTriggered?.(option.type, lat, lng);

    // Build WhatsApp URL
    const message = option.whatsappMessage(lat, lng, userRole);
    const waUrl = `https://wa.me/?text=${message}`;

    // Close dialog first to prevent UI freeze
    setIsOpen(false);
    setSelectedType(null);

    // Redirect the placeholder window (or fallback to opening a new tab)
    // NOTE: On desktop, navigating the current tab away from the app can feel like a "freeze".
    try {
      if (waWindow && !waWindow.closed) {
        // This should work even if popups are blocked because the window already exists.
        waWindow.location.assign(waUrl);
      } else {
        const opened = window.open(waUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          toast.error('Pop-up bloqueado', {
            description: 'Tu navegador bloqueó WhatsApp. Presiona “Abrir WhatsApp”.',
            duration: 10000,
            action: {
              label: 'Abrir WhatsApp',
              onClick: () => window.open(waUrl, '_blank', 'noopener,noreferrer'),
            },
          });
        }
      }
    } catch (e) {
      console.error('Failed to open WhatsApp:', e);
      toast.error('No se pudo abrir WhatsApp', {
        description: 'Copia el mensaje o intenta permitir pop-ups para este sitio.',
        duration: 8000,
      });
    }

    // Notify emergency contacts via WhatsApp
    if (contacts.length > 0) {
      const sosMessage = `🆘 SOS - ${option.label.toUpperCase()}\n\n📍 Ubicación: ${getGoogleMapsLink(lat, lng)}\nGPS: ${formatCoordinates(lat, lng)}\n\n¡Necesito ayuda urgente!`;
      const contactUrls = getSOSWhatsAppUrls(sosMessage);

      // Show notification about contacts being alerted
      toast.success(
        `Alertando a ${contacts.length} contacto(s) de emergencia`,
        {
          description: contacts.map(c => c.name).join(', '),
          duration: 15000,
        }
      );

      // On desktop, opening many tabs can freeze the browser.
      const isDesktop = window.matchMedia('(pointer: fine)').matches;

      if (isDesktop) {
        toast.info('Contactos de emergencia', {
          description: 'En desktop no abrimos múltiples chats automáticamente para evitar congelamientos.',
          duration: 9000,
        });
      } else {
        // Open WhatsApp for each contact with a small delay between each
        contactUrls.forEach((item, index) => {
          setTimeout(() => {
            try {
              window.open(item.url, '_blank', 'noopener,noreferrer');
            } catch (e) {
              console.error(`Failed to open WhatsApp for ${item.contact.name}:`, e);
            }
          }, 500 + (index * 1500)); // Stagger openings to avoid popup blockers
        });
      }
    } else {
      toast.warning(
        'No tienes contactos de emergencia configurados',
        {
          description: 'Agrega contactos en Configuración para que sean notificados automáticamente',
          duration: 8000,
        }
      );
    }
  };

  const isProcessingAny = isGettingLocation || selectedType !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessingAny && setIsOpen(open)}>
      <DialogContent className="sm:max-w-md bg-card border-border relative overflow-hidden">
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

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-5 h-5 text-panic" />
            Selecciona tipo de emergencia
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
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
        <div className="border-t border-border pt-4 mt-2">
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
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning mt-3">
            ⚠️ FAMILIAR – NO PARAMÉDICO
          </div>
        )}

        <div className={`flex items-center gap-2 p-3 rounded-lg mt-3 ${hasMinimumContacts ? 'bg-safe/10 text-safe' : 'bg-warning/10 text-warning'}`}>
          <Users className="w-4 h-4" />
          <span className="text-sm">
            {hasMinimumContacts 
              ? `${contacts.length} contacto(s) serán notificados`
              : 'Agrega contactos de emergencia en Configuración'
            }
          </span>
        </div>

        <Button variant="ghost" onClick={() => setIsOpen(false)} className="mt-2">
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default PanicButton;
