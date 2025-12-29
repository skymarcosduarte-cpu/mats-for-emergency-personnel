import React, { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Heart, 
  Zap, 
  ListChecks, 
  AlertTriangle, 
  ArrowRightLeft,
  Shield,
  Share2,
  Copy,
  MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { ResourceCard, getCategoryLabel } from '@/lib/resourcesCache';
import { cn } from '@/lib/utils';

interface ResourceDetailModalProps {
  card: ResourceCard | null;
  open: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function ResourceDetailModal({ 
  card, 
  open, 
  onClose, 
  isFavorite, 
  onToggleFavorite 
}: ResourceDetailModalProps) {
  // Format card content for sharing
  const formatCardForSharing = useCallback(() => {
    if (!card) return '';
    
    const lines = [
      `📋 *${card.title}*`,
      '',
      card.summary,
      '',
      '⚡ *QUÉ HACER AHORA:*',
      ...card.doNow.map((item, i) => `${i + 1}. ${item}`),
      '',
      '📝 *PASOS:*',
      ...card.steps.map(step => `• ${step}`),
      '',
      '⚠️ *ALERTAS:*',
      ...card.redFlags.map(flag => `⚠ ${flag}`),
      '',
      '🔄 *ENTREGA:*',
      card.handover,
      '',
      `📱 Recurso de M.A.T.S. - ${card.audience === 'personal_capacitado' ? 'Solo personal capacitado' : 'Público general'}`,
    ];
    
    return lines.join('\n');
  }, [card]);

  const handleCopyToClipboard = useCallback(async () => {
    const text = formatCardForSharing();
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado al portapapeles', {
        description: 'Puedes pegarlo donde quieras',
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Error al copiar');
    }
  }, [formatCardForSharing]);

  const handleShareWhatsApp = useCallback(() => {
    const text = formatCardForSharing();
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  }, [formatCardForSharing]);

  if (!card) return null;

  const isTrainedPersonnel = card.audience === 'personal_capacitado';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <DialogTitle className="text-xl leading-tight pr-8">
                {card.title}
              </DialogTitle>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="outline" className="text-xs">
                  {getCategoryLabel(card.category)}
                </Badge>
                {isTrainedPersonnel ? (
                  <Badge className="text-xs bg-amber-500 hover:bg-amber-600 text-white">
                    <Shield className="w-3 h-3 mr-1" />
                    Solo personal capacitado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Público
                  </Badge>
                )}
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    card.level === 'intermedio' && "border-blue-500 text-blue-600"
                  )}
                >
                  {card.level === 'basico' ? 'Básico' : 'Intermedio'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1">
              {/* Share dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                  >
                    <Share2 className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background">
                  <DropdownMenuItem onClick={handleShareWhatsApp}>
                    <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                    Compartir por WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyToClipboard}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar al portapapeles
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={onToggleFavorite}
              >
                <Heart 
                  className={cn(
                    "h-5 w-5",
                    isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                  )} 
                />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {/* Summary */}
            <p className="text-base text-muted-foreground">
              {card.summary}
            </p>

            {/* Do Now - Most important, highlighted */}
            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-lg text-primary">Qué hacer AHORA</h3>
              </div>
              <ul className="space-y-2">
                {card.doNow.map((item, index) => (
                  <li 
                    key={index} 
                    className="flex items-start gap-2 text-base font-medium"
                  >
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* Steps */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="h-5 w-5 text-blue-500" />
                <h3 className="font-bold text-lg">Pasos</h3>
              </div>
              <ul className="space-y-2">
                {card.steps.map((step, index) => (
                  <li 
                    key={index} 
                    className="flex items-start gap-2 text-base"
                  >
                    <span className="text-blue-500 font-bold mt-0.5">•</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* Red Flags - Warning section */}
            <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="font-bold text-lg text-destructive">Alertas</h3>
              </div>
              <ul className="space-y-2">
                {card.redFlags.map((flag, index) => (
                  <li 
                    key={index} 
                    className="flex items-start gap-2 text-base"
                  >
                    <span className="text-destructive font-bold mt-0.5">⚠</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* Handover */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ArrowRightLeft className="h-5 w-5 text-green-500" />
                <h3 className="font-bold text-lg">Entrega / Handover</h3>
              </div>
              <p className="text-base bg-muted/50 p-3 rounded-lg">
                {card.handover}
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Close button fixed at bottom */}
        <div className="p-4 border-t flex-shrink-0">
          <Button onClick={onClose} className="w-full" size="lg">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
