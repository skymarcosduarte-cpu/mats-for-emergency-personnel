// Thank You Dialog shown to alert creators when their alert is resolved
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThankYouDialogProps {
  open: boolean;
  onClose: () => void;
  onRate?: (rating: number) => void;
}

export const ThankYouDialog: React.FC<ThankYouDialogProps> = ({
  open,
  onClose,
  onRate,
}) => {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState(false);

  const handleRate = (rating: number) => {
    setSelectedRating(rating);
    setHasRated(true);
    onRate?.(rating);
  };

  const handleClose = () => {
    setSelectedRating(0);
    setHoveredRating(0);
    setHasRated(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <Heart className="h-8 w-8 text-success fill-success" />
          </div>
          <DialogTitle className="text-xl text-center">
            {hasRated ? "¡Gracias por tu calificación!" : "¡Alerta resuelta!"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {hasRated 
              ? "Tu opinión nos ayuda a mejorar la comunidad."
              : "Un rescatista atendió tu solicitud de ayuda. ¿Cómo calificarías la respuesta?"
            }
          </DialogDescription>
        </DialogHeader>

        {!hasRated && (
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    "h-8 w-8 transition-colors",
                    (hoveredRating >= star || selectedRating >= star)
                      ? "text-warning fill-warning"
                      : "text-muted-foreground"
                  )}
                />
              </button>
            ))}
          </div>
        )}

        {hasRated && (
          <div className="flex justify-center gap-1 py-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "h-6 w-6",
                  selectedRating >= star
                    ? "text-warning fill-warning"
                    : "text-muted-foreground"
                )}
              />
            ))}
          </div>
        )}

        <div className="flex justify-center gap-3 mt-2">
          {!hasRated && (
            <Button variant="ghost" onClick={handleClose}>
              Omitir
            </Button>
          )}
          {hasRated && (
            <Button onClick={handleClose}>
              Cerrar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
