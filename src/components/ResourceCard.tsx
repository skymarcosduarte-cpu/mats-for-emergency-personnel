import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, ChevronRight, Shield } from 'lucide-react';
import { ResourceCard as ResourceCardType, getCategoryLabel } from '@/lib/resourcesCache';
import { cn } from '@/lib/utils';

interface ResourceCardProps {
  card: ResourceCardType;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}

export function ResourceCard({ card, isFavorite, onToggleFavorite, onClick }: ResourceCardProps) {
  const isTrainedPersonnel = card.audience === 'personal_capacitado';
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md active:scale-[0.99]",
        isTrainedPersonnel && "border-amber-500/50 bg-amber-500/5"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h3 className="font-semibold text-base leading-tight mb-1.5 text-foreground">
              {card.title}
            </h3>
            
            {/* Summary */}
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {card.summary}
            </p>
            
            {/* Badges */}
            <div className="flex flex-wrap gap-1.5">
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
          
          {/* Actions */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              <Heart 
                className={cn(
                  "h-5 w-5 transition-colors",
                  isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                )} 
              />
            </Button>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
