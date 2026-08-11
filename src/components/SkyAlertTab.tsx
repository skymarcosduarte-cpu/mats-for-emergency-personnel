// SkyAlert Tab Component
// Displays SkyAlert seismic monitoring status and active alerts

import React, { useState, useCallback, useEffect } from 'react';
import { Activity, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Loader2, Radio, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  retryAfterSeconds?: number;
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
  const [dismissedSoundAlertId, setDismissedSoundAlertId] = useState<string | null>(null);

  const [feeds, setFeeds] = useState<Partial<Record<VerificationSource, ScrapingDebugResult>>>({});
  const [feedsLoading, setFeedsLoading] = useState<Partial<Record<VerificationSource, boolean>>>({});
  const [feedsError, setFeedsError] = useState<Partial<Record<VerificationSource, string | null>>>({});

  const fetchFeed = useCallback(async (source: VerificationSource, forceRefresh = false) => {
    setFeedsLoading((s) => ({ ...s, [source]: true }));
    setFeedsError((s) => ({ ...s, [source]: null }));
    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anon = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
      if (!projectUrl) throw new Error('Backend no configurado');
      const target = `${projectUrl}/functions/v1/fetch-skyalert?debug=${source}${forceRefresh ? '&refresh=1' : ''}`;
      const res = await fetch(target, {
        headers: anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ScrapingDebugResult;
      setFeeds((s) => ({ ...s, [source]: json }));
    } catch (e) {
      setFeedsError((s) => ({ ...s, [source]: e instanceof Error ? e.message : 'Error' }));
    } finally {
      setFeedsLoading((s) => ({ ...s, [source]: false }));
    }
  }, []);

  useEffect(() => {
    fetchFeed('skyalert');
    fetchFeed('sassla');
    const id = setInterval(() => {
      fetchFeed('skyalert');
      fetchFeed('sassla');
    }, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchFeed]);

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

      {lastSoundAlert && dismissedSoundAlertId !== lastSoundAlert.id && (
        <div className="p-4 border-2 border-destructive bg-destructive/10 relative" role="alert" aria-live="assertive">
          <div className="flex items-start gap-3 pr-10">
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar aviso"
            className="absolute top-2 right-2 h-8 w-8 text-destructive hover:bg-destructive/20"
            onClick={() => setDismissedSoundAlertId(lastSoundAlert.id)}
          >
            <X className="w-5 h-5" />
          </Button>
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

      <Button
        variant="outline"
        className="w-full h-12 text-base font-semibold border-2"
        onClick={() => {
          fetchFeed('skyalert', true);
          fetchFeed('sassla', true);
        }}
        disabled={!!feedsLoading.skyalert || !!feedsLoading.sassla}
      >
        {(feedsLoading.skyalert || feedsLoading.sassla) ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <RotateCw className="w-5 h-5 mr-2" />
        )}
        Actualizar feeds
      </Button>

      <div className="grid gap-3 md:grid-cols-2">
        {(['skyalert', 'sassla'] as const).map((source) => {
          const name = source === 'skyalert' ? 'SkyAlert' : 'SASSLA';
          const handle = source === 'skyalert' ? 'SkyAlertMx' : 'SasslaMx';
          const feed = feeds[source];
          const isLoading = feedsLoading[source];
          const err = feedsError[source];
          const MAX_AGE_MIN = 7 * 24 * 60; // solo posts de los últimos 7 días
          const allItems = feed?.items ?? [];
          const items = [...allItems]
            .sort((a, b) => {
              const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
              const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
              return tb - ta;
            })
            .filter((it) => {
              if (it.ageMinutes != null) return it.ageMinutes <= MAX_AGE_MIN;
              if (!it.pubDate) return false;
              const t = new Date(it.pubDate).getTime();
              return Number.isFinite(t) && Date.now() - t <= MAX_AGE_MIN * 60 * 1000;
            })
            .slice(0, 6);
          const hasOnlyOld = items.length === 0 && allItems.length > 0;
          return (
            <div key={source} className="rounded-xl border-2 border-border bg-background p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Radio className="w-4 h-4 text-primary shrink-0" />
                  <p className="font-semibold text-sm leading-tight truncate">Últimos posts @{handle}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchFeed(source, true)} disabled={isLoading} aria-label={`Actualizar ${name}`}>
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(`https://x.com/${handle}`, '_blank', 'noopener,noreferrer')} aria-label={`Abrir X ${handle}`}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {err && items.length === 0 && (
                <div className="flex items-start gap-2 border border-warning bg-warning/10 p-2 text-xs rounded">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                  <span>No se pudo consultar {name}. Intenta de nuevo en unos segundos.</span>
                </div>
              )}
              {!err && items.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground py-2">
                  {hasOnlyOld
                    ? `Sin publicaciones de @${handle} en los últimos 7 días.`
                    : 'Sin publicaciones recientes.'}
                </p>
              )}
              {isLoading && items.length === 0 && (
                <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              )}
              {items.length > 0 && (
                <ul className="space-y-2">
                  {items.map((it, i) => (
                    <li key={i} className="p-2 rounded-lg bg-muted/40 border border-border text-sm">
                      <p className="leading-snug break-words">{it.text}</p>
                      {it.pubDate && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {(() => {
                            try {
                              return formatDistanceToNow(new Date(it.pubDate), { addSuffix: true, locale: es });
                            } catch { return it.pubDate; }
                          })()}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
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
    </div>
  );
}
