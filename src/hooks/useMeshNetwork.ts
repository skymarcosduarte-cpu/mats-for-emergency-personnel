// Lightweight mesh controller: starts the BLE mesh only on native devices and
// only when the user (or disaster mode) enables it. No cost on web.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureNativeMeshTransport, isMeshAvailable, getMeshStatusMessage } from '@/lib/meshTransport';
import type { MeshTransport } from '@/lib/meshTransport';
import type { MeshEnvelope } from '@/types';

const PREF_KEY = 'mesh_enabled_v1';

interface MeshController extends MeshTransport {
  setDisasterMode?: (enabled: boolean) => void;
  getPeerCount?: () => number;
  getPendingCount?: () => number;
  getBackgroundMode?: () => 'foreground-service' | 'ios-background-modes' | 'unavailable';
  getRejectedCount?: () => number;
  getLastError?: () => string | null;
  setIdentity?: (userId: string) => void;
  setDiscovery?: (enabled: boolean) => void;
}

export function useMeshNetwork(
  options: {
    disasterMode?: boolean;
    onMessage?: (e: MeshEnvelope) => void;
    userId?: string;
    discovery?: boolean;
  } = {}
) {
  const { disasterMode = false, onMessage, userId, discovery = false } = options;
  const [enabled, setEnabled] = useState(() => localStorage.getItem(PREF_KEY) === '1');
  const [active, setActive] = useState(false);
  const [peers, setPeers] = useState(0);
  const [pending, setPending] = useState(0);
  const [backgroundMode, setBackgroundMode] = useState<'foreground-service' | 'ios-background-modes' | 'unavailable'>('unavailable');
  const [rejected, setRejected] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const transportRef = useRef<MeshController | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const shouldRun = isMeshAvailable() && (enabled || disasterMode);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    if (!shouldRun) {
      transportRef.current?.stop();
      setActive(false);
      return;
    }

    void (async () => {
      const transport = (await ensureNativeMeshTransport()) as MeshController;
      if (cancelled) return;
      transportRef.current = transport;
      transport.setDisasterMode?.(disasterMode);
      if (userId) transport.setIdentity?.(userId);
      transport.setDiscovery?.(discovery);
      unsubscribe = transport.onMessage((envelope) => onMessageRef.current?.(envelope));
      await transport.start();
      if (!cancelled) setActive(transport.isActive());
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [shouldRun, disasterMode, userId, discovery]);

  // Ciclo rápido de descubrimiento mientras la pantalla de Red Mesh está abierta
  useEffect(() => {
    if (!active) return;
    transportRef.current?.setDiscovery?.(discovery);
    if (!discovery) return;
    const id = setInterval(() => transportRef.current?.setDiscovery?.(true), 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [active, discovery]);

  // Peer counter polls slowly to avoid re-renders
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      setPeers(transportRef.current?.getPeerCount?.() ?? 0);
      setPending(transportRef.current?.getPendingCount?.() ?? 0);
      setBackgroundMode(transportRef.current?.getBackgroundMode?.() ?? 'unavailable');
      setRejected(transportRef.current?.getRejectedCount?.() ?? 0);
      setLastError(transportRef.current?.getLastError?.() ?? null);
    };
    tick();
    const id = setInterval(tick, discovery ? 3000 : 15000);
    return () => clearInterval(id);
  }, [active, discovery]);

  const toggle = useCallback((value: boolean) => {
    localStorage.setItem(PREF_KEY, value ? '1' : '0');
    setEnabled(value);
  }, []);

  // Identidad estable: evita que el puente por internet se reinicie en cada render
  const broadcast = useCallback((envelope: MeshEnvelope, options?: { relay?: boolean }) => {
    transportRef.current?.broadcast(envelope, options);
  }, []);

  return {
    available: isMeshAvailable(),
    statusMessage: getMeshStatusMessage(),
    enabled,
    active,
    peers,
    pending,
    backgroundMode,
    rejected,
    lastError,
    toggle,
    broadcast,
  };
}