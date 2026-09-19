// Panel de repetidores Meshtastic (ESP32 / LoRa) dentro de Red Mesh.
// Permite buscar un repetidor cercano, emparejarlo y ver su estado.

import React, { useEffect, useState } from 'react';
import { RadioTower, Loader2, Link2Off, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { meshtastic, MESHTASTIC_EVENT, type MeshtasticNode, type MeshtasticState } from '@/lib/mesh/meshtastic';
import { isMeshAvailable } from '@/lib/meshTransport';

export const MeshtasticPanel: React.FC = () => {
  const [state, setState] = useState<MeshtasticState>(() => meshtastic.getState());
  const [scanning, setScanning] = useState(false);
  const [nodes, setNodes] = useState<MeshtasticNode[]>([]);
  const native = isMeshAvailable();

  useEffect(() => {
    const refresh = () => setState(meshtastic.getState());
    window.addEventListener(MESHTASTIC_EVENT, refresh);
    return () => window.removeEventListener(MESHTASTIC_EVENT, refresh);
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setNodes([]);
    try {
      const found = await meshtastic.scan();
      setNodes(found);
      if (found.length === 0) {
        toast.info('No se encontró ningún repetidor', {
          description: 'Enciende el repetidor, acércalo y vuelve a buscar.',
        });
      }
    } catch (error) {
      toast.error('No se pudo buscar', { description: (error as Error)?.message });
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (node: MeshtasticNode) => {
    try {
      await meshtastic.enable(true);
      await meshtastic.connect(node);
      setNodes([]);
      toast.success(`Repetidor enlazado: ${node.name}`);
    } catch (error) {
      toast.error('No se pudo enlazar', { description: (error as Error)?.message });
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <RadioTower className="w-5 h-5 text-primary" />
          Repetidores de largo alcance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Si tienes un repetidor Meshtastic (ESP32 con LoRa), la app puede enviarle tus avisos
          para que viajen varios kilómetros sin Wi-Fi ni red telefónica, saltando entre repetidores
          hasta que uno alcance internet.
        </p>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Usar repetidor</p>
            <p className="text-xs text-muted-foreground">
              {!native
                ? 'Disponible solo en la app instalada (APK).'
                : state.connected
                  ? `Enlazado con ${state.node?.name ?? 'repetidor'}`
                  : state.node
                    ? `Guardado: ${state.node.name} · buscando enlace…`
                    : 'Sin repetidor enlazado'}
            </p>
          </div>
          <Switch
            checked={state.enabled}
            disabled={!native}
            onCheckedChange={(v) => void meshtastic.enable(v)}
            aria-label="Usar repetidor Meshtastic"
          />
        </div>

        {native && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning} className="flex-1">
              {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {scanning ? 'Buscando…' : 'Buscar repetidor'}
            </Button>
            {state.node && (
              <Button variant="ghost" size="sm" onClick={() => meshtastic.forget()}>
                <Link2Off className="w-4 h-4 mr-2" />
                Olvidar
              </Button>
            )}
          </div>
        )}

        {nodes.length > 0 && (
          <div className="space-y-2">
            {nodes.map((node) => (
              <button
                key={node.deviceId}
                onClick={() => void handleConnect(node)}
                className="w-full text-left rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                <p className="text-sm font-medium">{node.name}</p>
                <p className="text-xs text-muted-foreground">
                  Señal {node.rssi ?? '—'} dBm · toca para enlazar
                </p>
              </button>
            ))}
          </div>
        )}

        {(state.sent > 0 || state.received > 0) && (
          <p className="text-xs text-muted-foreground">
            Enviados por repetidor: {state.sent} · recibidos: {state.received}
          </p>
        )}

        {state.lastError && <p className="text-xs text-destructive">{state.lastError}</p>}
      </CardContent>
    </Card>
  );
};

export default MeshtasticPanel;
