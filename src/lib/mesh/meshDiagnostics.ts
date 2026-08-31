// Registro de diagnóstico de la Red Mesh.
// Guarda en memoria + localStorage los eventos clave del handshake BLE
// (MESH_HELLO enviado / recibido, mensajes entregados al buzón, errores)
// para poder validar de punta a punta en Android e iOS desde la app.

export type MeshDiagKind =
  | 'start'
  | 'stop'
  | 'hello-sent'
  | 'hello-received'
  | 'peer-seen'
  | 'message-received'
  | 'inbox'
  | 'advertise'
  | 'error';

export interface MeshDiagEvent {
  at: number;
  kind: MeshDiagKind;
  detail: string;
}

const STORAGE_KEY = 'mesh_diag_v1';
const MAX_EVENTS = 200;

let events: MeshDiagEvent[] = load();
const listeners = new Set<(events: MeshDiagEvent[]) => void>();

function load(): MeshDiagEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as MeshDiagEvent[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    /* almacenamiento lleno o no disponible */
  }
}

/** Registra un evento de la malla (también lo imprime en consola nativa). */
export function logMesh(kind: MeshDiagKind, detail: string): void {
  const event: MeshDiagEvent = { at: Date.now(), kind, detail };
  events = [...events, event].slice(-MAX_EVENTS);
  persist();
  // Visible en logcat (Android) y en la consola de Safari (iOS)
  console.info(`[mesh:${kind}] ${detail}`);
  listeners.forEach((cb) => {
    try {
      cb(events);
    } catch {
      /* listener roto */
    }
  });
}

export function getMeshDiagnostics(): MeshDiagEvent[] {
  return events;
}

export function clearMeshDiagnostics(): void {
  events = [];
  persist();
  listeners.forEach((cb) => cb(events));
}

export function subscribeMeshDiagnostics(cb: (events: MeshDiagEvent[]) => void): () => void {
  listeners.add(cb);
  cb(events);
  return () => listeners.delete(cb);
}

/** Resumen del handshake: útil para validar la prueba end-to-end. */
export function meshHandshakeSummary() {
  const helloSent = events.filter((e) => e.kind === 'hello-sent').length;
  const helloReceived = events.filter((e) => e.kind === 'hello-received').length;
  const messages = events.filter((e) => e.kind === 'message-received').length;
  const errors = events.filter((e) => e.kind === 'error').length;
  return {
    helloSent,
    helloReceived,
    messages,
    errors,
    handshakeOk: helloSent > 0 && helloReceived > 0,
  };
}
