// Estado del puente por Internet de la Red Mesh: confirma si el mensaje ya
// salió al servidor y cuántos teléfonos lo recibieron.

import React, { useEffect, useState } from 'react';
import { Globe, Clock, CheckCircle2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MESH_BRIDGE_EVENT,
  getBridgeQueueSize,
  getBridgeSent,
  type BridgeSent,
} from '@/lib/mesh/internetBridge';

const TYPE_LABEL: Record<string, string> = {
  PANIC: '🚨 Pánico',
  STATUS_OK: '✅ Estoy bien',
  STATUS_NEED_HELP: '🆘 Necesita ayuda',
  DRILL_TEST: '🧪 Simulacro',
  HELP_14: '🆘 Ayuda (14)',
};

export const MeshBridgeStatus: React.FC = () => {
  const [items, setItems] = useState<BridgeSent[]>(() => getBridgeSent());
  const [pending, setPending] = useState<number>(() => getBridgeQueueSize());

  useEffect(() => {
    const refresh = () => {
      setItems(getBridgeSent());
      setPending(getBridgeQueueSize());
    };
    window.addEventListener(MESH_BRIDGE_EVENT, refresh);
    const timer = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener(MESH_BRIDGE_EVENT, refresh);
      clearInterval(timer);
    };
  }, []);

  if (!items.length) return null;

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold">
          <Globe className="h-5 w-5 text-primary" />
          ENTREGA DE TUS MENSAJES
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tus mensajes salen por Bluetooth y, si hay señal, también viajan por internet hasta otras
          zonas donde vuelven a repetirse por Bluetooth.
          {pending > 0 && ` Hay ${pending} esperando señal.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-2">
        {items.slice(0, 5).map((item) => (
          <div key={item.msgKey} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{TYPE_LABEL[item.type] ?? item.type}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(item.queuedAt).toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {item.note && <p className="mt-1 text-sm">{item.note}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              {item.publishedAt ? (
                <span className="flex items-center gap-1 font-semibold text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Enviado a otras zonas
                </span>
              ) : (
                <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                  <Clock className="h-4 w-4" /> Guardado, esperando señal
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {item.deliveries > 0
                  ? `${item.deliveries} teléfono${item.deliveries === 1 ? '' : 's'} lo recibió`
                  : 'Aún sin confirmación'}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
