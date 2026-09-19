// Cola local de mensajes internos enviados sin Internet.
//
// Si el teléfono no tiene Wi-Fi ni red celular, el mensaje se guarda en el
// dispositivo (localStorage, sobrevive al cierre de la app) y se envía solo
// cuando la conexión regresa.

export interface PendingInternalMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  audioUrl: string | null;
  audioDurationMs: number | null;
  imageUrl: string | null;
  queuedAt: number;
  attempts: number;
}

const STORAGE_KEY = 'mats-internal-messages-queue-v1';
const TTL_MS = 72 * 60 * 60 * 1000; // 72 horas
const MAX_ITEMS = 200;

export const INTERNAL_QUEUE_EVENT = 'mats:internal-messages-queue-changed';

function notify() {
  window.dispatchEvent(new CustomEvent(INTERNAL_QUEUE_EVENT));
}

export function getPendingInternalMessages(): PendingInternalMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingInternalMessage[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((i) => i && now - (i.queuedAt || 0) < TTL_MS);
  } catch {
    return [];
  }
}

function persist(items: PendingInternalMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* cuota llena */
  }
  notify();
}

export function queueInternalMessage(
  item: Omit<PendingInternalMessage, 'id' | 'queuedAt' | 'attempts'>
): PendingInternalMessage {
  const entry: PendingInternalMessage = {
    ...item,
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    attempts: 0,
  };
  persist([...getPendingInternalMessages(), entry]);
  return entry;
}

export function removePendingInternalMessage(id: string) {
  persist(getPendingInternalMessages().filter((i) => i.id !== id));
}

function bumpAttempts(id: string) {
  persist(
    getPendingInternalMessages().map((i) =>
      i.id === id ? { ...i, attempts: i.attempts + 1 } : i
    )
  );
}

export function getPendingInternalCount(senderId?: string): number {
  const items = getPendingInternalMessages();
  return senderId ? items.filter((i) => i.senderId === senderId).length : items.length;
}

/**
 * Intenta enviar todo lo pendiente del usuario. `send` debe devolver true
 * cuando el mensaje llegó al servidor. Seguro de llamar en cualquier momento.
 */
export async function flushInternalMessagesQueue(
  senderId: string,
  send: (item: PendingInternalMessage) => Promise<boolean>
): Promise<number> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;

  const items = getPendingInternalMessages().filter((i) => i.senderId === senderId);
  let sent = 0;

  for (const item of items) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
    try {
      const ok = await send(item);
      if (ok) {
        removePendingInternalMessage(item.id);
        sent += 1;
      } else {
        bumpAttempts(item.id);
      }
    } catch {
      bumpAttempts(item.id);
    }
  }

  return sent;
}
