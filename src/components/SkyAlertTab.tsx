// SkyAlert Tab Component
// Displays SkyAlert seismic monitoring status and active alerts

import React, { useState } from 'react';
import { Activity, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSkyAlertAlerts, SkyAlert } from '@/hooks/useSkyAlertAlerts';

export function SkyAlertTab() {
  const { 
    alerts, 
    loading, 
    isActive, 
    lastChecked, 
    refresh,
    isMonitoring,
  } = useSkyAlertAlerts();
  
  const [selectedAlert, setSelectedAlert] = useState<SkyAlert | null>(null);

  const getLevelColor = (level: SkyAlert['level']) => {
    switch (level) {
      case 'violenta':
      case 'violento':
        return 'bg-purple-600 text-white';
      case 'severa':
      case 'severo':
        return 'bg-destructive text-destructive-foreground';
      case 'moderada':
        return 'bg-warning text-warning-foreground';
      case 'preventiva':
        return 'bg-primary text-primary-foreground';
    }
  };

  const getLevelBorder = (level: SkyAlert['level']) => {
    switch (level) {
      case 'violenta':
      case 'violento':
        return 'border-purple-600';
      case 'severa':
      case 'severo':
        return 'border-destructive';
      case 'moderada':
        return 'border-warning';
      case 'preventiva':
        return 'border-primary';
    }
  };

  const getLevelIcon = (level: SkyAlert['level']) => {
    switch (level) {
      case 'violenta':
      case 'violento':
        return '💥';
      case 'severa':
      case 'severo':
        return '🚨';
      case 'moderada':
        return '⚠️';
      case 'preventiva':
        return '📢';
    }
  };

  // Only show severe and violent alerts (both masculine and feminine forms)
  const visibleAlerts = alerts.filter(a => 
    a.level === 'severa' || a.level === 'severo' || 
    a.level === 'violenta' || a.level === 'violento'
  );

  return (
    <div className="space-y-4">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="w-5 h-5 text-primary" />
            {isMonitoring && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {lastChecked ? (
              <>Actualizado: {lastChecked.toLocaleTimeString()}</>
            ) : (
              <>Iniciando monitoreo...</>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Only show active badge for severe/violent alerts */}
          {visibleAlerts.length > 0 ? (
            <Badge variant="destructive" className="animate-pulse">
              Alerta activa
            </Badge>
          ) : (
            <Badge variant="outline" className="text-success border-success">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Sin alertas
            </Badge>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={refresh}
            disabled={loading}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border-2 border-border">
        <Radio className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-base">
          <p className="text-muted-foreground leading-relaxed">
            Esta sección monitorea las cuentas oficiales de <strong>SkyAlert</strong> y <strong>SASSLA</strong> en X para mostrarte sus alertas sísmicas. Para notificaciones en tiempo real, descarga las apps oficiales en tu dispositivo.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <a 
              href="https://www.skyalert.mx/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-base"
            >
              App SkyAlert
              <ExternalLink className="w-4 h-4" />
            </a>
            <a 
              href="https://x.com/SASSLA_"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-base"
            >
              Cuenta SASSLA
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && visibleAlerts.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && visibleAlerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="relative mb-4">
            <Activity className="w-16 h-16 text-muted-foreground/30" />
            <span className="absolute bottom-0 right-0 w-6 h-6 bg-success rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-success-foreground" />
            </span>
          </div>
          <h3 className="text-lg font-medium mb-1">Sin alertas activas</h3>
          <p className="text-sm text-muted-foreground mb-4">
            El sistema está monitoreando continuamente
          </p>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Se actualizará automáticamente cada 10 segundos
          </Badge>
        </div>
      )}

      {/* Alerts list - only severe and violent */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => (
            <Card 
              key={alert.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md border-l-4",
                getLevelBorder(alert.level),
                alert.level === 'severa' && "animate-pulse"
              )}
              onClick={() => setSelectedAlert(alert)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getLevelIcon(alert.level)}</span>
                      <Badge className={getLevelColor(alert.level)}>
                        {alert.level.toUpperCase()}
                      </Badge>
                      {alert.magnitude && (
                        <Badge variant="outline" className="font-mono">
                          M{alert.magnitude.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                    
                    <h4 className="font-medium truncate">{alert.region}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {alert.message}
                    </p>
                  </div>
                  
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    <div>
                      {formatDistanceToNow(new Date(alert.timestamp), { 
                        addSuffix: true,
                        locale: es 
                      })}
                    </div>
                    <div className="text-[10px] opacity-70">{alert.source}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Alert detail dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedAlert && getLevelIcon(selectedAlert.level)}</span>
              <span>Detalle de Alerta</span>
            </DialogTitle>
            <DialogDescription>
              {selectedAlert?.source}
            </DialogDescription>
          </DialogHeader>
          
          {selectedAlert && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={getLevelColor(selectedAlert.level)}>
                  {selectedAlert.level.toUpperCase()}
                </Badge>
                {selectedAlert.magnitude && (
                  <Badge variant="outline" className="font-mono text-lg">
                    Magnitud {selectedAlert.magnitude.toFixed(1)}
                  </Badge>
                )}
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Región</h4>
                <p className="font-medium">{selectedAlert.region}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Mensaje</h4>
                <p>{selectedAlert.message}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Hora</h4>
                <p>
                  {new Date(selectedAlert.timestamp).toLocaleString('es-MX', {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  })}
                </p>
              </div>
              
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => window.open('https://www.skyalert.mx/', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir SkyAlert
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
