// Native BLE mesh transport (Capacitor). Everything here is loaded lazily:
// the BLE plugin is only imported when the mesh is actually started on a
// native device, so web/PWA startup cost stays at zero.

import type { MeshEnvelope } from '@/types';
import type { MeshTransport } from '@/lib/meshTransport';
import {
  MESH_MANUFACTURER_ID,
  SeenCache,
  bytesToHex,
  decodePacket,
  encodePacket,
  envelopeToPacket,
  packetToEnvelope,
  type MeshPacket,
} from './protocol';

// Optional native advertiser plugin (custom Capacitor plugin, see docs at bottom).
interface MeshAdvertiserPlugin {
  advertise(options: { dataHex: string; durationMs: number }): Promise<void>;
  stop(): Promise<void>;
}

const QUEUE_KEY = 'mesh_outbox_v1';
const MAX_QUEUE = 40;

// Duty cycles keep the radio (and the UI thread) mostly idle.
const CYCLE_IDLE = { scanMs: 4000, pauseMs: 45000 };
const CYCLE_DISASTER = { scanMs: 8000, pauseMs: 10000 };

export class NativeMeshTransport implements MeshTransport {
  private active = false;
  private disaster = false;
  private starting = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callbacks = new Set<(envelope: MeshEnvelope) => void>();
  private seen = new SeenCache();
  private outbox: MeshPacket[] = [];
  private ble: typeof import('@capacitor-community/bluetooth-le').BleClient | null = null;
  private advertiser: MeshAdvertiserPlugin | null = null;
  private peers = new Map<number, number>();

  constructor() {
    this.outbox = loadQueue();
  }

  isAvailable(): boolean {
    return true;
  }

  isActive(): boolean {
    return this.active;
  }

  setDisasterMode(enabled: boolean): void {
    this.disaster = enabled;
  }

  /** Number of distinct mesh peers heard in the last 5 minutes */
  getPeerCount(): number {
    const cutoff = Date.now() - 5 * 60 * 1000;
    let count = 0;
    this.peers.forEach((at) => {
      if (at > cutoff) count++;
    });
    return count;
  }

  async start(): Promise<void> {
    if (this.active || this.starting) return;
    this.starting = true;
    try {
      const [{ BleClient }, { Capacitor, registerPlugin }] = await Promise.all([
        import('@capacitor-community/bluetooth-le'),
        import('@capacitor/core'),
      ]);
      this.ble = BleClient;
      await BleClient.initialize({ androidNeverForLocation: true });

      if (Capacitor.isPluginAvailable('MeshAdvertiser')) {
        this.advertiser = registerPlugin<MeshAdvertiserPlugin>('MeshAdvertiser');
      }

      this.active = true;
      this.scheduleCycle(0);
    } catch (error) {
      console.warn('[mesh] no se pudo iniciar BLE:', error);
      this.active = false;
    } finally {
      this.starting = false;
    }
  }

  stop(): void {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.ble?.stopLEScan().catch(() => undefined);
    this.advertiser?.stop().catch(() => undefined);
  }

  broadcast(envelope: MeshEnvelope): void {
    const packet = envelopeToPacket(envelope);
    this.seen.add(packet.msgId);
    this.enqueue(packet);
    if (this.active) void this.flushOutbox();
  }

  onMessage(callback: (envelope: MeshEnvelope) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  // --- internals -------------------------------------------------------

  private enqueue(packet: MeshPacket) {
    this.outbox.push(packet);
    if (this.outbox.length > MAX_QUEUE) this.outbox.splice(0, this.outbox.length - MAX_QUEUE);
    saveQueue(this.outbox);
  }

  private scheduleCycle(delay: number) {
    if (!this.active) return;
    this.timer = setTimeout(() => void this.runCycle(), delay);
  }

  private async runCycle() {
    if (!this.active || !this.ble) return;
    const cycle = this.disaster ? CYCLE_DISASTER : CYCLE_IDLE;

    try {
      await this.flushOutbox();
      await this.ble.requestLEScan({ allowDuplicates: true }, (result) => {
        const data = result.manufacturerData?.[String(MESH_MANUFACTURER_ID)];
        if (!data) return;
        this.handleIncoming(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      });
      await wait(cycle.scanMs);
      await this.ble.stopLEScan();
    } catch (error) {
      console.warn('[mesh] ciclo de escaneo falló:', error);
    }

    this.scheduleCycle(cycle.pauseMs);
  }

  private handleIncoming(bytes: Uint8Array) {
    const packet = decodePacket(bytes);
    if (!packet) return;
    if (this.seen.has(packet.msgId)) return;
    this.seen.add(packet.msgId);
    this.peers.set(packet.origin, Date.now());

    const envelope = packetToEnvelope(packet);
    this.callbacks.forEach((cb) => {
      try {
        cb(envelope);
      } catch (error) {
        console.warn('[mesh] callback error:', error);
      }
    });

    // store-and-forward
    if (packet.ttl > 1) {
      this.enqueue({ ...packet, ttl: packet.ttl - 1 });
    }
  }

  private async flushOutbox() {
    if (!this.advertiser || this.outbox.length === 0) return;
    const batch = this.outbox.splice(0, 5);
    saveQueue(this.outbox);
    for (const packet of batch) {
      try {
        await this.advertiser.advertise({
          dataHex: bytesToHex(encodePacket(packet)),
          durationMs: this.disaster ? 3000 : 1500,
        });
      } catch (error) {
        console.warn('[mesh] advertising falló:', error);
        this.enqueue(packet);
        break;
      }
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadQueue(): MeshPacket[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as MeshPacket[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: MeshPacket[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* storage full — the mesh keeps working in memory */
  }
}

/*
 * TRANSMISIÓN (advertising):
 * @capacitor-community/bluetooth-le sólo funciona como CENTRAL (escaneo).
 * Para emitir se requiere un plugin nativo llamado "MeshAdvertiser" que
 * exponga advertise({ dataHex, durationMs }) y stop():
 *   - Android: BluetoothLeAdvertiser + AdvertiseData.addManufacturerData(0xFFFF, bytes)
 *   - iOS: CBPeripheralManager.startAdvertising (limitado en background)
 * Sin ese plugin la malla funciona en modo RECEPCIÓN y encola lo que se
 * quiera emitir hasta que el plugin esté disponible.
 */