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
}

export function useMeshNetwork(options: { disasterMode?: boolean; onMessage?: (e: MeshEnvelope) => void } = {}) {
  const { disasterMode = false, onMessage } = options;
  const [enabled, setEnabled] = useState(() => localStorage.getItem(PREF_KEY) === '1');
  const [active, setActive] = useState(false);
  const [peers, setPeers] = useState(0);
  const [pending, setPending] = useState(0);
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
      unsubscribe = transport.onMessage((envelope) => onMessageRef.current?.(envelope));
      await transport.start();
      if (!cancelled) setActive(transport.isActive());
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [shouldRun, disasterMode]);

  // Peer counter polls slowly to avoid re-renders
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setPeers(transportRef.current?.getPeerCount?.() ?? 0);
      setPending(transportRef.current?.getPendingCount?.() ?? 0);
    }, 15000);
    return () => clearInterval(id);
  }, [active]);

  const toggle = useCallback((value: boolean) => {
    localStorage.setItem(PREF_KEY, value ? '1' : '0');
    setEnabled(value);
  }, []);

  return {
    available: isMeshAvailable(),
    statusMessage: getMeshStatusMessage(),
    enabled,
    active,
    peers,
    pending,
    toggle,
    broadcast: (envelope: MeshEnvelope) => transportRef.current?.broadcast(envelope),
  };
}