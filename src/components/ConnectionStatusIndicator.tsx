import React from 'react';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { cn } from '@/lib/utils';

export const ConnectionStatusIndicator: React.FC = () => {
  const { isConnected, isChecking, lastChecked, error, retry } = useConnectionStatus();

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg transition-colors",
      isConnected 
        ? "bg-safe/10" 
        : "bg-destructive/10"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          isConnected ? "bg-safe/20" : "bg-destructive/20"
        )}>
          {isChecking ? (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          ) : isConnected ? (
            <Wifi className="w-5 h-5 text-safe" />
          ) : (
            <WifiOff className="w-5 h-5 text-destructive" />
          )}
        </div>
        <div>
          <p className={cn(
            "font-medium",
            isConnected ? "text-safe" : "text-destructive"
          )}>
            {isChecking 
              ? 'Verificando...' 
              : isConnected 
                ? 'Conectado al servidor' 
                : 'Sin conexión'}
          </p>
          <p className="text-xs text-muted-foreground">
            {error 
              ? error 
              : lastChecked 
                ? `Última verificación: ${formatTime(lastChecked)}`
                : 'Verificando conexión...'}
          </p>
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={retry}
        disabled={isChecking}
        className="shrink-0"
      >
        <RefreshCw className={cn(
          "w-4 h-4",
          isChecking && "animate-spin"
        )} />
      </Button>
    </div>
  );
};
