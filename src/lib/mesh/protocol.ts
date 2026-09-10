// Binary mesh protocol for BLE advertising payloads (max ~24 useful bytes)
// Layout: ver(1) | type(1) | msgId(4) | ttl(1) | origin(4) | lat(3) | lng(3) | ts(4) = 21 bytes

import type { MeshEnvelope, MeshMessageType } from '@/types';

export const MESH_PROTOCOL_VERSION = 1;
export const MESH_SERVICE_UUID = '0000fe70-0000-1000-8000-00805f9b34fb';
export const MESH_MANUFACTURER_ID = 0xffff;
export const MESH_DEFAULT_TTL = 4;

const TYPES: MeshMessageType[] = [
  'PANIC',
  'STATUS_OK',
  'STATUS_NEED_HELP',
  'DRILL_TEST',
  'DRILL_ACK',
  'HELP_14',
  'MESH_HELLO',
];

export interface MeshPacket {
  type: MeshMessageType;
  msgId: number;
  ttl: number;
  origin: number;
  lat: number | null;
  lng: number | null;
  timestamp: number;
}

/** Stable 32-bit hash of a string (used to compress user ids) */
export function hashId(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function encodeCoord(value: number, span: number): number {
  // 24-bit fixed point, ~2m resolution
  const norm = (value + span) / (span * 2);
  return Math.max(0, Math.min(0xffffff, Math.round(norm * 0xffffff)));
}

function decodeCoord(raw: number, span: number): number {
  return (raw / 0xffffff) * (span * 2) - span;
}

export function encodePacket(packet: MeshPacket): Uint8Array {
  const bytes = new Uint8Array(21);
  const view = new DataView(bytes.buffer);
  bytes[0] = MESH_PROTOCOL_VERSION;
  bytes[1] = Math.max(0, TYPES.indexOf(packet.type));
  view.setUint32(2, packet.msgId >>> 0);
  bytes[6] = packet.ttl & 0xff;
  view.setUint32(7, packet.origin >>> 0);

  const lat = packet.lat == null ? 0 : encodeCoord(packet.lat, 90);
  const lng = packet.lng == null ? 0 : encodeCoord(packet.lng, 180);
  bytes[11] = (lat >> 16) & 0xff;
  bytes[12] = (lat >> 8) & 0xff;
  bytes[13] = lat & 0xff;
  bytes[14] = (lng >> 16) & 0xff;
  bytes[15] = (lng >> 8) & 0xff;
  bytes[16] = lng & 0xff;

  // seconds since epoch (fits until 2106)
  view.setUint32(17, Math.floor(packet.timestamp / 1000) >>> 0);
  return bytes;
}

export function decodePacket(bytes: Uint8Array): MeshPacket | null {
  if (bytes.length < 21) return null;
  if (bytes[0] !== MESH_PROTOCOL_VERSION) return null;
  const type = TYPES[bytes[1]];
  if (!type) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const latRaw = (bytes[11] << 16) | (bytes[12] << 8) | bytes[13];
  const lngRaw = (bytes[14] << 16) | (bytes[15] << 8) | bytes[16];

  return {
    type,
    msgId: view.getUint32(2),
    ttl: bytes[6],
    origin: view.getUint32(7),
    lat: latRaw === 0 ? null : decodeCoord(latRaw, 90),
    lng: lngRaw === 0 ? null : decodeCoord(lngRaw, 180),
    timestamp: view.getUint32(17) * 1000,
  };
}

export function packetToEnvelope(packet: MeshPacket): MeshEnvelope {
  return {
    type: packet.type,
    sender_id: `mesh:${packet.origin.toString(16)}`,
    timestamp: packet.timestamp,
    payload: { lat: packet.lat, lng: packet.lng, ttl: packet.ttl, msgId: packet.msgId },
  };
}

/**
 * Origen de 32 bits de un remitente. Los ids que ya vienen de la malla
 * ("mesh:abcd") se reusan tal cual: así un mensaje repetido por internet
 * conserva su remitente original y no se duplica en el buzón.
 */
export function originFromSenderId(senderId: string): number {
  const match = /^mesh:([0-9a-f]{1,8})$/i.exec(senderId);
  if (match) return parseInt(match[1], 16) >>> 0;
  return hashId(senderId);
}

export function envelopeToPacket(envelope: MeshEnvelope, ttl = MESH_DEFAULT_TTL): MeshPacket {
  const payload = (envelope.payload ?? {}) as { lat?: number; lng?: number };
  return {
    type: envelope.type,
    msgId: (Math.random() * 0xffffffff) >>> 0,
    ttl,
    origin: originFromSenderId(envelope.sender_id),
    lat: typeof payload.lat === 'number' ? payload.lat : null,
    lng: typeof payload.lng === 'number' ? payload.lng : null,
    timestamp: envelope.timestamp || Date.now(),
  };
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Small LRU set used for message de-duplication */
export class SeenCache {
  private map = new Map<number, number>();
  constructor(private limit = 300, private ttlMs = 10 * 60 * 1000) {}

  has(id: number): boolean {
    const at = this.map.get(id);
    if (at == null) return false;
    if (Date.now() - at > this.ttlMs) {
      this.map.delete(id);
      return false;
    }
    return true;
  }

  add(id: number): void {
    if (this.map.size >= this.limit) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(id, Date.now());
  }
}