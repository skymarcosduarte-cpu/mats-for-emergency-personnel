import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Check, 
  Clock, 
  MapPin, 
  Navigation,
  X,
  Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DelayedTripInfo {
  id: string;
  origin: string;
  destination: string;
  eta: string;
  overdueMinutes: number;
}

interface TripSafetyCheckDialogProps {
  trip: DelayedTripInfo | null;
  onConfirmSafe: () => void;
  onConfirmArrived: () => void;
  onExtendEta: (minutes: number) => void;
  onDismiss: () => void;
  isUpdating?: boolean;
}

const ETA_EXTENSION_OPTIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hora' },
  { minutes: 120, label: '2 horas' },
];

export function TripSafetyCheckDialog({
  trip,
  onConfirmSafe,
  onConfirmArrived,
  onExtendEta,
  onDismiss,
  isUpdating = false,
}: TripSafetyCheckDialogProps) {
  const [showExtendOptions, setShowExtendOptions] = useState(false);

  if (!trip) return null;

  return (
    <Dialog open={!!trip} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="max-w-sm bg-card border-destructive/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Viaje Retrasado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Trip Info */}
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Navigation className="w-4 h-4 text-primary" />
              <span className="font-medium">{trip.origin}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{trip.destination}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {trip.overdueMinutes} min de retraso
              </Badge>
            </div>
          </div>

          {/* Safety Question */}
          <div className="text-center py-2">
            <p className="text-lg font-medium text-foreground">¿Estás bien?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tu comunidad está preocupada por ti
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!showExtendOptions ? (
              <motion.div
                key="main-options"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {/* Main Options */}
                <Button
                  className="w-full bg-safe hover:bg-safe/90 text-safe-foreground"
                  size="lg"
                  onClick={onConfirmArrived}
                  disabled={isUpdating}
                >
                  <Check className="w-5 h-5 mr-2" />
                  Ya llegué a mi destino
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  size="lg"
                  onClick={onConfirmSafe}
                  disabled={isUpdating}
                >
                  <MapPin className="w-5 h-5 mr-2" />
                  Estoy bien, sigo en camino
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowExtendOptions(true)}
                  disabled={isUpdating}
                >
                  <Clock className="w-5 h-5 mr-2" />
                  Necesito más tiempo
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="extend-options"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <p className="text-sm text-center text-muted-foreground">
                  ¿Cuánto tiempo adicional necesitas?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ETA_EXTENSION_OPTIONS.map((option) => (
                    <Button
                      key={option.minutes}
                      variant="outline"
                      onClick={() => onExtendEta(option.minutes)}
                      disabled={isUpdating}
                    >
                      +{option.label}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowExtendOptions(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Emergency Contact Info */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              <Phone className="w-3 h-3 inline mr-1" />
              Tus contactos de emergencia fueron notificados
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
