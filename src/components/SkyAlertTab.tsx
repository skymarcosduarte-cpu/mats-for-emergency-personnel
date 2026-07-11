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

type VerificationSource = 'sassla' | 'skyalert';

interface ScrapingDebugResult {
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
    lastSoundAlert,
  } = useSkyAlertAlerts();
  
  const [selectedAlert, setSelectedAlert] = useState<SkyAlert | null>(null);
  const [verifySource, setVerifySource] = useState<VerificationSource | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyData, setVerifyData] = useState<Partial<Record<VerificationSource, ScrapingDebugResult>>>({});

  const runVerification = useCallback(async (source: VerificationSource) => {
    setVerifyLoading(true);
    setVerifyError(null);
    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anon = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
      if (!projectUrl) throw new Error('Backend no configurado');
      const target = `${projectUrl}/functions/v1/fetch-skyalert?debug=${source}`;
      const res = await fetch(target, {
        headers: anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ScrapingDebugResult;
      setVerifyData((current) => ({ ...current, [source]: json }));
    } catch (e) {
      console.error(`[${source} verify] error:`, e);
      setVerifyError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setVerifyLoading(false);
    }
  }, []);

  const openVerify = useCallback((source: VerificationSource) => {
    setVerifySource(source);
    if (!verifyData[source]) runVerification(source);
  }, [runVerification, verifyData]);

  const activeVerification = verifySource ? verifyData[verifySource] : null;
  const verificationName = verifySource === 'skyalert' ? 'SkyAlert' : 'SASSLA';

  const getLevelColor = (level: SkyAlert['level']) => {
    const l = level.toLowerCase();
    if (l.includes('violen')) return 'bg-purple-600 text-white';
    if (l.includes('sever')) return 'bg-destructive text-destructive-foreground';
    if (l.includes('moderad')) return 'bg-warning text-warning-foreground';
    return 'bg-primary text-primary-foreground';
  };

  const getLevelBorder = (level: SkyAlert['level']) => {
    const l = level.toLowerCase();
    if (l.includes('violen')) return 'border-purple-600';
    if (l.includes('sever')) return 'border-destructive';
    if (l.includes('moderad')) return 'border-warning';
    return 'border-primary';
  };

  const getLevelIcon = (level: SkyAlert['level']) => {
    const l = level.toLowerCase();
    if (l.includes('violen')) return '💥';
    if (l.includes('sever')) return '🚨';
    if (l.includes('moderad')) return '⚠️';
    return '📢';
  };

  // Show severe, violent AND moderate alerts
  const visibleAlerts = alerts.filter(a => {
    const l = a.level.toLowerCase();
    return l.includes('sever') || l.includes('violen') || l.includes('moderad');
  });

  return (
    <div className="space-y-4">
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
          {isActive ? (
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

      {lastSoundAlert && (
        <div className="p-4 border-2 border-destructive bg-destructive/10" role="alert" aria-live="assertive">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <p className="font-bold text-destructive">La última notificación sonora corresponde a:</p>
              <p className="font-semibold">
                {getLevelIcon(lastSoundAlert.level)} Alerta {lastSoundAlert.level} · {lastSoundAlert.region}
              </p>
              <p className="text-sm leading-relaxed break-words">{lastSoundAlert.message}</p>
              <p className="text-xs text-muted-foreground">
                Fuente: {lastSoundAlert.source} · {new Date(lastSoundAlert.timestamp).toLocaleString('es-MX')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border-2 border-border">
        <Radio className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-base">
          <p className="text-muted-foreground leading-relaxed">
            Esta sección monitorea las cuentas oficiales de <strong>SkyAlert</strong> y <strong>SASSLA</strong> en X. Para notificaciones en tiempo real, descarga las apps oficiales.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['sassla', 'skyalert'] as const).map((source) => {
          const name = source === 'skyalert' ? 'SkyAlert' : 'SASSLA';
          return (
            <div key={source} className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-dashed border-border bg-background">
              <div className="flex items-center gap-2 min-w-0">
                <Bug className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-base leading-tight">Verificación {name}</p>
                  <p className="text-xs text-muted-foreground">Consulta el scraping en vivo.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openVerify(source)} className="shrink-0">
                Abrir
              </Button>
            </div>
          );
        })}
      </div>

      {loading && visibleAlerts.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && visibleAlerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-1">Sin alertas activas</h3>
          <p className="text-sm text-muted-foreground">Monitoreando continuamente...</p>
        </div>
      )}

      {visibleAlerts.length > 0 && (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => (
            <Card 
              key={alert.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md border-l-4",
                getLevelBorder(alert.level),
                (alert.level.toLowerCase().includes('sever') || alert.level.toLowerCase().includes('violen')) && "animate-pulse"
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
                    <div>{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true, locale: es })}</div>
                    <div className="text-[10px] opacity-70">{alert.source}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedAlert && getLevelIcon(selectedAlert.level)}</span>
              <span>Detalle de Alerta</span>
            </DialogTitle>
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
                <p>{new Date(selectedAlert.timestamp).toLocaleString('es-MX')}</p>
              </div>
              <Button className="w-full" variant="outline" onClick={() => window.open(selectedAlert.source.includes('SkyAlert') ? 'https://x.com/SkyAlertMx' : 'https://x.com/SasslaMx', '_blank')}>
                Ver fuente en X
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={verifySource !== null} onOpenChange={(open) => !open && setVerifySource(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bug className="w-5 h-5" />Verificación {verificationName}</DialogTitle>
            <DialogDescription>Últimas publicaciones obtenidas de la cuenta oficial en X.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button onClick={() => verifySource && runVerification(verifySource)} disabled={verifyLoading} size="sm" className="gap-2">
              {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
              {verifyLoading ? 'Consultando...' : 'Reintentar consulta'}
            </Button>
            {verifyError && (
              <div className="flex items-start gap-2 border border-destructive bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>No fue posible consultar {verificationName}: {verifyError}</span>
              </div>
            )}
            {activeVerification && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Fuentes consultadas</h4>
                  <ul className="space-y-1 text-xs">
                    {activeVerification.attempts.map((a, i) => (
                      <li key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        {a.ok ? <CheckCircle2 className="w-3 h-3 text-success" /> : <AlertTriangle className="w-3 h-3 text-destructive" />}
                        <span className="truncate flex-1">{a.url.includes('syndication.twitter.com') ? 'Feed público oficial de X' : a.url}</span>
                        <span>{a.status || 'ERR'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Últimos tuits</h4>
                  <ul className="space-y-2">
                    {activeVerification.items.map((it, i) => (
                      <li key={i} className="p-2 rounded-lg bg-muted/40 border border-border text-sm">
                        {it.text}
                        <div className="text-[11px] text-muted-foreground mt-1">{it.pubDate}</div>
                      </li>
                    ))}
                  </ul>
                  {activeVerification.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">La cuenta no devolvió publicaciones en esta consulta.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
