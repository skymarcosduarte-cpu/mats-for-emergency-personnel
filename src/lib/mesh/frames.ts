// Fragmentation + acknowledgement layer on top of the 21-byte mesh packet.
//
// A BLE advertisement carries ~24 usable bytes, so any payload richer than a
// coordinate (a short text, a medical note) must be split, numbered and
// reassembled on the other side. ACKs let the sender stop retransmitting.

import { MESH_PROTOCOL_VERSION } from './protocol';

export const FRAME_FRAG = 0xf0;
export const FRAME_ACK = 0xf1;

/** ver(1) | 0xF0 | msgId(4) | origin(4) | index(1) | total(1) | payload(<=12) */
export const FRAG_PAYLOAD_BYTES = 12;
export const MAX_FRAGMENTS = 32;

export interface FragFrame {
  msgId: number;
  origin: number;
  index: number;
  total: number;
  payload: Uint8Array;
}

export interface AckFrame {
  msgId: number;
  origin: number;
  /** bit i set = fragment i received */
  bitmap: number;
}

export function isControlFrame(bytes: Uint8Array): boolean {
  return bytes.length > 1 && (bytes[1] === FRAME_FRAG || bytes[1] === FRAME_ACK);
}

export function encodeFrag(frame: FragFrame): Uint8Array {
  const payload = frame.payload.slice(0, FRAG_PAYLOAD_BYTES);
  const bytes = new Uint8Array(12 + payload.length);
  const view = new DataView(bytes.buffer);
  bytes[0] = MESH_PROTOCOL_VERSION;
  bytes[1] = FRAME_FRAG;
  view.setUint32(2, frame.msgId >>> 0);
  view.setUint32(6, frame.origin >>> 0);
  bytes[10] = frame.index & 0xff;
  bytes[11] = frame.total & 0xff;
  bytes.set(payload, 12);
  return bytes;
}

export function decodeFrag(bytes: Uint8Array): FragFrame | null {
  if (bytes.length < 12 || bytes[0] !== MESH_PROTOCOL_VERSION || bytes[1] !== FRAME_FRAG) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const total = bytes[11];
  const index = bytes[10];
  if (total === 0 || total > MAX_FRAGMENTS || index >= total) return null;
  return {
    msgId: view.getUint32(2),
    origin: view.getUint32(6),
    index,
    total,
    payload: bytes.slice(12),
  };
}

export function encodeAck(frame: AckFrame): Uint8Array {
  const bytes = new Uint8Array(14);
  const view = new DataView(bytes.buffer);
  bytes[0] = MESH_PROTOCOL_VERSION;
  bytes[1] = FRAME_ACK;
  view.setUint32(2, frame.msgId >>> 0);
  view.setUint32(6, frame.origin >>> 0);
  view.setUint32(10, frame.bitmap >>> 0);
  return bytes;
}

export function decodeAck(bytes: Uint8Array): AckFrame | null {
  if (bytes.length < 14 || bytes[0] !== MESH_PROTOCOL_VERSION || bytes[1] !== FRAME_ACK) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { msgId: view.getUint32(2), origin: view.getUint32(6), bitmap: view.getUint32(10) };
}

/** Splits an arbitrary payload into ordered fragment frames. */
export function fragment(msgId: number, origin: number, data: Uint8Array): Uint8Array[] {
  const total = Math.max(1, Math.ceil(data.length / FRAG_PAYLOAD_BYTES));
  if (total > MAX_FRAGMENTS) throw new Error('mesh: payload demasiado grande para la malla');
  const frames: Uint8Array[] = [];
  for (let i = 0; i < total; i++) {
    frames.push(
      encodeFrag({
        msgId,
        origin,
        index: i,
        total,
        payload: data.subarray(i * FRAG_PAYLOAD_BYTES, (i + 1) * FRAG_PAYLOAD_BYTES),
      })
    );
  }
  return frames;
}

interface Pending {
  total: number;
  parts: Map<number, Uint8Array>;
  updatedAt: number;
}

const REASSEMBLY_TTL_MS = 10 * 60 * 1000;

/** Collects fragments until a message is complete. */
export class Reassembler {
  private pending = new Map<string, Pending>();

  /** Returns the full payload once every fragment arrived. */
  accept(frame: FragFrame): { complete: Uint8Array | null; bitmap: number } {
    const key = `${frame.origin}:${frame.msgId}`;
    this.sweep();
    const entry = this.pending.get(key) ?? { total: frame.total, parts: new Map(), updatedAt: Date.now() };
    entry.parts.set(frame.index, frame.payload);
    entry.updatedAt = Date.now();
    this.pending.set(key, entry);

    let bitmap = 0;
    entry.parts.forEach((_v, index) => {
      bitmap |= 1 << index;
    });

    if (entry.parts.size < entry.total) return { complete: null, bitmap };

    const size = Array.from(entry.parts.values()).reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    for (let i = 0; i < entry.total; i++) {
      const part = entry.parts.get(i);
      if (!part) return { complete: null, bitmap };
      out.set(part, offset);
      offset += part.length;
    }
    this.pending.delete(key);
    return { complete: out, bitmap };
  }

  private sweep() {
    const cutoff = Date.now() - REASSEMBLY_TTL_MS;
    this.pending.forEach((entry, key) => {
      if (entry.updatedAt < cutoff) this.pending.delete(key);
    });
  }
}

export function fullBitmap(total: number): number {
  return total >= 32 ? 0xffffffff : (1 << total) - 1;
}