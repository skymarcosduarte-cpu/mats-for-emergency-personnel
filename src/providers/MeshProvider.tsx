// Red Mesh global: la malla se mantiene activa en toda la app, no sólo dentro
// de la pantalla "Red Mesh". Así los mensajes Bluetooth se reciben siempre,
// se guardan 24 h en el buzón, se dibujan como pines en el mapa y avisan con
// una notificación en cualquier sección.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useMeshNetwork } from '@/hooks/useMeshNetwork';
import { useAppState } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { addMeshPin, focusMeshPin, clearMeshPins } from '@/lib/meshPins';
import { publishToBridge, startInternetBridge } from '@/lib/mesh/internetBridge';
import { addMeshInboxItem, clearMeshInbox, getMeshInbox, MESH_INBOX_EVENT } from '@/lib/meshInboxStore';
import { envelopeToInboxItem, type MeshInboxItem } from '@/components/MeshInbox';
import type { MeshEnvelope } from '@/types';

interface MeshContextValue {
  available: boolean;
  statusMessage: string;
  enabled: boolean;
  active: boolean;
  peers: number;
  pending: number;
  backgroundMode: 'foreground-service' | 'ios-background-modes' | 'unavailable';
  rejected: number;
  lastError: string | null;
  toggle: (value: boolean) => void;
  broadcast: (envelope: MeshEnvelope) => void;
  inbox: MeshInboxItem[];
  clearInbox: () => void;
}

const MeshContext = createContext<MeshContextValue | null>(null);

const RELEVANT: Record<string, { label: string; urgent: boolean }> = {
  PANIC: { label: '🚨 Pánico recibido por Mesh', urgent: true },
  STATUS_NEED_HELP: { label: '🆘 Alguien necesita ayuda (Mesh)', urgent: true },
  HELP_14: { label: '🆘 Ayuda 14 recibida por Mesh', urgent: true },
  STATUS_OK: { label: '✅ Estado "Estoy bien" recibido (Mesh)', urgent: false },
  DRILL_TEST: { label: '🧪 Simulacro recibido por Mesh', urgent: false },
};

export const MeshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { disasterMode } = useAppState();
  const { user } = useAuth();
  const [inbox, setInbox] = useState<MeshInboxItem[]>(() => getMeshInbox());

  useEffect(() => {
    const refresh = () => setInbox(getMeshInbox());
    window.addEventListener(MESH_INBOX_EVENT, refresh);
    return () => window.removeEventListener(MESH_INBOX_EVENT, refresh);
  }, []);

  const handleMeshMessage = useCallback((envelope: MeshEnvelope) => {
    const item = envelopeToInboxItem(envelope);
    if (item.lat != null && item.lng != null) {
      addMeshPin({
        id: item.id,
        type: item.type,
        lat: item.lat,
        lng: item.lng,
        receivedAt: item.receivedAt,
      });
    }

    const isNew = addMeshInboxItem(item);
    const info = RELEVANT[item.type];
    if (!isNew || !info) return;

    const hasCoords = item.lat != null && item.lng != null;
    const options = {
      description: item.note
        ? item.note
        : hasCoords
          ? `Ubicación: ${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}`
          : 'Sin ubicación reportada',
      duration: info.urgent ? 15000 : 6000,
      ...(hasCoords
        ? {
            action: {
              label: 'Ver en mapa',
              onClick: () => {
                if (item.lat == null || item.lng == null) return;
                focusMeshPin({ id: item.id, type: item.type, lat: item.lat, lng: item.lng });
              },
            },
          }
        : {}),
    };

    if (info.urgent) {
      toast.error(info.label, options);
      try {
        navigator.vibrate?.([200, 100, 200, 100, 400]);
      } catch {
        /* ignore */
      }
    } else {
      toast.success(info.label, options);
    }
  }, []);

  const mesh = useMeshNetwork({
    disasterMode,
    userId: user?.id,
    discovery: true,
    onMessage: handleMeshMessage,
  });

  const meshBroadcast = mesh.broadcast;

  // Puente por Internet: recibe mensajes de otras zonas, los muestra y los
  // vuelve a emitir por Bluetooth aquí. Si no hay señal, la cola local espera.
  useEffect(() => {
    if (!user?.id) return;
    const stop = startInternetBridge({
      onMessage: handleMeshMessage,
      rebroadcast: (envelope) => meshBroadcast(envelope),
      getSelfId: () => user.id,
    });
    return stop;
  }, [user?.id, handleMeshMessage, meshBroadcast]);

  // Todo lo que sale por Bluetooth se copia también al puente (si hay señal),
  // y si no la hay queda en cola hasta que la conexión regrese.
  const broadcast = useCallback(
    (envelope: MeshEnvelope) => {
      meshBroadcast(envelope);
      void publishToBridge(envelope);
    },
    [meshBroadcast]
  );

  const clearInbox = useCallback(() => {
    clearMeshInbox();
    clearMeshPins();
    setInbox([]);
  }, []);


  return (
    <MeshContext.Provider value={{ ...mesh, broadcast, inbox, clearInbox }}>
      {children}
    </MeshContext.Provider>
  );
};

export function useMesh(): MeshContextValue {
  const ctx = useContext(MeshContext);
  if (ctx) return ctx;
  return {
    available: false,
    statusMessage: '',
    enabled: false,
    active: false,
    peers: 0,
    pending: 0,
    backgroundMode: 'unavailable',
    rejected: 0,
    lastError: null,
    toggle: () => undefined,
    broadcast: () => undefined,
    inbox: [],
    clearInbox: () => undefined,
  };
}
