// Puente con repetidores Meshtastic (ESP32 / LoRa).
//
// Un nodo Meshtastic es una radio LoRa independiente que retransmite mensajes
// varios kilómetros sin Wi-Fi ni red celular. Este módulo conecta el teléfono
// al nodo por Bluetooth LE y usa su canal de texto (TEXT_MESSAGE_APP) para
// sacar y meter avisos de M.A.T.S.:
//
//   Teléfono A ──BLE──> Nodo ESP32 ──LoRa──> Nodo ESP32 ──BLE──> Teléfono B
//
// Los mensajes viajan con el prefijo "MATS1|" y un JSON compacto, de modo que
// otros usuarios de Meshtastic vean texto legible y M.A.T.S. pueda reconocer
// los suyos. Todo se carga de forma diferida: en web no cuesta nada.

import type { MeshEnvelope, MeshMessageType } from '@/types';

export const MESHTASTIC_SERVICE = '6ba1b218-15a8-461f-9fa8-5dcae273eafd';
const CHAR_TO_RADIO = 'f75c76d2-129e-4dad-a1dd-7866124401e7';
const CHAR_FROM_RADIO = '2c55e69e-4993-11ed-b878-0242ac120002';
const CHAR_FROM_NUM = 'ed9da18c-a800-4f66-a670-aa7547e34453';

const PREFIX = 'MATS1|';
const BROADCAST_ADDR = 0xffffffff;
const PORT_TEXT_MESSAGE = 1;
const PREF_KEY = 'mats_meshtastic_enabled_v1';
const NODE_KEY = 'mats_meshtastic_node_v1';

export interface MeshtasticNode {
  deviceId: string;
  name: string;
  rssi?: number | null;
}

export interface MeshtasticState {
  supported: boolean;
  enabled: boolean;
  connected: boolean;
  node: MeshtasticNode | null;
  lastError: string | null;
  sent: number;
  received: number;
}

export const MESHTASTIC_EVENT = 'mats:meshtastic-changed';

// ---------------------------------------------------------------- protobuf

function varint(value: number): number[] {
  const out: number[] = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return out;
}

function field(num: number, wire: number): number[] {
  return varint((num << 3) | wire);
}

function lenField(num: number, bytes: Uint8Array): number[] {
  return [...field(num, 2), ...varint(bytes.length), ...bytes];
}

function fixed32(num: number, value: number): number[] {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, value >>> 0, true);
  return [...field(num, 5), ...b];
}

/** Lector genérico: devuelve los campos de un mensaje protobuf */
function readFields(bytes: Uint8Array): Map<number, Array<Uint8Array | number>> {
  const out = new Map<number, Array<Uint8Array | number>>();
  let i = 0;
  const push = (num: number, value: Uint8Array | number) => {
    const list = out.get(num) ?? [];
    list.push(value);
    out.set(num, list);
  };
  const readVarint = (): number => {
    let result = 0;
    let shift = 0;
    while (i < bytes.length) {
      const b = bytes[i++];
      result += (b & 0x7f) * Math.pow(2, shift);
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return result;
  };
  while (i < bytes.length) {
    const key = readVarint();
    const num = key >>> 3;
    const wire = key & 7;
    if (wire === 0) push(num, readVarint());
    else if (wire === 1) {
      push(num, bytes.slice(i, i + 8));
      i += 8;
    } else if (wire === 2) {
      const len = readVarint();
      push(num, bytes.slice(i, i + len));
      i += len;
    } else if (wire === 5) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset + i, 4);
      push(num, dv.getUint32(0, true));
      i += 4;
    } else break;
  }
  return out;
}

/** ToRadio { packet = 1: MeshPacket { to, decoded: Data { portnum, payload } } } */
function encodeTextPacket(text: string): Uint8Array {
  const payload = new TextEncoder().encode(text);
  const data = new Uint8Array([
    ...field(1, 0),
    ...varint(PORT_TEXT_MESSAGE),
    ...lenField(2, payload),
  ]);
  const packet = new Uint8Array([
    ...fixed32(2, BROADCAST_ADDR),
    ...lenField(4, data),
    ...fixed32(6, (Math.random() * 0xffffffff) >>> 0),
    ...field(10, 0),
    ...varint(5), // hop_limit: hasta 5 saltos entre repetidores
  ]);
  return new Uint8Array(lenField(1, packet));
}

/** Extrae el texto de un FromRadio, si trae un mensaje de texto */
function decodeTextFromRadio(bytes: Uint8Array): string | null {
  const fromRadio = readFields(bytes);
  const packetBytes = fromRadio.get(2)?.find((v) => v instanceof Uint8Array) as Uint8Array | undefined;
  if (!packetBytes) return null;
  const packet = readFields(packetBytes);
  const dataBytes = packet.get(4)?.find((v) => v instanceof Uint8Array) as Uint8Array | undefined;
  if (!dataBytes) return null;
  const data = readFields(dataBytes);
  const portnum = data.get(1)?.[0];
  if (portnum !== PORT_TEXT_MESSAGE) return null;
  const payload = data.get(2)?.find((v) => v instanceof Uint8Array) as Uint8Array | undefined;
  if (!payload) return null;
  try {
    return new TextDecoder().decode(payload);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- serialización

export function envelopeToText(envelope: MeshEnvelope): string {
  const payload = (envelope.payload ?? {}) as { lat?: number; lng?: number; message?: string };
  const compact = {
    t: envelope.type,
    s: envelope.sender_id,
    ts: envelope.timestamp,
    la: typeof payload.lat === 'number' ? Number(payload.lat.toFixed(5)) : undefined,
    ln: typeof payload.lng === 'number' ? Number(payload.lng.toFixed(5)) : undefined,
    m: payload.message ? String(payload.message).slice(0, 120) : undefined,
  };
  return PREFIX + JSON.stringify(compact);
}

export function textToEnvelope(text: string): MeshEnvelope | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const raw = JSON.parse(text.slice(PREFIX.length)) as {
      t: MeshMessageType;
      s: string;
      ts: number;
      la?: number;
      ln?: number;
      m?: string;
    };
    if (!raw?.t || !raw?.s) return null;
    return {
      type: raw.t,
      sender_id: raw.s,
      timestamp: raw.ts || Date.now(),
      payload: {
        ...(raw.la != null ? { lat: raw.la } : {}),
        ...(raw.ln != null ? { lng: raw.ln } : {}),
        ...(raw.m ? { message: raw.m } : {}),
        viaMeshtastic: true,
      },
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ puente

type BleClientType = typeof import('@capacitor-community/bluetooth-le').BleClient;

class MeshtasticBridge {
  private ble: BleClientType | null = null;
  private listeners = new Set<(envelope: MeshEnvelope) => void>();
  private state: MeshtasticState = {
    supported: false,
    enabled: localStorage.getItem(PREF_KEY) === '1',
    connected: false,
    node: readStoredNode(),
    lastError: null,
    sent: 0,
    received: 0,
  };
  private draining = false;
  private keepAlive: ReturnType<typeof setInterval> | null = null;

  getState(): MeshtasticState {
    return { ...this.state };
  }

  onMessage(cb: (envelope: MeshEnvelope) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit() {
    window.dispatchEvent(new CustomEvent(MESHTASTIC_EVENT));
  }

  private patch(partial: Partial<MeshtasticState>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  private async client(): Promise<BleClientType> {
    if (!this.ble) {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      await BleClient.initialize({ androidNeverForLocation: true });
      this.ble = BleClient;
    }
    return this.ble;
  }

  setSupported(supported: boolean) {
    if (this.state.supported !== supported) this.patch({ supported });
  }

  /** Busca nodos Meshtastic cercanos (el usuario elige con cuál emparejar) */
  async scan(timeoutMs = 8000): Promise<MeshtasticNode[]> {
    const ble = await this.client();
    const found = new Map<string, MeshtasticNode>();
    try {
      await ble.requestLEScan({ services: [MESHTASTIC_SERVICE], allowDuplicates: false }, (r) => {
        const id = r.device?.deviceId;
        if (!id) return;
        found.set(id, {
          deviceId: id,
          name: r.localName || r.device?.name || 'Repetidor Meshtastic',
          rssi: r.rssi ?? null,
        });
      });
      await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    } finally {
      try {
        await ble.stopLEScan();
      } catch {
        /* ya detenido */
      }
    }
    return Array.from(found.values()).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
  }

  async connect(node: MeshtasticNode): Promise<void> {
    const ble = await this.client();
    try {
      await ble.connect(node.deviceId, () => {
        this.patch({ connected: false });
        if (this.state.enabled) void this.reconnectSoon();
      });
      await ble.startNotifications(node.deviceId, MESHTASTIC_SERVICE, CHAR_FROM_NUM, () => {
        void this.drain();
      });
      localStorage.setItem(NODE_KEY, JSON.stringify(node));
      this.patch({ connected: true, node, lastError: null });
      void this.drain();
      this.startKeepAlive();
    } catch (error) {
      this.patch({ connected: false, lastError: (error as Error)?.message ?? 'No se pudo conectar' });
      throw error;
    }
  }

  private startKeepAlive() {
    if (this.keepAlive) return;
    this.keepAlive = setInterval(() => {
      if (!this.state.enabled) return;
      if (!this.state.connected) void this.reconnectSoon();
      else void this.drain();
    }, 30000);
  }

  private async reconnectSoon() {
    const node = this.state.node;
    if (!node || !this.state.enabled) return;
    try {
      await this.connect(node);
    } catch {
      /* se reintenta en el siguiente ciclo */
    }
  }

  /** Lee del nodo hasta vaciar su cola de mensajes */
  private async drain() {
    if (this.draining || !this.state.node) return;
    this.draining = true;
    try {
      const ble = await this.client();
      for (let i = 0; i < 24; i++) {
        const value = await ble.read(this.state.node.deviceId, MESHTASTIC_SERVICE, CHAR_FROM_RADIO);
        const bytes = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
        if (bytes.length === 0) break;
        const text = decodeTextFromRadio(bytes);
        if (!text) continue;
        const envelope = textToEnvelope(text);
        if (!envelope) continue;
        this.patch({ received: this.state.received + 1 });
        this.listeners.forEach((cb) => {
          try {
            cb(envelope);
          } catch (error) {
            console.warn('[meshtastic] listener error:', error);
          }
        });
      }
    } catch (error) {
      this.patch({ lastError: (error as Error)?.message ?? 'Error leyendo del repetidor' });
    } finally {
      this.draining = false;
    }
  }

  /** Envía un aviso M.A.T.S. por LoRa a través del repetidor emparejado */
  async send(envelope: MeshEnvelope): Promise<boolean> {
    if (!this.state.enabled || !this.state.connected || !this.state.node) return false;
    try {
      const ble = await this.client();
      const packet = encodeTextPacket(envelopeToText(envelope));
      await ble.write(
        this.state.node.deviceId,
        MESHTASTIC_SERVICE,
        CHAR_TO_RADIO,
        new DataView(packet.buffer)
      );
      this.patch({ sent: this.state.sent + 1 });
      return true;
    } catch (error) {
      this.patch({ lastError: (error as Error)?.message ?? 'No se pudo enviar al repetidor' });
      return false;
    }
  }

  async enable(value: boolean): Promise<void> {
    localStorage.setItem(PREF_KEY, value ? '1' : '0');
    this.patch({ enabled: value });
    if (value) await this.reconnectSoon();
    else await this.disconnect();
  }

  async disconnect(): Promise<void> {
    const node = this.state.node;
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
    if (!node) return;
    try {
      await this.ble?.disconnect(node.deviceId);
    } catch {
      /* ya desconectado */
    }
    this.patch({ connected: false });
  }

  forget(): void {
    localStorage.removeItem(NODE_KEY);
    void this.disconnect();
    this.patch({ node: null });
  }
}

function readStoredNode(): MeshtasticNode | null {
  try {
    const raw = localStorage.getItem(NODE_KEY);
    return raw ? (JSON.parse(raw) as MeshtasticNode) : null;
  } catch {
    return null;
  }
}

export const meshtastic = new MeshtasticBridge();
