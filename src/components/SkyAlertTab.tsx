// SkyAlert Tab Component
// Displays SkyAlert seismic monitoring status and active alerts

import React, { useState, useCallback } from 'react';
import { Activity, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Radio, Bug, RotateCw } from 'lucide-react';
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

interface SasslaDebugResult {
  ok: boolean;
  mirror: string | null;
  attempts: Array<{ url: string; ok: boolean; status?: number; error?: string }>;
  itemCount: number;
  items: Array<{ text: string; pubDate: string | null; ageMinutes: number | null }>;
  matchedAlerts: SkyAlert[];
  checkedAt: string;
}

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
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyData, setVerifyData] = useState<SasslaDebugResult | null>(null);

  const runSasslaVerification = useCallback(async () => {
    setVerifyLoading(true);
    setVerifyError(null);
    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anon = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
      if (!projectUrl) throw new Error('Backend no configurado');
      const target = `${projectUrl}/functions/v1/fetch-skyalert?debug=sassla`;
      const res = await fetch(target, {
        headers: anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SasslaDebugResult;
      setVerifyData(json);
    } catch (e) {
      console.error('[SASSLA verify] error:', e);
      setVerifyError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setVerifyLoading(false);
    }
  }, []);

  const openVerify = useCallback(() => {
    setVerifyOpen(true);
    if (!verifyData) runSasslaVerification();
  }, [runSasslaVerification, verifyData]);

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
              href="https://x.com/SasslaMx"
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

      {/* Verification mode */}
      <div className="flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-border bg-background">
        <div className="flex items-center gap-2 min-w-0">
          <Bug className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-base leading-tight">Modo verificación SASSLA</p>
            <p className="text-xs text-muted-foreground">Consulta el scraping en vivo y muestra los últimos tuits.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={openVerify} className="shrink-0">
          Abrir
        </Button>
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

      {/* SASSLA verification dialog */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Verificación SASSLA
            </DialogTitle>
            <DialogDescription>
              Estado del scraping desde la cuenta @SASSLA_ en X.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={runSasslaVerification}
                disabled={verifyLoading}
                size="sm"
                className="gap-2"
              >
                {verifyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCw className="w-4 h-4" />
                )}
                {verifyLoading ? 'Consultando...' : 'Reintentar consulta'}
              </Button>
              {verifyData && (
                <Badge variant={verifyData.ok ? 'outline' : 'destructive'}>
                  {verifyData.ok ? 'OK' : 'Sin respuesta'}
                </Badge>
              )}
            </div>

            {verifyError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-sm">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-destructive">Falló la consulta</p>
                  <p className="text-muted-foreground break-words">{verifyError}</p>
                </div>
              </div>
            )}

            {verifyData && (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">Mirrors intentados</h4>
                  <ul className="space-y-1 text-xs">
                    {verifyData.attempts.map((a) => (
                      <li
                        key={a.url}
                        className="flex items-center gap-2 p-2 rounded bg-muted/50"
                      >
                        {a.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        <span className="font-mono truncate flex-1">{a.url}</span>
                        <span className="text-muted-foreground shrink-0">
                          {a.status ?? a.error ?? '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {verifyData.mirror && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Mirror activo: <span className="font-mono">{verifyData.mirror}</span>
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                    Últimos {verifyData.items.length} tuits
                  </h4>
                  {verifyData.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Sin publicaciones disponibles.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {verifyData.items.map((it, i) => (
                        <li
                          key={i}
                          className="p-2 rounded-lg bg-muted/40 border border-border"
                        >
                          <p className="text-sm leading-snug">{it.text}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {it.pubDate ?? 'Sin fecha'}
                            {it.ageMinutes !== null && ` · hace ${it.ageMinutes} min`}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {verifyData.matchedAlerts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                      Alertas sísmicas reconocidas ({verifyData.matchedAlerts.length})
                    </h4>
                    <ul className="space-y-2">
                      {verifyData.matchedAlerts.map((a) => (
                        <li key={a.id} className="p-2 rounded-lg border-l-4 border-primary bg-primary/5">
                          <div className="flex items-center gap-2 text-xs">
                            <Badge>{a.level.toUpperCase()}</Badge>
                            {a.magnitude && <span className="font-mono">M{a.magnitude.toFixed(1)}</span>}
                            <span className="text-muted-foreground truncate">{a.region}</span>
                          </div>
                          <p className="text-sm mt-1">{a.message}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground text-right">
                  Consultado: {new Date(verifyData.checkedAt).toLocaleString()}
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
