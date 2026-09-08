// Puente por Internet de la Red Mesh.
//
// Objetivo: comunicación resiliente en desastre. El mensaje SIEMPRE sale por
// Bluetooth (BLE). Además, cuando hay internet, se copia al servidor para que
// otras "islas" Bluetooth lejanas lo reciban y lo vuelvan a emitir por BLE en
// su zona. Si no hay internet, la copia queda en una cola local y se envía
// sola en cuanto la conexión regresa (store-and-forward).
//
// Entrega verificada: cada teléfono que recibe un mensaje registra un acuse;
// el emisor ve cuántos teléfonos lo recibieron.

import { supabase } from '@/integrations/supabase/client';
import type { MeshEnvelope } from '@/types';

const QUEUE_KEY = 'mats-mesh-bridge-queue-v1';
const SEEN_KEY = 'mats-mesh-bridge-seen-v1';
const SENT_KEY = 'mats-mesh-bridge-sent-v1';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 100;
const RETRY_MS = 20000;

export const MESH_BRIDGE_EVENT = 'mats:mesh-bridge-changed';

export interface BridgeRow {
  msg_key: string;
  sender_id: string;
  origin: string;
  type: string;
  lat: number | null;
  lng: number | null;
  note: string | null;
  sent_at: string;
}

export interface BridgeSent {
  msgKey: string;
  type: string;
  note?: string;
  queuedAt: number;
  publishedAt?: number;
  deliveries: number;
  error?: string;
}

interface QueueItem extends BridgeSent {
  payload: BridgeRow;
}

// ------------------------------------------------------------ almacenamiento

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* cuota llena */
  }
}

function notify() {
  window.dispatchEvent(new CustomEvent(MESH_BRIDGE_EVENT));
}

function getQueue(): QueueItem[] {
  const now = Date.now();
  return read<QueueItem[]>(QUEUE_KEY, []).filter((i) => now - i.queuedAt < TTL_MS);
}

function setQueue(items: QueueItem[]) {
  write(QUEUE_KEY, items.slice(0, MAX_ITEMS));
  notify();
}

export function getBridgeSent(): BridgeSent[] {
  const now = Date.now();
  return read<BridgeSent[]>(SENT_KEY, [])
    .filter((i) => now - i.queuedAt < TTL_MS)
    .slice(0, MAX_ITEMS);
}

function upsertSent(entry: BridgeSent) {
  const rest = getBridgeSent().filter((i) => i.msgKey !== entry.msgKey);
  write(SENT_KEY, [entry, ...rest].slice(0, MAX_ITEMS));
  notify();
}

function patchSent(msgKey: string, patch: Partial<BridgeSent>) {
  const items = getBridgeSent();
  const found = items.find((i) => i.msgKey === msgKey);
  if (!found) return;
  write(
    SENT_KEY,
    items.map((i) => (i.msgKey === msgKey ? { ...i, ...patch } : i))
  );
  notify();
}

function alreadySeen(msgKey: string): boolean {
  const now = Date.now();
  const seen = read<Record<string, number>>(SEEN_KEY, {});
  const fresh: Record<string, number> = {};
  Object.entries(seen).forEach(([k, at]) => {
    if (now - at < TTL_MS) fresh[k] = at;
  });
  const known = Boolean(fresh[msgKey]);
  fresh[msgKey] = now;
  write(SEEN_KEY, fresh);
  return known;
}

// ------------------------------------------------------------ utilidades

export function bridgeKey(envelope: MeshEnvelope): string {
  return `${envelope.sender_id}:${envelope.timestamp || 0}:${envelope.type}`;
}

export function rowToEnvelope(row: BridgeRow): MeshEnvelope {
  return {
    type: row.type as MeshEnvelope['type'],
    sender_id: row.origin || row.sender_id,
    timestamp: new Date(row.sent_at).getTime(),
    payload: { lat: row.lat, lng: row.lng, message: row.note ?? undefined, viaInternet: true },
  };
}

// ------------------------------------------------------------ publicación

/** Copia el mensaje al servidor (o lo deja en cola si no hay internet). */
export async function publishToBridge(envelope: MeshEnvelope): Promise<void> {
  const payloadObj = (envelope.payload ?? {}) as Record<string, unknown>;
  const note = typeof payloadObj.message === 'string' ? payloadObj.message : undefined;
  const msgKey = bridgeKey(envelope);

  const { data: auth } = await supabase.auth.getUser();
  const senderId = auth?.user?.id;
  if (!senderId) return; // sin sesión no se puede publicar

  const payload: BridgeRow = {
    msg_key: msgKey,
    sender_id: senderId,
    origin: envelope.sender_id,
    type: envelope.type,
    lat: typeof payloadObj.lat === 'number' ? payloadObj.lat : null,
    lng: typeof payloadObj.lng === 'number' ? payloadObj.lng : null,
    note: note ?? null,
    sent_at: new Date(envelope.timestamp || Date.now()).toISOString(),
  };

  const entry: BridgeSent = { msgKey, type: envelope.type, note, queuedAt: Date.now(), deliveries: 0 };
  upsertSent(entry);
  alreadySeen(msgKey); // no reprocesar el eco propio

  const item: QueueItem = { ...entry, payload };
  setQueue([item, ...getQueue().filter((i) => i.msgKey !== msgKey)]);
  await flushBridgeQueue();
}

/** Intenta enviar todo lo pendiente. Seguro de llamar en cualquier momento. */
export async function flushBridgeQueue(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const queue = getQueue();
  if (!queue.length) return;

  const remaining: QueueItem[] = [];
  for (const item of queue) {
    const { error } = await supabase.from('mesh_relay').insert(item.payload);
    // 23505 = ya estaba publicado: cuenta como éxito
    if (!error || error.code === '23505') {
      patchSent(item.msgKey, { publishedAt: Date.now(), error: undefined });
    } else {
      patchSent(item.msgKey, { error: 'Sin conexión: se enviará automáticamente' });
      remaining.push(item);
    }
  }
  setQueue(remaining);
}

export function getBridgeQueueSize(): number {
  return getQueue().length;
}

// ------------------------------------------------------------ recepción

type Handler = (envelope: MeshEnvelope) => void;

let started = false;
let retryTimer: ReturnType<typeof setInterval> | null = null;

async function ackMessage(msgKey: string) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return;
  await supabase.from('mesh_relay_acks').insert({ msg_key: msgKey, user_id: userId, via: 'internet' });
}

async function refreshDeliveries() {
  const mine = getBridgeSent().filter((s) => s.publishedAt);
  if (!mine.length) return;
  const { data } = await supabase
    .from('mesh_relay_acks')
    .select('msg_key')
    .in(
      'msg_key',
      mine.map((m) => m.msgKey)
    );
  if (!data) return;
  const counts = new Map<string, number>();
  data.forEach((r) => counts.set(r.msg_key, (counts.get(r.msg_key) ?? 0) + 1));
  mine.forEach((m) => patchSent(m.msgKey, { deliveries: counts.get(m.msgKey) ?? 0 }));
}

/**
 * Enciende el puente: escucha mensajes de otras zonas, los entrega al buzón,
 * los vuelve a emitir por Bluetooth y acusa recibo.
 */
export function startInternetBridge(options: {
  onMessage: Handler;
  rebroadcast?: (envelope: MeshEnvelope) => void;
  getSelfId?: () => string | undefined;
}): () => void {
  if (started) return () => undefined;
  started = true;

  const handleRow = (row: BridgeRow) => {
    const selfId = options.getSelfId?.();
    if (selfId && row.sender_id === selfId) return;
    if (alreadySeen(row.msg_key)) return;
    const envelope = rowToEnvelope(row);
    options.onMessage(envelope);
    options.rebroadcast?.(envelope); // reinyecta el mensaje en la malla BLE local
    void ackMessage(row.msg_key);
  };

  const loadRecent = async () => {
    const since = new Date(Date.now() - TTL_MS).toISOString();
    const { data } = await supabase
      .from('mesh_relay')
      .select('msg_key,sender_id,origin,type,lat,lng,note,sent_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);
    (data ?? []).reverse().forEach((row) => handleRow(row as BridgeRow));
  };

  void loadRecent();
  void flushBridgeQueue();
  void refreshDeliveries();

  const channel = supabase
    .channel('mesh-relay-bridge')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesh_relay' }, (payload) => {
      handleRow(payload.new as BridgeRow);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesh_relay_acks' }, () => {
      void refreshDeliveries();
    })
    .subscribe();

  const onOnline = () => {
    void flushBridgeQueue();
    void loadRecent();
  };
  window.addEventListener('online', onOnline);
  retryTimer = setInterval(() => {
    void flushBridgeQueue();
    void refreshDeliveries();
  }, RETRY_MS);

  return () => {
    started = false;
    window.removeEventListener('online', onOnline);
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = null;
    supabase.removeChannel(channel);
  };
}
