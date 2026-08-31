// Pantalla de Información: versión, build y diagnóstico de la Red Mesh.
// Sirve para confirmar en el teléfono que se instaló la compilación correcta.

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import { APP_VERSION, BUILD_NUMBER, BUILD_TIME } from '@/lib/versionCheck';
import { getPlatform, isNative } from '@/lib/capacitor';
import { isMeshAvailable, getMeshStatusMessage } from '@/lib/meshTransport';
import {
  clearMeshDiagnostics,
  meshHandshakeSummary,
  subscribeMeshDiagnostics,
  type MeshDiagEvent,
} from '@/lib/mesh/meshDiagnostics';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-right text-sm font-semibold">{value}</span>
  </div>
);

const AppInfoPage: React.FC = () => {
  const [events, setEvents] = useState<MeshDiagEvent[]>([]);

  useEffect(() => subscribeMeshDiagnostics(setEvents), []);

  const summary = meshHandshakeSummary();

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <Helmet>
        <title>Información de la app | M.A.T.S.</title>
        <meta
          name="description"
          content="Versión instalada, número de build y diagnóstico de la Red Mesh de M.A.T.S."
        />
        <link rel="canonical" href="https://mats-app.com/info" />
      </Helmet>

      <BackToHomeButton onClick={() => { window.location.href = '/'; }} />

      <h1 className="text-2xl font-extrabold">Información de la app</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Versión instalada</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Versión" value={<Badge className="text-sm">v{APP_VERSION}</Badge>} />
          <Row label="Build" value={BUILD_NUMBER} />
          <Row label="Compilado" value={new Date(BUILD_TIME).toLocaleString()} />
          <Row label="Plataforma" value={isNative() ? `Nativa (${getPlatform()})` : 'Web / PWA'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Red Mesh (Bluetooth)</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Disponible" value={isMeshAvailable() ? 'Sí' : 'No'} />
          <Row label="Estado" value={getMeshStatusMessage()} />
          <Row label="Saludos enviados (MESH_HELLO)" value={summary.helloSent} />
          <Row label="Saludos recibidos" value={summary.helloReceived} />
          <Row label="Mensajes al buzón" value={summary.messages} />
          <Row
            label="Handshake"
            value={
              <Badge variant={summary.handshakeOk ? 'default' : 'secondary'}>
                {summary.handshakeOk ? 'OK' : 'Sin confirmar'}
              </Badge>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Registro Mesh</CardTitle>
          {events.length > 0 && (
            <Button size="sm" variant="secondary" onClick={clearMeshDiagnostics}>
              Limpiar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay eventos. Activa la Red Mesh y acerca otro teléfono.
            </p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-auto font-mono text-xs">
              {[...events].reverse().map((e, i) => (
                <li key={`${e.at}-${i}`} className="border-b border-border/60 pb-1">
                  <span className="text-muted-foreground">
                    {new Date(e.at).toLocaleTimeString()}{' '}
                  </span>
                  <span className="font-bold">{e.kind}</span> — {e.detail}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default AppInfoPage;
