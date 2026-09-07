// Buzón persistente de mensajes recibidos por la Red Mesh (Bluetooth).
// Los mensajes se conservan 24 horas aunque el usuario salga de la pantalla
// Red Mesh o cierre la app.

import type { MeshInboxItem } from '@/components/MeshInbox';

const STORAGE_KEY = 'mats-mesh-inbox-v1';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 100;

export const MESH_INBOX_EVENT = 'mats:mesh-inbox-changed';

export function getMeshInbox(): MeshInboxItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MeshInboxItem[];
    const now = Date.now();
    return Array.isArray(parsed)
      ? parsed.filter((m) => m && now - (m.receivedAt || 0) < TTL_MS)
      : [];
  } catch {
    return [];
  }
}

function persist(items: MeshInboxItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(new CustomEvent(MESH_INBOX_EVENT));
}

/** Guarda el mensaje; devuelve false si ya estaba en el buzón. */
export function addMeshInboxItem(item: MeshInboxItem): boolean {
  const items = getMeshInbox();
  if (items.some((m) => m.id === item.id)) {
    persist(items);
    return false;
  }
  persist([item, ...items]);
  return true;
}

export function clearMeshInbox() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(MESH_INBOX_EVENT));
}
