// Comprobantes de envío por Red Mesh.
// Permiten que el usuario vea con certeza en qué punto va su mensaje:
//   en cola  -> guardado, esperando turno de radio
//   emitido  -> ya salió al aire por Bluetooth (n intentos)
//   confirmado -> un teléfono vecino lo acusó (ACK) o lo retransmitió (eco)
//   falló    -> la radio rechazó la emisión (permisos / Bluetooth apagado)

export type MeshSendState = 'queued' | 'emitted' | 'confirmed' | 'failed';

export interface MeshReceipt {
  msgId: number;
  type: string;
  note?: string;
  createdAt: number;
  emittedAt?: number;
  confirmedAt?: number;
  attempts: number;
  neighbours: number;
  state: MeshSendState;
  error?: string;
  via?: 'ack' | 'eco';
}

const STORAGE_KEY = 'mesh_receipts_v1';
const MAX_RECEIPTS = 20;
const TTL_MS = 24 * 60 * 60 * 1000;

let receipts: MeshReceipt[] = load();
const listeners = new Set<(items: MeshReceipt[]) => void>();

function load(): MeshReceipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as MeshReceipt[]) : [];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - TTL_MS;
    return parsed.filter((r) => r.createdAt > cutoff).slice(0, MAX_RECEIPTS);
  } catch {
    return [];
  }
}

function commit() {
  const cutoff = Date.now() - TTL_MS;
  receipts = receipts.filter((r) => r.createdAt > cutoff).slice(0, MAX_RECEIPTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    /* almacenamiento lleno */
  }
  listeners.forEach((cb) => {
    try {
      cb(receipts);
    } catch {
      /* listener roto */
    }
  });
}

/** Registra un mensaje propio recién puesto en la malla. */
export function createMeshReceipt(input: {
  msgId: number;
  type: string;
  note?: string;
  neighbours: number;
}): void {
  receipts = [
    {
      msgId: input.msgId,
      type: input.type,
      note: input.note,
      createdAt: Date.now(),
      attempts: 0,
      neighbours: input.neighbours,
      state: 'queued',
    },
    ...receipts.filter((r) => r.msgId !== input.msgId),
  ];
  commit();
}

function update(msgId: number, patch: (r: MeshReceipt) => MeshReceipt): void {
  const index = receipts.findIndex((r) => r.msgId === msgId);
  if (index === -1) return;
  receipts = receipts.map((r, i) => (i === index ? patch(r) : r));
  commit();
}

/** La trama salió al aire por Bluetooth. */
export function markMeshEmitted(msgId: number, attempts: number): void {
  update(msgId, (r) =>
    r.state === 'confirmed'
      ? { ...r, attempts }
      : { ...r, state: 'emitted', attempts, emittedAt: r.emittedAt ?? Date.now(), error: undefined }
  );
}

/** Un vecino acusó recibo (ACK) o retransmitió nuestro mensaje (eco). */
export function markMeshConfirmed(msgId: number, via: 'ack' | 'eco'): void {
  update(msgId, (r) =>
    r.state === 'confirmed' ? r : { ...r, state: 'confirmed', via, confirmedAt: Date.now(), error: undefined }
  );
}

/** La radio no pudo emitir (permisos, Bluetooth apagado, emisor ausente). */
export function markMeshFailed(msgId: number, error: string): void {
  update(msgId, (r) => (r.state === 'confirmed' ? r : { ...r, state: 'failed', error }));
}

export function getMeshReceipts(): MeshReceipt[] {
  return receipts;
}

export function clearMeshReceipts(): void {
  receipts = [];
  commit();
}

export function subscribeMeshReceipts(cb: (items: MeshReceipt[]) => void): () => void {
  listeners.add(cb);
  cb(receipts);
  return () => listeners.delete(cb);
}
