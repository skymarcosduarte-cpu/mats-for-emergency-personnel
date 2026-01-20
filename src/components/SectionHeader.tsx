// Section Header with Back to Home button
import React from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onGoHome?: () => void;
  rightContent?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  onGoHome,
  rightContent,
}) => {
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 pt-4 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onGoHome && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onGoHome}
              className="h-8 w-8 shrink-0"
              title="Volver a Inicio"
            >
              <Home className="w-5 h-5" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {rightContent && (
          <div className="flex gap-2 shrink-0">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
};
