// Buzón de mensajes recibidos por la Red Mesh (Bluetooth).
// Lista en tiempo real: tipo, origen, coordenadas y hora.

import React from 'react';
import { Inbox, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MeshEnvelope } from '@/types';

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
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Inbox className="w-5 h-5 text-primary" />
          Buzón Mesh ({messages.length})
        </CardTitle>
        {messages.length > 0 && onClear && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Limpiar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no se reciben mensajes por Bluetooth. Los mensajes de otros dispositivos
            cercanos aparecerán aquí en tiempo real.
          </p>
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
                  <a
                    className="inline-flex items-center gap-1 text-xs text-primary mt-1 underline"
                    href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="w-3 h-3" />
                    {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
