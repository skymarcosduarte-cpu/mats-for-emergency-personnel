// Status Screen for COMUNIDAD EX SOS
// "Estoy Bien" / "Necesito Ayuda" + Test Mensual

import React, { useState } from 'react';
import { Heart, AlertTriangle, Shield, Radio, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from '@/hooks/useLocation';
import { useAppState } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getMeshTransport, createMeshEnvelope, getMeshStatusMessage, isMeshAvailable } from '@/lib/meshTransport';
import { useMesh } from '@/providers/MeshProvider';
import { getFreshAuthUserId } from '@/lib/locationSync';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { BackToHomeButton } from '@/components/BackToHomeButton';
import { MeshInbox } from '@/components/MeshInbox';
import { MeshSendStatus } from '@/components/MeshSendStatus';
import { MeshBridgeStatus } from '@/components/MeshBridgeStatus';
import type { UserRole, StatusType, MeshEnvelope } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StatusScreenProps {
  userRole?: UserRole;
  onGoHome?: () => void;
}

export const StatusScreen: React.FC<StatusScreenProps> = ({
  userRole = 'RESCATISTA',
  onGoHome
}) => {
  const [currentStatus, setCurrentStatus] = useState<StatusType>('UNKNOWN');
  const [statusNote, setStatusNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testInProgress, setTestInProgress] = useState(false);
  const [lastStatusTime, setLastStatusTime] = useState<Date | null>(null);

  
  const { position } = useLocation();
  const { disasterMode } = useAppState();
  const { user } = useAuth();
  const meshTransport = getMeshTransport();
  const mesh = useMesh();
  const meshInbox = mesh.inbox;

  // Handle status update
  const handleStatusUpdate = async (status: StatusType) => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión');
      return;
    }

    setSubmitting(true);
    try {
      // Nunca escribimos con el usuario guardado en React si la sesión nativa
      // ya no existe: el backend comprueba la identidad contenida en el token.
      let freshId = await getFreshAuthUserId();
      if (!freshId) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        freshId = refreshed.session?.user?.id ?? null;
        if (!freshId) {
          // Aun sin sesión, el mensaje de emergencia debe salir por la malla
          // (Bluetooth local); solo el servidor queda fuera de alcance.
          const fallbackNote = statusNote.trim().slice(0, 280);
          mesh.broadcast(
            createMeshEnvelope(status === 'OK' ? 'STATUS_OK' : 'STATUS_NEED_HELP', user.id, {
              ...(position ? { lat: position.lat, lng: position.lng } : {}),
              ...(fallbackNote ? { message: fallbackNote } : {}),
            })
          );
          toast.error('Tu sesión venció', {
            description:
              (refreshError?.message ?? 'Vuelve a iniciar sesión para guardar tu estado.') +
              ' El mensaje se envió por Red Mesh (Bluetooth).',
          });
          return;
        }
      }

      const note = statusNote.trim().slice(0, 280);
      const payload = {
        user_id: freshId,
        status: status,
        message: note || null,
        lat: position?.lat ?? null,
        lng: position?.lng ?? null,
      };

      let { error } = await supabase.from('status_messages').insert(payload);

      // Si el token venció justo durante la petición, renovarlo y repetir una
      // sola vez por la misma ruta directa.
      if (error && (error.code === '42501' || /JWT|permission|row-level security/i.test(error.message))) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        const retryId = refreshed.session?.user?.id;
        if (retryId) {
          freshId = retryId;
          const retry = await supabase.from('status_messages').insert({ ...payload, user_id: retryId });
          error = retry.error;
        }
      }

      const messageType = status === 'OK' ? 'STATUS_OK' : 'STATUS_NEED_HELP';

      // El mensaje SIEMPRE se pone en la malla (Bluetooth si está activo y,
      // además, por internet para los usuarios de otras zonas).
      const meshPayload = {
        ...(position ? { lat: position.lat, lng: position.lng } : {}),
        ...(note ? { message: note } : {}),
      };

      if (error) {
        console.error('Error saving status:', error);
        mesh.broadcast(createMeshEnvelope(messageType, freshId, meshPayload));
        toast.warning('Sin conexión al servidor: estado enviado por Red Mesh', {
          description: error.message,
        });
        return;
      }

      console.log('Status saved:', status, position?.lat, position?.lng);
      toast.success(
        status === 'OK'
          ? '✅ Estado "Estoy Bien" enviado a toda la comunidad'
          : '🆘 Alerta de ayuda enviada a toda la comunidad'
      );

      mesh.broadcast(createMeshEnvelope(messageType, freshId, meshPayload));
      toast.info('📡 Mensaje puesto en la Red Mesh', {
        description: mesh.active
          ? 'Abajo puedes ver si ya salió por Bluetooth y si un teléfono cercano lo confirmó.'
          : 'Se entregará a los usuarios de M.A.T.S. por internet y por Bluetooth cuando haya vecinos.',
      });


      setCurrentStatus(status);
      setStatusNote('');
      setLastStatusTime(new Date());

    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar estado');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle monthly test
  const handleMonthlyTest = async () => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión');
      return;
    }

    setTestInProgress(true);
    try {
      console.log('Monthly test initiated');

      // Broadcast test message via mesh
      if (meshTransport.isActive()) {
        const envelope = createMeshEnvelope('DRILL_TEST', user.id, {
          timestamp: Date.now(),
        });
        meshTransport.broadcast(envelope);
      }

      // Simulate test completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send acknowledgment
      if (meshTransport.isActive()) {
        const envelope = createMeshEnvelope('DRILL_ACK', user.id, {
          timestamp: Date.now(),
        });
        meshTransport.broadcast(envelope);
      }

      toast.success('✅ Test mensual completado exitosamente');
    } catch (error) {
      console.error('Error in monthly test:', error);
      toast.error('❌ Error en test mensual');
    } finally {
      setTestInProgress(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto scrollbar-thin pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center gap-3">
        {onGoHome && <BackToHomeButton onClick={onGoHome} />}
        <h1 className="text-xl font-bold text-foreground">Red Mesh</h1>
      </div>

      <div className="space-y-6 p-4">
        {/* Buzón de mensajes Mesh */}
        <section aria-label="Buzón de mensajes Mesh">
          <MeshInbox messages={meshInbox} onClear={mesh.clearInbox} />
        </section>

        {/* Comprobante de envío por la malla */}
        <section aria-label="Comprobante de envío Mesh">
          <MeshSendStatus />
        </section>

        {/* Entrega verificada (puente por internet) */}
        <section aria-label="Entrega de mensajes Mesh">
          <MeshBridgeStatus />
        </section>

        {/* Detector / Buscador de señales Bluetooth cercanas */}
        <section aria-label="Detector de señales">
          <SignalScanner />
        </section>



        {/* Disaster Mode Banner */}
        {disasterMode && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
            <div>
              <div className="font-semibold text-destructive">MODO DESASTRE ACTIVO</div>
              <div className="text-sm text-muted-foreground">
                Algunas funciones están deshabilitadas. Prioriza reportar tu estado.
              </div>
            </div>
          </div>
        )}

        {/* Current Status */}
        {currentStatus !== 'UNKNOWN' && (
          <Card className={cn(
            'border-2',
            currentStatus === 'OK' ? 'border-safe bg-safe/5' : 'border-destructive bg-destructive/5'
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {currentStatus === 'OK' ? (
                  <CheckCircle className="w-8 h-8 text-safe" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                )}
                <div>
                  <div className={cn(
                    'font-bold text-lg',
                    currentStatus === 'OK' ? 'text-safe' : 'text-destructive'
                  )}>
                    {currentStatus === 'OK' ? 'ESTOY BIEN' : 'NECESITO AYUDA'}
                  </div>
                  {lastStatusTime && (
                    <div className="text-xs text-muted-foreground">
                      Actualizado: {lastStatusTime.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensaje opcional */}
        <div className="space-y-2">
          <label htmlFor="status-note" className="text-sm font-medium text-foreground">
            Mensaje (opcional)
          </label>
          <Textarea
            id="status-note"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Ej. Estoy en casa sin daños / Necesito agua y medicamentos"
          />
          <p className="text-xs text-muted-foreground">
            Se envía junto con tu ubicación GPS a toda la comunidad ({statusNote.length}/280).
          </p>
        </div>

        {/* Status Buttons */}
        <div className="grid grid-cols-1 gap-4">

          <button
            onClick={() => handleStatusUpdate('OK')}
            disabled={submitting}
            className={cn(
              'h-32 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all touch-target',
              currentStatus === 'OK' 
                ? 'border-safe bg-safe/10' 
                : 'border-border hover:border-safe hover:bg-safe/5',
              submitting && 'opacity-50'
            )}
          >
            <Heart className={cn(
              'w-12 h-12',
              currentStatus === 'OK' ? 'text-safe' : 'text-muted-foreground'
            )} />
            <span className={cn(
              'text-xl font-bold',
              currentStatus === 'OK' ? 'text-safe' : 'text-foreground'
            )}>
              ESTOY BIEN
            </span>
          </button>

          <button
            onClick={() => handleStatusUpdate('NEED_HELP')}
            disabled={submitting}
            className={cn(
              'h-32 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all touch-target',
              currentStatus === 'NEED_HELP' 
                ? 'border-destructive bg-destructive/10' 
                : 'border-border hover:border-destructive hover:bg-destructive/5',
              submitting && 'opacity-50'
            )}
          >
            <AlertTriangle className={cn(
              'w-12 h-12',
              currentStatus === 'NEED_HELP' ? 'text-destructive' : 'text-muted-foreground'
            )} />
            <span className={cn(
              'text-xl font-bold',
              currentStatus === 'NEED_HELP' ? 'text-destructive' : 'text-foreground'
            )}>
              NECESITO AYUDA
            </span>
          </button>
        </div>

        {/* Monthly Test Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="w-5 h-5 text-accent" />
              Test Mensual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ejecuta el test mensual para verificar que las comunicaciones funcionan 
              correctamente y descargar las claves de cifrado del mesh.
            </p>

            <Button
              onClick={handleMonthlyTest}
              disabled={testInProgress}
              className="w-full"
              variant="outline"
            >
              {testInProgress ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Ejecutando test...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  TEST MENSUAL
                </>
              )}
            </Button>

            {/* Mesh Status */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className={cn(
                'w-2 h-2 rounded-full',
                isMeshAvailable() ? 'bg-safe' : 'bg-muted-foreground'
              )} />
              <span>{getMeshStatusMessage()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Red Malla (BLE) */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="w-5 h-5 text-accent" />
              Red Malla Bluetooth
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Retransmite alertas entre teléfonos cercanos cuando no hay internet ni señal celular.
              Funciona con muy bajo consumo: la radio se enciende por segundos y descansa.
              Cada mensaje va firmado, así solo se aceptan alertas de la red MATS.
            </p>

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">Activar malla</div>
                <div className="text-xs text-muted-foreground">
                  {mesh.active
                    ? `Activa · ${mesh.peers} dispositivo(s) cercano(s)`
                    : mesh.available
                      ? 'En espera'
                      : 'Requiere la app nativa'}
                </div>
              </div>
              <Switch
                checked={mesh.enabled}
                onCheckedChange={mesh.toggle}
                disabled={!mesh.available}
                aria-label="Activar red malla Bluetooth"
              />
            </div>

            {mesh.active && (
              <div className="text-xs text-muted-foreground">
                {mesh.pending > 0
                  ? `${mesh.pending} mensaje(s) guardado(s) esperando a otro dispositivo. Se entregarán aunque cierres la app.`
                  : 'Sin mensajes pendientes por entregar.'}
              </div>
            )}

            {mesh.active && (
              <div className="text-xs text-muted-foreground">
                {mesh.backgroundMode === 'foreground-service'
                  ? 'Segundo plano activo: sigue escuchando con la pantalla apagada.'
                  : mesh.backgroundMode === 'ios-background-modes'
                    ? 'Segundo plano iOS: escucha reducida con la app cerrada; en primer plano es más rápida.'
                    : 'Segundo plano no disponible en esta plataforma: mantén la app abierta.'}
                {mesh.rejected > 0 && ` · ${mesh.rejected} mensaje(s) descartado(s) por firma inválida.`}
              </div>
            )}

            {mesh.lastError && (
              <div className="text-xs text-destructive">
                {mesh.lastError}
              </div>
            )}

            {mesh.active && mesh.peers === 0 && !mesh.lastError && (
              <div className="text-xs text-muted-foreground">
                Buscando dispositivos cercanos… mantén esta pantalla abierta en ambos teléfonos,
                con Bluetooth y ubicación encendidos y a menos de 30 m.
              </div>
            )}

            {disasterMode && (
              <div className="text-xs text-destructive">
                Modo desastre: la malla se mantiene activa automáticamente.
              </div>
            )}
          </CardContent>
        </Card>


        {/* Role Badge */}
        <div className="text-center">
          <span className={cn(
            'px-4 py-2 rounded-full text-sm font-medium',
            userRole === 'RESCATISTA' 
              ? 'bg-mats-green/20 text-mats-green border border-mats-green/30' 
              : 'bg-muted text-muted-foreground border border-border'
          )}>
            {userRole === 'RESCATISTA' ? '🏥 RESCATISTA' : '👨‍👩‍👧 FAMILIAR'}
          </span>
          
          {userRole === 'FAMILIAR' && (
            <p className="text-xs text-muted-foreground mt-2">
              FAMILIAR – NO PARAMÉDICO / NO EX PARAMÉDICO
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusScreen;
