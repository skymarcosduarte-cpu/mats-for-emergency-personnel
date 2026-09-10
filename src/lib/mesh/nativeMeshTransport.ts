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
import { signFrame, verifyFrame } from './auth';
import { getBackgroundMode, startBackground, stopBackground } from './background';
import { logMesh } from './meshDiagnostics';
import {
  createMeshReceipt,
  markMeshConfirmed,
  markMeshEmitted,
  markMeshFailed,
} from './meshReceipts';

// Optional native advertiser plugin (custom Capacitor plugin, see docs at bottom).
interface MeshAdvertiserPlugin {
  advertise(options: { dataHex: string; durationMs: number }): Promise<void>;
  stop(): Promise<void>;
}

// How long a message keeps travelling in the store-and-forward buffer.
const TTL_BY_PRIORITY: Record<MeshPriority, number> = {
  0: 24 * 60 * 60 * 1000, // SOS / auxilio: un día completo de acarreo
  1: 12 * 60 * 60 * 1000, // pánico
  2: 6 * 60 * 60 * 1000, // necesito ayuda
  3: 24 * 60 * 60 * 1000, // ubicación / estado: se conserva 24 h
};

// Jitter por prioridad: un SOS sale casi de inmediato, la ubicación espera más
// para no competir con el tráfico crítico.
const JITTER_BY_PRIORITY: Record<MeshPriority, number> = {
  0: 250,
  1: 600,
  2: 1500,
  3: 4000,
};

// Límite de retransmisiones que aceptamos originadas por un mismo vecino dentro
// de la ventana: evita que un nodo (o un atacante con la clave) sature la banda.
const NEIGHBOUR_WINDOW_MS = 5 * 60 * 1000;
const NEIGHBOUR_RELAY_LIMIT = { idle: 12, disaster: 30 };

// Retransmissions stop once this many copies of the same message are heard
// from neighbours — classic gossip suppression, keeps the band usable when
// hundreds of phones are packed together after a quake.
const SUPPRESS_AFTER_COPIES = 3;
const MAX_ATTEMPTS = 12;

// Duty cycles keep the radio (and the UI thread) mostly idle.
const CYCLE_IDLE = { scanMs: 6000, pauseMs: 12000 };
const CYCLE_DISASTER = { scanMs: 8000, pauseMs: 10000 };
// Modo descubrimiento: ciclo casi continuo para que dos teléfonos se vean en
// segundos mientras el usuario tiene la pantalla de Red Mesh abierta.
const CYCLE_DISCOVERY = { scanMs: 6000, pauseMs: 1500 };
const DISCOVERY_WINDOW_MS = 30 * 60 * 1000;

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
  private relaysByNeighbour = new Map<number, { count: number; windowStart: number }>();
  private rejected = 0;
  private pendingCount = 0;
  private selfOrigin = 0;
  private identity = 0;
  private discoveryUntil = 0;
  private lastError: string | null = null;

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
    const changed = this.disaster !== enabled;
    this.disaster = enabled;
    if (changed && this.active) void startBackground(enabled);
  }

  /** 'foreground-service' (Android), 'ios-background-modes' o 'unavailable' */
  getBackgroundMode() {
    return getBackgroundMode();
  }

  /** Último error de radio/permisos, para mostrarlo en la interfaz */
  getLastError(): string | null {
    return this.lastError;
  }

  /** Identidad local: permite anunciar presencia aunque no se envíe alerta */
  setIdentity(userId: string): void {
    if (!userId) return;
    this.identity = hashId(userId);
    if (!this.selfOrigin) this.selfOrigin = this.identity;
  }

  /** Activa el ciclo rápido de descubrimiento entre dispositivos cercanos */
  setDiscovery(enabled: boolean): void {
    this.discoveryUntil = enabled ? Date.now() + DISCOVERY_WINDOW_MS : 0;
    if (enabled && this.active) {
      if (this.timer) clearTimeout(this.timer);
      this.scheduleCycle(0);
    }
  }

  /** Tramas descartadas por firma inválida (diagnóstico) */
  getRejectedCount(): number {
    return this.rejected;
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
        this.lastError = null;
      } else {
        this.lastError =
          'Este dispositivo solo puede recibir: la app instalada no incluye el emisor Bluetooth (MeshAdvertiser).';
      }

      try {
        const enabled = await BleClient.isEnabled();
        if (!enabled) {
          this.lastError = 'Bluetooth apagado: enciéndelo para que la malla detecte otros teléfonos.';
        }
      } catch {
        /* isEnabled no disponible en algunas plataformas */
      }

      this.active = true;
      logMesh('start', `Malla iniciada (emisor: ${this.advertiser ? 'sí' : 'no'})`);
      void startBackground(this.disaster);
      this.scheduleCycle(0);
    } catch (error) {
      console.warn('[mesh] no se pudo iniciar BLE:', error);
      logMesh('error', `No se pudo iniciar BLE: ${error instanceof Error ? error.message : String(error)}`);
      this.lastError =
        error instanceof Error
          ? `No se pudo iniciar Bluetooth: ${error.message}`
          : 'No se pudo iniciar Bluetooth (revisa permisos de Bluetooth y ubicación).';
      this.active = false;
    } finally {
      this.starting = false;
    }
  }

  stop(): void {
    this.active = false;
    logMesh('stop', 'Malla detenida');
    void stopBackground();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.ble?.stopLEScan().catch(() => undefined);
    this.advertiser?.stop().catch(() => undefined);
  }

  broadcast(envelope: MeshEnvelope, options?: { relay?: boolean }): void {
    void this.broadcastAsync(envelope, options);
  }

  private async broadcastAsync(envelope: MeshEnvelope, options?: { relay?: boolean }) {
    const relay = Boolean(options?.relay);
    const packet = envelopeToPacket(envelope);
    // Sólo los mensajes propios definen la identidad del teléfono: al repetir
    // mensajes de otros no debemos adoptar su origen ni crear comprobante.
    if (!relay) this.selfOrigin = packet.origin;
    await markSeen(packet.msgId);
    const priority = priorityOf(envelope);
    const note = (envelope.payload as { message?: unknown } | null)?.message;
    if (!relay) {
      createMeshReceipt({
        msgId: packet.msgId,
        type: envelope.type,
        note: typeof note === 'string' ? note : undefined,
        neighbours: this.getPeerCount(),
      });
    }
    if (!this.active && !relay) {
      markMeshFailed(packet.msgId, 'La malla está apagada: enciéndela para que el mensaje salga.');
    }

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
    // Firmamos con HMAC truncado: sólo los nodos con la clave de la red
    // pueden emitir tramas que los demás acepten.
    const signed = await signFrame(bytes);
    await enqueue({
      key,
      dataHex: bytesToHex(signed),
      priority,
      attempts: 0,
      // jitter proporcional a la prioridad: evita colisiones de radio sin
      // retrasar los SOS
      nextAt: now + Math.floor(Math.random() * JITTER_BY_PRIORITY[priority]),
      createdAt: now,
      expiresAt: now + TTL_BY_PRIORITY[priority],
    });
    await this.refreshPending();
  }

  /** Baliza de presencia: paquete mínimo, sin reenvío, para verse entre vecinos */
  private async announcePresence() {
    const origin = this.identity || this.selfOrigin;
    if (!origin) return;
    const now = Date.now();
    const bytes = encodePacket({
      type: 'MESH_HELLO',
      msgId: (Math.random() * 0xffffffff) >>> 0,
      ttl: 1,
      origin,
      lat: null,
      lng: null,
      timestamp: now,
    });
    const signed = await signFrame(bytes);
    logMesh('hello-sent', `MESH_HELLO emitido desde ${origin.toString(16)}`);
    await enqueue({
      key: `hello:${origin}`,
      dataHex: bytesToHex(signed),
      priority: 3,
      attempts: MAX_ATTEMPTS - 1, // se envía una vez y se descarta
      nextAt: now,
      createdAt: now,
      expiresAt: now + 60000,
    });
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
    const discovering = Date.now() < this.discoveryUntil;
    const cycle = discovering ? CYCLE_DISCOVERY : this.disaster ? CYCLE_DISASTER : CYCLE_IDLE;

    try {
      // Escuchar primero y emitir mientras el escáner está activo. Antes ambos
      // teléfonos emitían, esperaban y luego escuchaban en ciclos iguales, por
      // lo que podían alternarse para siempre sin oírse entre sí.
      await this.ble.requestLEScan({ allowDuplicates: true }, (result) => {
        const data = result.manufacturerData?.[String(MESH_MANUFACTURER_ID)];
        if (!data) return;
        void this.handleIncoming(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      });
      // Siempre anunciamos presencia: es la única forma de que dos teléfonos
      // se detecten aunque nadie haya enviado una alerta todavía.
      await this.announcePresence();
      await this.flushOutbox();
      // Jitter independiente evita que dos equipos con ciclos iniciados a la
      // vez vuelvan a sincronizarse después de una pausa.
      await wait(cycle.scanMs + Math.floor(Math.random() * 1200));
      await this.ble.stopLEScan();
      if (this.advertiser) this.lastError = null;
    } catch (error) {
      console.warn('[mesh] ciclo de escaneo falló:', error);
      this.lastError =
        error instanceof Error
          ? `Escaneo Bluetooth falló: ${error.message}`
          : 'Escaneo Bluetooth falló (revisa permisos de Bluetooth y ubicación).';
    }

    this.scheduleCycle(cycle.pauseMs);
  }

  private async handleIncoming(raw: Uint8Array) {
    const bytes = await verifyFrame(raw);
    if (!bytes) {
      this.rejected++;
      return; // firma inválida: SOS falso o ruido, se descarta
    }
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
    logMesh('peer-seen', `Vecino ${packet.origin.toString(16)} (${packet.type})`);
    if (packet.type === 'MESH_HELLO') {
      logMesh('hello-received', `Handshake con ${packet.origin.toString(16)}`);
      return;
    }
    logMesh(
      'message-received',
      `${packet.type} de ${packet.origin.toString(16)} lat=${packet.lat ?? '-'} lng=${packet.lng ?? '-'}`
    );

    // Si oímos de vuelta un mensaje nuestro, la malla lo está repitiendo:
    // es la prueba de que salió y otro teléfono lo tomó.
    if (this.selfOrigin && packet.origin === this.selfOrigin) {
      markMeshConfirmed(packet.msgId, 'eco');
    }

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
    if (packet.ttl > 1 && copies < SUPPRESS_AFTER_COPIES && this.allowRelayFrom(packet.origin)) {
      const relay: MeshPacket = { ...packet, ttl: packet.ttl - 1 };
      await this.queueFrame(
        `${packet.origin}:${packet.msgId}:p`,
        encodePacket(relay),
        priorityOfType(packet.type)
      );
    }
  }

  /**
   * Cuota de retransmisión por vecino. Los SOS propios nunca pasan por aquí;
   * esto sólo limita cuánto reenviamos por cuenta de un mismo origen.
   */
  private allowRelayFrom(origin: number): boolean {
    const now = Date.now();
    const limit = this.disaster ? NEIGHBOUR_RELAY_LIMIT.disaster : NEIGHBOUR_RELAY_LIMIT.idle;
    const entry = this.relaysByNeighbour.get(origin);
    if (!entry || now - entry.windowStart > NEIGHBOUR_WINDOW_MS) {
      this.relaysByNeighbour.set(origin, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count++;
    return true;
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
      2
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
    if (ack.bitmap !== 0) markMeshConfirmed(ack.msgId, 'ack');
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
        logMesh('error', `Emisión falló: ${error instanceof Error ? error.message : String(error)}`);
        this.lastError =
          error instanceof Error
            ? `Emisión Bluetooth falló: ${error.message}`
            : 'Emisión Bluetooth falló (revisa el permiso Dispositivos cercanos).';
        const failed = msgIdFromKey(item.key);
        if (failed != null) markMeshFailed(failed, this.lastError ?? 'Emisión Bluetooth falló.');
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
    const sentId = msgIdFromKey(item.key);
    if (sentId != null) markMeshEmitted(sentId, attempts);
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

/** Extrae el msgId de una clave de la bandeja: `origin:msgId:sufijo`. */
function msgIdFromKey(key: string): number | null {
  if (key.startsWith('ack:') || key.startsWith('hello:')) return null;
  const parts = key.split(':');
  if (parts.length < 3) return null;
  const id = Number(parts[1]);
  return Number.isFinite(id) ? id : null;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff capped at 60 s, with jitter to avoid radio collisions. */
function nextAttemptAt(attempts: number): number {
  const base = Math.min(60000, 1500 * 2 ** (attempts - 1));
  return Date.now() + base + Math.floor(Math.random() * 800);
}

/** SOS (auxilio) > pánico > necesito ayuda > ubicación/estado */
function priorityOfType(type: MeshEnvelope['type']): MeshPriority {
  if (type === 'HELP_14') return 0;
  if (type === 'PANIC') return 1;
  if (type === 'STATUS_NEED_HELP') return 2;
  return 3;
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
  // Las coordenadas viajan también en el JSON para que el mensaje de texto
  // reensamblado se pueda ubicar en el mapa por sí solo.
  if (typeof payload.lat === 'number') slim.lat = payload.lat;
  if (typeof payload.lng === 'number') slim.lng = payload.lng;
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