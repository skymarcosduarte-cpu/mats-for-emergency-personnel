// Pines de mensajes recibidos por la Red Mesh (Bluetooth) para mostrarlos en el mapa.
// Solo se guardan coordenadas + tipo (sin datos personales) y expiran a las 6 horas.

export interface MeshPin {
  id: string;
  type: string;
  lat: number;
  lng: number;
  receivedAt: number;
}

const STORAGE_KEY = 'mats-mesh-pins';
const MAX_PINS = 50;
const TTL_MS = 6 * 60 * 60 * 1000;

export const MESH_PINS_EVENT = 'mats:mesh-pins-changed';
export const MESH_FOCUS_EVENT = 'mats:mesh-pin-focus';

export function getMeshPins(): MeshPin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MeshPin[];
    const now = Date.now();
    return Array.isArray(parsed)
      ? parsed.filter(
          (p) =>
            p &&
            typeof p.lat === 'number' &&
            typeof p.lng === 'number' &&
            now - (p.receivedAt || 0) < TTL_MS,
        )
      : [];
  } catch {
    return [];
  }
}

function persist(pins: MeshPin[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins.slice(0, MAX_PINS)));
  } catch {
    /* ignore quota errors */
  }
  window.dispatchEvent(new CustomEvent(MESH_PINS_EVENT));
}

export function addMeshPin(pin: MeshPin) {
  if (typeof pin.lat !== 'number' || typeof pin.lng !== 'number') return;
  const pins = getMeshPins().filter((p) => p.id !== pin.id);
  persist([pin, ...pins]);
}

export function clearMeshPins() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(MESH_PINS_EVENT));
}

/** Pide al mapa centrarse en un pin (App cambia a la pestaña de mapa). */
export function focusMeshPin(pin: { lat: number; lng: number; type: string; id: string }) {
  window.dispatchEvent(new CustomEvent(MESH_FOCUS_EVENT, { detail: pin }));
}
