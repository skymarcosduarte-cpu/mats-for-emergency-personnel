// Panic Button FAB Component for COMUNIDAD EX SOS

import React, { useState } from 'react';
import { AlertTriangle, X, Ambulance, Car, Shield, Wrench, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PanicType, UserRole } from '@/types';
import { useLocation, getGoogleMapsLink, formatCoordinates } from '@/hooks/useLocation';

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
}

export const PanicButton: React.FC<PanicButtonProps> = ({ 
  userRole = 'RESCATISTA',
  onPanicTriggered 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<PanicType | null>(null);
  const { position, getCurrentPosition, loading: locationLoading } = useLocation();

  const handlePanicSelect = async (option: PanicOption) => {
    setSelectedType(option.type);
    
    // Get fresh position
    let lat = position?.lat;
    let lng = position?.lng;
    
    if (!lat || !lng) {
      try {
        const pos = await getCurrentPosition();
        lat = pos.lat;
        lng = pos.lng;
      } catch (error) {
        console.error('Failed to get position:', error);
        return;
      }
    }

    // Trigger callback
    onPanicTriggered?.(option.type, lat, lng);

    // Generate WhatsApp link
    const message = option.whatsappMessage(lat, lng, userRole);
    const whatsappUrl = `https://wa.me/?text=${message}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');
    
    setIsOpen(false);
    setSelectedType(null);
  };

  return (
    <>
      {/* FAB Button */}
      <div className="fab-container">
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-16 h-16 rounded-full bg-panic text-primary-foreground shadow-panic animate-pulse-panic flex items-center justify-center touch-target"
          aria-label="Botón de pánico"
        >
          <AlertTriangle className="w-8 h-8" />
          
          {/* Ripple ring */}
          <span className="absolute inset-0 rounded-full border-2 border-panic animate-ping opacity-30" />
        </button>
      </div>

      {/* Panic Options Dialog */}
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
                  <div className="text-xs text-muted-foreground">
                    Envía alerta con ubicación GPS
                  </div>
                </div>
              </Button>
            ))}
          </div>

          {userRole === 'FAMILIAR' && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
              ⚠️ FAMILIAR – NO PARAMÉDICO / NO EX PARAMÉDICO
            </div>
          )}

          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="mt-2"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PanicButton;
