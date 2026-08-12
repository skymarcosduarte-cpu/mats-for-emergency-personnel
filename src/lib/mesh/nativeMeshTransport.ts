// Native BLE mesh transport (Capacitor). Everything here is loaded lazily:
// the BLE plugin is only imported when the mesh is actually started on a
// native device, so web/PWA startup cost stays at zero.

import type { MeshEnvelope } from '@/types';
import type { MeshTransport } from '@/lib/meshTransport';
import {
  MESH_MANUFACTURER_ID,
  bytesToHex,
  decodePacket,
  encodePacket,
  envelopeToPacket,
  hashId,
  hexToBytes,
  packetToEnvelope,
  type MeshPacket,
} from './protocol';
import {
  Reassembler,
  decodeAck,
  decodeFrag,
  encodeAck,
  fragment,
  fullBitmap,
  isControlFrame,
  FRAME_ACK,
  FRAME_FRAG,
} from './frames';
import {
  enqueue,
  hydrateSeen,
  markSeen,
  outboxSize,
  removeFromOutbox,
  takeDue,
  type MeshPriority,
  type OutboxItem,
} from './meshStore';

// Optional native advertiser plugin (custom Capacitor plugin, see docs at bottom).
interface MeshAdvertiserPlugin {
  advertise(options: { dataHex: string; durationMs: number }): Promise<void>;
  stop(): Promise<void>;
}

// How long a message keeps travelling in the store-and-forward buffer.
const TTL_BY_PRIORITY: Record<MeshPriority, number> = {
  0: 24 * 60 * 60 * 1000, // SOS: a full day of couriering
  1: 6 * 60 * 60 * 1000,
  2: 60 * 60 * 1000,
};

// Retransmissions stop once this many copies of the same message are heard
// from neighbours — classic gossip suppression, keeps the band usable when
// hundreds of phones are packed together after a quake.
const SUPPRESS_AFTER_COPIES = 3;
const MAX_ATTEMPTS = 12;

// Duty cycles keep the radio (and the UI thread) mostly idle.
const CYCLE_IDLE = { scanMs: 4000, pauseMs: 45000 };
const CYCLE_DISASTER = { scanMs: 8000, pauseMs: 10000 };

export class NativeMeshTransport implements MeshTransport {
  private active = false;
  private disaster = false;
  private starting = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callbacks = new Set<(envelope: MeshEnvelope) => void>();
  private ble: typeof import('@capacitor-community/bluetooth-le').BleClient | null = null;
  private advertiser: MeshAdvertiserPlugin | null = null;
  private peers = new Map<number, number>();
  private reassembler = new Reassembler();
  private copies = new Map<number, number>();
  private pendingCount = 0;
  private selfOrigin = 0;

  constructor() {
    void hydrateSeen();
    void this.refreshPending();
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

  /** Messages still waiting to be handed to another node */
  getPendingCount(): number {
    return this.pendingCount;
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
    void this.broadcastAsync(envelope);
  }

  private async broadcastAsync(envelope: MeshEnvelope) {
    const packet = envelopeToPacket(envelope);
    this.selfOrigin = packet.origin;
    await markSeen(packet.msgId);
    const priority = priorityOf(envelope);

    // Rich payloads (text, notes) travel fragmented; plain coordinate alerts
    // fit in a single 21-byte advertisement.
    const extra = extraPayload(envelope);
    if (extra) {
      const frames = fragment(packet.msgId, packet.origin, new TextEncoder().encode(extra));
      await Promise.all(
        frames.map((frame, index) =>
          this.queueFrame(`${packet.origin}:${packet.msgId}:${index}`, frame, priority)
        )
      );
    }

    await this.queueFrame(`${packet.origin}:${packet.msgId}:p`, encodePacket(packet), priority);
    if (this.active) void this.flushOutbox();
  }

  onMessage(callback: (envelope: MeshEnvelope) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  // --- internals -------------------------------------------------------

  private async queueFrame(key: string, bytes: Uint8Array, priority: MeshPriority) {
    const now = Date.now();
    await enqueue({
      key,
      dataHex: bytesToHex(bytes),
      priority,
      attempts: 0,
      // random jitter avoids every phone advertising on the same millisecond
      nextAt: now + Math.floor(Math.random() * 800),
      createdAt: now,
      expiresAt: now + TTL_BY_PRIORITY[priority],
    });
    await this.refreshPending();
  }

  private async refreshPending() {
    this.pendingCount = await outboxSize();
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
    if (isControlFrame(bytes)) {
      if (bytes[1] === FRAME_ACK) void this.handleAck(bytes);
      if (bytes[1] === FRAME_FRAG) void this.handleFragment(bytes);
      return;
    }
    void this.handlePacket(bytes);
  }

  private async handlePacket(bytes: Uint8Array) {
    const packet = decodePacket(bytes);
    if (!packet) return;
    this.peers.set(packet.origin, Date.now());

    // Count duplicates even when already delivered: that is the suppression signal.
    const copies = (this.copies.get(packet.msgId) ?? 0) + 1;
    this.copies.set(packet.msgId, copies);
    if (copies >= SUPPRESS_AFTER_COPIES) {
      await this.dropRelay(packet.origin, packet.msgId);
    }

    if (await markSeen(packet.msgId)) return;

    const envelope = packetToEnvelope(packet);
    this.emit(envelope);

    // store-and-forward: keep carrying it even if nobody is around right now
    if (packet.ttl > 1 && copies < SUPPRESS_AFTER_COPIES) {
      const relay: MeshPacket = { ...packet, ttl: packet.ttl - 1 };
      await this.queueFrame(
        `${packet.origin}:${packet.msgId}:p`,
        encodePacket(relay),
        priorityOfType(packet.type)
      );
    }
  }

  private async handleFragment(bytes: Uint8Array) {
    const frame = decodeFrag(bytes);
    if (!frame) return;
    this.peers.set(frame.origin, Date.now());
    const { complete, bitmap } = this.reassembler.accept(frame);

    // Acknowledge what we have so the sender can stop retransmitting.
    await this.queueFrame(
      `ack:${frame.origin}:${frame.msgId}`,
      encodeAck({ msgId: frame.msgId, origin: frame.origin, bitmap }),
      1
    );

    if (!complete) return;
    if (await markSeen(frame.msgId ^ 0x5f5f5f5f)) return; // separate namespace for reassembled payloads
    try {
      const parsed = JSON.parse(new TextDecoder().decode(complete)) as Record<string, unknown>;
      this.emit({
        type: (parsed.type as MeshEnvelope['type']) ?? 'STATUS_NEED_HELP',
        sender_id: `mesh:${frame.origin.toString(16)}`,
        timestamp: typeof parsed.ts === 'number' ? parsed.ts : Date.now(),
        payload: parsed,
      });
    } catch {
      /* corrupted reassembly — dropped */
    }
  }

  private async handleAck(bytes: Uint8Array) {
    const ack = decodeAck(bytes);
    if (!ack) return;
    if (this.selfOrigin && ack.origin !== this.selfOrigin) return;
    for (let i = 0; i < 32; i++) {
      if (ack.bitmap & (1 << i)) await removeFromOutbox(`${ack.origin}:${ack.msgId}:${i}`);
    }
    if (ack.bitmap === fullBitmap(32) || ack.bitmap !== 0) await this.refreshPending();
  }

  private async dropRelay(origin: number, msgId: number) {
    if (origin === this.selfOrigin) return; // never drop our own SOS
    await removeFromOutbox(`${origin}:${msgId}:p`);
    await this.refreshPending();
  }

  private emit(envelope: MeshEnvelope) {
    this.callbacks.forEach((cb) => {
      try {
        cb(envelope);
      } catch (error) {
        console.warn('[mesh] callback error:', error);
      }
    });
  }

  private async flushOutbox() {
    if (!this.advertiser) return;
    const batch = await takeDue(this.disaster ? 8 : 4);
    if (batch.length === 0) return;

    for (const item of batch) {
      try {
        await this.advertiser.advertise({
          dataHex: item.dataHex,
          durationMs: this.disaster ? 3000 : 1500,
        });
        await this.onSent(item);
      } catch (error) {
        console.warn('[mesh] advertising falló:', error);
        await this.backoff(item);
        break;
      }
    }
    await this.refreshPending();
  }

  /** Best-effort transport: keep re-announcing with backoff until ACK or TTL. */
  private async onSent(item: OutboxItem) {
    const attempts = item.attempts + 1;
    const isAck = item.key.startsWith('ack:');
    if (isAck || attempts >= MAX_ATTEMPTS) {
      await removeFromOutbox(item.key);
      return;
    }
    await enqueue({ ...item, attempts, nextAt: nextAttemptAt(attempts) });
  }

  private async backoff(item: OutboxItem) {
    const attempts = item.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await removeFromOutbox(item.key);
      return;
    }
    await enqueue({ ...item, attempts, nextAt: nextAttemptAt(attempts) });
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff capped at 60 s, with jitter to avoid radio collisions. */
function nextAttemptAt(attempts: number): number {
  const base = Math.min(60000, 1500 * 2 ** (attempts - 1));
  return Date.now() + base + Math.floor(Math.random() * 800);
}

function priorityOfType(type: MeshEnvelope['type']): MeshPriority {
  if (type === 'PANIC' || type === 'HELP_14') return 0;
  if (type === 'STATUS_NEED_HELP') return 1;
  return 2;
}

function priorityOf(envelope: MeshEnvelope): MeshPriority {
  return priorityOfType(envelope.type);
}

/** Returns the JSON to fragment when the envelope carries more than coordinates. */
function extraPayload(envelope: MeshEnvelope): string | null {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const keys = Object.keys(payload).filter((k) => k !== 'lat' && k !== 'lng');
  if (keys.length === 0) return null;
  const slim: Record<string, unknown> = { type: envelope.type, ts: envelope.timestamp };
  keys.forEach((k) => {
    slim[k] = payload[k];
  });
  const json = JSON.stringify(slim);
  return json.length > 380 ? json.slice(0, 380) : json;
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