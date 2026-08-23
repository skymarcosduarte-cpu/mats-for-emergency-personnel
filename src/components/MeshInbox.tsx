// Buzón de mensajes recibidos por la Red Mesh (Bluetooth).
// Lista en tiempo real: tipo, origen, coordenadas y hora.

import React from 'react';
import { Inbox, MapPin, Radio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MeshEnvelope } from '@/types';
import { focusMeshPin } from '@/lib/meshPins';


export interface MeshInboxItem {
  id: string;
  type: string;
  sender: string;
  lat: number | null;
  lng: number | null;
  note?: string;
  receivedAt: number;
}

const TYPE_LABEL: Record<string, string> = {
  PANIC: '🚨 Pánico',
  STATUS_OK: '✅ Estoy bien',
  STATUS_NEED_HELP: '🆘 Necesita ayuda',
  DRILL_TEST: '🧪 Simulacro',
  DRILL_ACK: '🧪 Confirmación de simulacro',
  HELP_14: '🆘 Ayuda (14)',
  MESH_HELLO: '📡 Presencia',
};

export function envelopeToInboxItem(envelope: MeshEnvelope): MeshInboxItem {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const lat = typeof payload.lat === 'number' ? payload.lat : null;
  const lng = typeof payload.lng === 'number' ? payload.lng : null;
  const note =
    typeof payload.message === 'string'
      ? payload.message
      : typeof payload.note === 'string'
        ? (payload.note as string)
        : undefined;

  return {
    id: `${envelope.sender_id}:${envelope.timestamp}:${envelope.type}`,
    type: envelope.type,
    sender: envelope.sender_id,
    lat,
    lng,
    note,
    receivedAt: envelope.timestamp || Date.now(),
  };
}

interface MeshInboxProps {
  messages: MeshInboxItem[];
  onClear?: () => void;
}

export const MeshInbox: React.FC<MeshInboxProps> = ({ messages, onClear }) => {
  return (
    <Card className="overflow-hidden border-2 border-accent bg-card shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-accent p-4 text-accent-foreground">
        <CardTitle className="flex min-w-0 items-center gap-3 text-lg font-extrabold">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/20">
            <Inbox className="h-6 w-6" />
            {messages.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">
                {messages.length > 99 ? '99+' : messages.length}
              </span>
            )}
          </span>
          <span>BUZÓN DE MENSAJES MESH</span>
        </CardTitle>
        {messages.length > 0 && onClear && (
          <Button variant="secondary" size="sm" onClick={onClear} className="shrink-0">
            Limpiar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 p-4">
        {messages.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-accent bg-accent/5 p-4">
            <Radio className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
            <div>
              <p className="font-semibold text-foreground">Esperando mensajes Bluetooth</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Los mensajes de dispositivos cercanos aparecerán aquí en tiempo real con su tipo, origen, ubicación y hora.
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {messages.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-border p-3 text-sm bg-background"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {TYPE_LABEL[m.type] ?? m.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.receivedAt).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Origen: {m.sender}
                </div>
                {m.note && (
                  <p className="text-xs text-foreground mt-1 break-words">{m.note}</p>
                )}
                {m.lat != null && m.lng != null && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (m.lat == null || m.lng == null) return;
                        focusMeshPin({ id: m.id, type: m.type, lat: m.lat, lng: m.lng });
                      }}
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      Ver en mapa
                    </Button>
                    <a
                      className="inline-flex items-center gap-1 text-xs text-primary underline"
                      href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                    </a>
                  </div>
                )}

              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
