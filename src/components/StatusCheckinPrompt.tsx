// Status Check-in Prompt Component for COMUNIDAD EX SOS
// Shows after earthquake alerts to confirm user safety

import React from 'react';
import { AlertTriangle, Check, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StatusCheckinPromptProps {
  open: boolean;
  timeSinceEarthquake: string;
  onConfirmSafe: () => void;
  onNeedHelp: () => void;
  onDismiss: () => void;
}

export const StatusCheckinPrompt: React.FC<StatusCheckinPromptProps> = ({
  open,
  timeSinceEarthquake,
  onConfirmSafe,
  onNeedHelp,
  onDismiss,
}) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="w-6 h-6" />
            ¿Estás bien?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Se detectó un sismo hace {timeSinceEarthquake}. Por favor confirma tu estado.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
              <Clock className="w-4 h-4" />
              <span>Este aviso se muestra 5 minutos después de una alerta sísmica</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="default"
            className="w-full bg-safe hover:bg-safe/90"
            onClick={onConfirmSafe}
          >
            <Check className="w-4 h-4 mr-2" />
            Estoy bien
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={onNeedHelp}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Necesito ayuda
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onDismiss}
          >
            <X className="w-4 h-4 mr-2" />
            Cerrar por ahora
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
