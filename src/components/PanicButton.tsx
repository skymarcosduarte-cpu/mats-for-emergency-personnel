// Panic Button FAB Component for COMUNIDAD EX SOS

import React, { useState } from 'react';
import { AlertTriangle, X, Ambulance, Shield, Wrench, HardHat, Users } from 'lucide-react';
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
  const { position, getCurrentPosition, loading: locationLoading } = useLocation();
  const { contacts, getSOSWhatsAppUrls, hasMinimumContacts } = useEmergencyContactsDB();

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

    // Immediate feedback: vibration + toast
    vibrate([200, 100, 200, 100, 300]); // SOS-style pattern
    toast.info(`Enviando alerta: ${option.label}`, {
      duration: 4000,
      icon: '🚨',
    });

    // IMPORTANT: Open a window synchronously to avoid popup blockers (mobile Safari/Chrome)
    const placeholderWindow = window.open('about:blank', '_blank');
    if (!placeholderWindow) {
      toast.error('No se pudo abrir WhatsApp (bloqueador de ventanas emergentes).');
    }

    let lat = position?.lat;
    let lng = position?.lng;

    if (!lat || !lng) {
      try {
        const pos = await getCurrentPosition();
        lat = pos.lat;
        lng = pos.lng;
      } catch (error) {
        console.error('Failed to get position:', error);
        try {
          placeholderWindow?.close();
        } catch {
          // ignore
        }
        toast.error('No se pudo obtener tu ubicación.');
        return;
      }
    }

    onPanicTriggered?.(option.type, lat, lng);

    // Open WhatsApp for community
    const message = option.whatsappMessage(lat, lng, userRole);
    const waUrl = `https://wa.me/?text=${message}`;

    try {
      if (placeholderWindow) {
        placeholderWindow.location.href = waUrl;
      } else {
        // Fallback: may still be blocked, but best effort
        window.location.href = waUrl;
      }
    } catch (e) {
      console.error('Failed to navigate to WhatsApp:', e);
      toast.error('No se pudo abrir WhatsApp.');
    }

    // Notify emergency contacts
    if (contacts.length > 0) {
      const sosMessage = `🆘 SOS - ${option.label.toUpperCase()}\n\n📍 Ubicación: ${getGoogleMapsLink(lat, lng)}\nGPS: ${formatCoordinates(lat, lng)}\n\n¡Necesito ayuda urgente!`;
      const contactUrls = getSOSWhatsAppUrls(sosMessage);

      toast.success(`Alertando a ${contacts.length} contacto(s) de emergencia`, {
        action: {
          label: 'Abrir WhatsApp',
          onClick: () => contactUrls[0] && window.open(contactUrls[0].url, '_blank'),
        },
        duration: 10000,
      });
    }

    setIsOpen(false);
    setSelectedType(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-5 h-5 text-panic" />
            Selecciona tipo de emergencia
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          {PANIC_OPTIONS.map((option) => (
            <Button
              key={option.type}
              variant="outline"
              className="h-16 justify-start gap-4 text-left border-border hover:bg-muted hover:border-panic/50 transition-all"
              onClick={() => handlePanicSelect(option)}
              disabled={locationLoading && selectedType === option.type}
            >
              <div className="w-12 h-12 rounded-lg bg-panic/10 flex items-center justify-center text-panic">
                {option.icon}
              </div>
              <div>
                <div className="font-semibold text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground">Envía alerta con ubicación GPS</div>
              </div>
            </Button>
          ))}
        </div>

        {userRole === 'FAMILIAR' && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
            ⚠️ FAMILIAR – NO PARAMÉDICO
          </div>
        )}

        <div className={`flex items-center gap-2 p-3 rounded-lg ${hasMinimumContacts ? 'bg-safe/10 text-safe' : 'bg-warning/10 text-warning'}`}>
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
