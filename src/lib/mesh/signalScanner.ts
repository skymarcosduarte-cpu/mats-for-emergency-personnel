// Detector / Buscador de señales RF (BLE) para labores de rescate.
// Escanea TODOS los anuncios Bluetooth Low Energy cercanos (no sólo la malla
// M.A.T.S.) y estima la cercanía por intensidad de señal (RSSI), de modo que un
// rescatista pueda barrer una zona de derrumbe buscando teléfonos, relojes o
// audífonos de personas atrapadas.
//
// Limitaciones reales (importantes para no dar falsas expectativas):
// - Sólo detecta dispositivos que estén emitiendo BLE (encendidos y con BT on).
// - No atraviesa metal ni grandes masas de concreto: el alcance baja mucho.
// - iOS restringe el escaneo en segundo plano; funciona con la app abierta.

import { MESH_MANUFACTURER_ID } from './protocol';
import { SectorGrid, type SectorSnapshot } from './signalSectors';

/** Un indicio se considera "sostenido" (probable persona bajo escombros) cuando
 *  se oye repetidamente durante al menos este tiempo. Descarta transeúntes. */
export const SUSTAINED_MS = 25 * 1000;
export const SUSTAINED_HITS = 6;

export interface DetectedSignal {
  /** Identificador del dispositivo (aleatorio/rotativo en la mayoría de equipos) */
  id: string;
  /** Nombre anunciado, si lo hay */
  name: string | null;
  /** Intensidad actual en dBm (más cerca de 0 = más cerca) */
  rssi: number;
  /** Mejor intensidad vista, útil para recordar el punto más caliente */
  bestRssi: number;
  /** Distancia aproximada en metros (estimación gruesa) */
  distanceM: number;
  /** true si el anuncio corresponde a la malla M.A.T.S. */
  isMats: boolean;
  firstSeen: number;
  lastSeen: number;
  /** Número de anuncios oídos: más muestras = detección más confiable */
  hits: number;
  /** Presencia sostenida en el tiempo: indicio fuerte, no un transeúnte */
  sustained: boolean;
}

export type SignalStrength = 'inmediato' | 'muy-cerca' | 'cerca' | 'lejano';

export function classifySignal(rssi: number): SignalStrength {
  if (rssi >= -55) return 'inmediato';
  if (rssi >= -70) return 'muy-cerca';
  if (rssi >= -85) return 'cerca';
  return 'lejano';
}

export const SIGNAL_LABELS: Record<SignalStrength, string> = {
  inmediato: 'A tu lado (menos de 2 m)',
  'muy-cerca': 'Muy cerca (2 a 8 m)',
  cerca: 'Cerca (8 a 25 m)',
  lejano: 'Lejano o con obstáculos',
};

/** Estimación log-distance simple: referencia -59 dBm a 1 m, exponente 2.5 */
export function estimateDistance(rssi: number): number {
  const ref = -59;
  const exponent = 2.5;
  const meters = Math.pow(10, (ref - rssi) / (10 * exponent));
  return Math.max(0.5, Math.round(meters * 10) / 10);
}

/** Descarta lecturas viejas: un dispositivo que dejó de oírse ya no está */
const FORGET_MS = 30 * 1000;

type Listener = (signals: DetectedSignal[]) => void;

interface ScanResultLike {
  device: { deviceId: string; name?: string | null };
  localName?: string | null;
  rssi?: number | null;
  manufacturerData?: Record<string, DataView> | null;
}

class SignalScanner {
  private ble: typeof import('@capacitor-community/bluetooth-le').BleClient | null = null;
  private scanning = false;
  private starting = false;
  private signals = new Map<string, DetectedSignal>();
  private listeners = new Set<Listener>();
  private sweep: ReturnType<typeof setInterval> | null = null;
  private lastError: string | null = null;

  isNative(): boolean {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  }

  isScanning(): boolean {
    return this.scanning;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSignals());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSignals(): DetectedSignal[] {
    const cutoff = Date.now() - FORGET_MS;
    return Array.from(this.signals.values())
      .filter((s) => s.lastSeen >= cutoff)
      .sort((a, b) => b.rssi - a.rssi);
  }

  clear(): void {
    this.signals.clear();
    this.emit();
  }

  async start(): Promise<boolean> {
    if (this.scanning || this.starting) return this.scanning;
    if (!this.isNative()) {
      this.lastError =
        'El buscador de señales sólo funciona en la app instalada (Android/iPhone), no en el navegador.';
      this.emit();
      return false;
    }
    this.starting = true;
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      this.ble = BleClient;
      await BleClient.initialize({ androidNeverForLocation: false });

      try {
        const enabled = await BleClient.isEnabled();
        if (!enabled) {
          this.lastError = 'Enciende el Bluetooth para poder buscar señales cercanas.';
          this.starting = false;
          this.emit();
          return false;
        }
      } catch {
        /* isEnabled no disponible en algunas plataformas */
      }

      await BleClient.requestLEScan({ allowDuplicates: true }, (result) =>
        this.handleResult(result as unknown as ScanResultLike),
      );

      this.scanning = true;
      this.lastError = null;
      this.sweep = setInterval(() => this.emit(), 1500);
      this.emit();
      return true;
    } catch (error) {
      this.lastError =
        error instanceof Error
          ? `No se pudo iniciar la búsqueda: ${error.message}`
          : 'No se pudo iniciar la búsqueda (revisa permisos de Bluetooth y ubicación).';
      this.scanning = false;
      this.emit();
      return false;
    } finally {
      this.starting = false;
    }
  }

  async stop(): Promise<void> {
    if (this.sweep) {
      clearInterval(this.sweep);
      this.sweep = null;
    }
    this.scanning = false;
    try {
      await this.ble?.stopLEScan();
    } catch {
      /* ya estaba detenido */
    }
    this.emit();
  }

  private handleResult(result: ScanResultLike) {
    const id = result.device?.deviceId;
    if (!id) return;
    const rssi = typeof result.rssi === 'number' ? result.rssi : -100;
    const name = result.localName || result.device?.name || null;
    const isMats = Boolean(result.manufacturerData?.[String(MESH_MANUFACTURER_ID)]);
    const now = Date.now();
    const prev = this.signals.get(id);

    this.signals.set(id, {
      id,
      name,
      rssi,
      bestRssi: prev ? Math.max(prev.bestRssi, rssi) : rssi,
      distanceM: estimateDistance(rssi),
      isMats: isMats || Boolean(prev?.isMats),
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
      hits: (prev?.hits ?? 0) + 1,
    });
  }

  private emit() {
    const snapshot = this.getSignals();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const signalScanner = new SignalScanner();
