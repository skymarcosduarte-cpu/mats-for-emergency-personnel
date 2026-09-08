// Comprobante visible de que un mensaje salió realmente por la Red Mesh.
// Muestra en tiempo real: en cola -> emitido por Bluetooth -> confirmado por
// un teléfono cercano.

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Radio, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  clearMeshReceipts,
  subscribeMeshReceipts,
  type MeshReceipt,
} from '@/lib/mesh/meshReceipts';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<string, string> = {
  STATUS_OK: 'Estoy bien',
  STATUS_NEED_HELP: 'Necesito ayuda',
  PANIC: 'Pánico',
  HELP_14: 'Auxilio 14',
  DRILL_TEST: 'Simulacro',
  DRILL_ACK: 'Simulacro (respuesta)',
};

function stateInfo(r: MeshReceipt) {
  switch (r.state) {
    case 'confirmed':
      return {
        icon: CheckCircle2,
        color: 'text-safe',
        title: 'Confirmado por un teléfono cercano',
        detail:
          r.via === 'ack'
            ? 'Un dispositivo cercano acusó recibo del mensaje completo.'
            : 'Un dispositivo cercano volvió a repetir tu mensaje en la malla.',
      };
    case 'emitted':
      return {
        icon: Radio,
        color: 'text-primary',
        title: 'Enviado por Bluetooth',
        detail: `Tu mensaje ya salió al aire (${r.attempts} emisión(es)). Se repite hasta que otro teléfono lo confirme.`,
      };
    case 'failed':
      return {
        icon: AlertTriangle,
        color: 'text-destructive',
        title: 'No se pudo emitir',
        detail: r.error ?? 'Revisa que el Bluetooth esté encendido y con permisos.',
      };
    default:
      return {
        icon: Clock,
        color: 'text-muted-foreground',
        title: 'Guardado, esperando turno de radio',
        detail:
          r.neighbours > 0
            ? 'Sale en unos segundos hacia los teléfonos cercanos.'
            : 'Se guardará hasta 24 h y saldrá en cuanto haya un teléfono cerca.',
      };
  }
}

export const MeshSendStatus: React.FC = () => {
  const [receipts, setReceipts] = useState<MeshReceipt[]>([]);
  useEffect(() => subscribeMeshReceipts(setReceipts), []);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Radio className="w-5 h-5 text-accent" />
          COMPROBANTE DE ENVÍO MESH
        </CardTitle>
        {receipts.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearMeshReceipts} aria-label="Borrar comprobantes">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aquí verás si tu mensaje ya salió por Bluetooth y si algún teléfono cercano lo confirmó.
          </p>
        ) : (
          receipts.map((r) => {
            const info = stateInfo(r);
            const Icon = info.icon;
            return (
              <div key={r.msgId} className="rounded-lg border border-border p-3">
                <div className="flex items-start gap-3">
                  <Icon className={cn('w-6 h-6 flex-shrink-0', info.color)} />
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-foreground">
                      {TYPE_LABEL[r.type] ?? r.type}
                    </div>
                    <div className={cn('text-sm font-medium', info.color)}>{info.title}</div>
                    <div className="text-sm text-muted-foreground">{info.detail}</div>
                    {r.note && (
                      <div className="text-sm text-foreground mt-1 break-words">“{r.note}”</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(r.createdAt).toLocaleTimeString()}
                      {r.confirmedAt &&
                        ` · confirmado ${new Date(r.confirmedAt).toLocaleTimeString()}`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default MeshSendStatus;
