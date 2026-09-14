// Detector / Buscador de señales: barrido de dispositivos Bluetooth cercanos
// para apoyo en zonas de derrumbe. Pensado para rescatistas.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Radar,
  Loader2,
  Play,
  Square,
  MapPin,
  Trash2,
  Smartphone,
  Info,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { SignalSectorMap } from '@/components/SignalSectorMap';
import type { SectorSnapshot } from '@/lib/mesh/signalSectors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocation } from '@/hooks/useLocation';
import { addMeshPin, focusMeshPin } from '@/lib/meshPins';
import {
  signalScanner,
  classifySignal,
  SIGNAL_LABELS,
  type DetectedSignal,
} from '@/lib/mesh/signalScanner';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STRENGTH_STYLES: Record<string, string> = {
  inmediato: 'bg-destructive text-destructive-foreground',
  'muy-cerca': 'bg-primary text-primary-foreground',
  cerca: 'bg-secondary text-secondary-foreground',
  lejano: 'bg-muted text-muted-foreground',
};

function signalBars(rssi: number): number {
  if (rssi >= -55) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -85) return 2;
  return 1;
}

export const SignalScanner: React.FC = () => {
  const [signals, setSignals] = useState<DetectedSignal[]>([]);
  const [scanning, setScanning] = useState(signalScanner.isScanning());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(signalScanner.getLastError());
  const [sectors, setSectors] = useState<SectorSnapshot>(signalScanner.getSectors());
  const { position } = useLocation();

  useEffect(() => {
    const unsubscribe = signalScanner.subscribe((next) => {
      setSignals(next);
      setSectors(signalScanner.getSectors());
      setScanning(signalScanner.isScanning());
      setError(signalScanner.getLastError());
    });
    return unsubscribe;
  }, []);

  // Alimenta la posición GPS para que cada lectura caiga en su sector
  useEffect(() => {
    signalScanner.setPosition(position ? { lat: position.lat, lng: position.lng } : null);
  }, [position]);

  const strongest = useMemo(() => signals[0] ?? null, [signals]);
  const sustainedCount = useMemo(() => signals.filter((s) => s.sustained).length, [signals]);

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (scanning) {
        await signalScanner.stop();
        toast.info('Búsqueda detenida');
      } else {
        const ok = await signalScanner.start();
        if (ok) toast.success('Buscando señales cercanas…');
      }
    } finally {
      setBusy(false);
      setScanning(signalScanner.isScanning());
      setError(signalScanner.getLastError());
    }
  };

  const handleMark = (signal: DetectedSignal) => {
    if (!position) {
      toast.error('Sin ubicación: activa el GPS para marcar el hallazgo en el mapa');
      return;
    }
    const pin = {
      id: `signal-${signal.id}-${Date.now()}`,
      type: `SEÑAL ${Math.round(signal.distanceM)} m`,
      lat: position.lat,
      lng: position.lng,
      receivedAt: Date.now(),
    };
    addMeshPin(pin);
    focusMeshPin(pin);
    toast.success('Hallazgo marcado en el mapa');
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Radar className={cn('w-5 h-5 text-primary', scanning && 'animate-pulse')} />
          DETECTOR DE SEÑALES
          {scanning && <Badge className="ml-auto bg-primary text-primary-foreground">ACTIVO</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Busca teléfonos, relojes y audífonos Bluetooth encendidos alrededor. Sirve para
          barrer una zona de derrumbe: acércate y aléjate observando qué señal se hace más fuerte.
        </p>

        <Button
          onClick={handleToggle}
          disabled={busy}
          size="lg"
          className={cn(
            'w-full h-14 text-base font-bold',
            scanning ? 'bg-destructive hover:bg-destructive/90' : '',
          )}
        >
          {busy ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : scanning ? (
            <Square className="w-5 h-5 mr-2" />
          ) : (
            <Play className="w-5 h-5 mr-2" />
          )}
          {scanning ? 'DETENER BÚSQUEDA' : 'INICIAR BÚSQUEDA'}
        </Button>

        {error && (
          <div className="flex gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {scanning && strongest && (
          <div className="p-4 rounded-lg border-2 border-primary/40 bg-primary/5">
            <p className="text-xs font-semibold text-muted-foreground mb-1">SEÑAL MÁS FUERTE</p>
            <p className="text-2xl font-black text-foreground">
              ≈ {strongest.distanceM} m
            </p>
            <p className="text-sm text-muted-foreground">
              {SIGNAL_LABELS[classifySignal(strongest.rssi)]}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {scanning ? 'Escuchando… no hay señales todavía.' : 'Sin búsqueda activa.'}
            </p>
          ) : (
            signals.map((signal) => {
              const strength = classifySignal(signal.rssi);
              const bars = signalBars(signal.rssi);
              return (
                <div
                  key={signal.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background"
                >
                  <div className="flex items-end gap-0.5 h-6">
                    {[1, 2, 3, 4].map((level) => (
                      <span
                        key={level}
                        className={cn(
                          'w-1.5 rounded-sm',
                          level <= bars ? 'bg-primary' : 'bg-muted',
                        )}
                        style={{ height: `${level * 25}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {signal.name || 'Dispositivo sin nombre'}
                      {signal.isMats && (
                        <Badge className="ml-2 bg-primary text-primary-foreground">M.A.T.S.</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ≈ {signal.distanceM} m · {signal.rssi} dBm · {signal.hits} lecturas
                    </p>
                    <p className="text-xs text-muted-foreground">{SIGNAL_LABELS[strength]}</p>
                  </div>
                  <Badge className={cn('shrink-0', STRENGTH_STYLES[strength])}>
                    {strength === 'inmediato' ? '¡AQUÍ!' : `${Math.round(signal.distanceM)} m`}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMark(signal)}
                    className="shrink-0"
                  >
                    <MapPin className="w-4 h-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {signals.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => signalScanner.clear()} className="w-full">
            <Trash2 className="w-4 h-4 mr-2" /> Limpiar lista
          </Button>
        )}

        <div className="flex gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            La distancia es una estimación: el concreto y el metal debilitan la señal.
            Úsala como guía de "más caliente / más frío", no como medida exacta.
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
