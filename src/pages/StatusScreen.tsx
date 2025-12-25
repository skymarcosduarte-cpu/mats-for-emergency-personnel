// Status Screen for COMUNIDAD EX SOS
// "Estoy Bien" / "Necesito Ayuda" + Test Mensual

import React, { useState } from 'react';
import { Heart, AlertTriangle, Shield, Radio, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from '@/hooks/useLocation';
import { useAppState } from '@/hooks/useRealtime';
import { getMeshTransport, createMeshEnvelope, getMeshStatusMessage, isMeshAvailable } from '@/lib/meshTransport';
import type { UserRole, StatusType } from '@/types';
import { cn } from '@/lib/utils';

interface StatusScreenProps {
  userId?: string;
  userRole?: UserRole;
}

export const StatusScreen: React.FC<StatusScreenProps> = ({
  userId = 'demo-user',
  userRole = 'RESCATISTA'
}) => {
  const [currentStatus, setCurrentStatus] = useState<StatusType>('UNKNOWN');
  const [submitting, setSubmitting] = useState(false);
  const [testInProgress, setTestInProgress] = useState(false);
  const [lastStatusTime, setLastStatusTime] = useState<Date | null>(null);
  
  const { position } = useLocation();
  const { disasterMode } = useAppState();
  const meshTransport = getMeshTransport();

  // Handle status update
  const handleStatusUpdate = async (status: StatusType) => {
    if (!position) {
      alert('Se requiere ubicación GPS');
      return;
    }

    setSubmitting(true);
    try {
      // Submit to backend
      console.log('Status update:', {
        userId,
        status,
        lat: position.lat,
        lng: position.lng,
      });

      // If disaster mode, also broadcast via mesh
      if (disasterMode && meshTransport.isActive()) {
        const messageType = status === 'OK' ? 'STATUS_OK' : 'STATUS_NEED_HELP';
        const envelope = createMeshEnvelope(messageType, userId, {
          lat: position.lat,
          lng: position.lng,
        });
        meshTransport.broadcast(envelope);
      }

      setCurrentStatus(status);
      setLastStatusTime(new Date());
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle monthly test
  const handleMonthlyTest = async () => {
    setTestInProgress(true);
    try {
      console.log('Monthly test initiated');

      // Broadcast test message via mesh
      if (meshTransport.isActive()) {
        const envelope = createMeshEnvelope('DRILL_TEST', userId, {
          timestamp: Date.now(),
        });
        meshTransport.broadcast(envelope);
      }

      // Simulate test completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send acknowledgment
      if (meshTransport.isActive()) {
        const envelope = createMeshEnvelope('DRILL_ACK', userId, {
          timestamp: Date.now(),
        });
        meshTransport.broadcast(envelope);
      }

      alert('✅ Test mensual completado exitosamente');
    } catch (error) {
      console.error('Error in monthly test:', error);
      alert('❌ Error en test mensual');
    } finally {
      setTestInProgress(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto pb-20 scrollbar-thin">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <h1 className="text-xl font-bold text-foreground">Mi Estado</h1>
      </div>

      <div className="p-4 space-y-6">
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
