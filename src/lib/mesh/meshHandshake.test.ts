// Prueba end-to-end del handshake MESH_HELLO y del buzón de mensajes.
// Simula dos dispositivos (A y B) intercambiando tramas firmadas por el aire
// BLE, como ocurre en Android e iOS, y valida que:
//   1. El saludo MESH_HELLO se firma, viaja y se verifica.
//   2. Una alerta con coordenadas llega íntegra al buzón.
//   3. El registro de diagnóstico deja constancia del handshake.

import { describe, expect, it, beforeEach } from 'vitest';
import { encodePacket, decodePacket, hashId, packetToEnvelope, MESH_DEFAULT_TTL } from './protocol';
import { signFrame, verifyFrame } from './auth';
import { envelopeToInboxItem, type MeshInboxItem } from '@/components/MeshInbox';
import {
  clearMeshDiagnostics,
  logMesh,
  meshHandshakeSummary,
  getMeshDiagnostics,
} from './meshDiagnostics';

/** Radio simulada: lo que un dispositivo emite lo recibe el otro. */
async function airLink(bytes: Uint8Array): Promise<Uint8Array | null> {
  const signed = await signFrame(bytes);
  return verifyFrame(signed);
}

describe('handshake MESH_HELLO (Android / iOS)', () => {
  beforeEach(() => clearMeshDiagnostics());

  it('el saludo de presencia se firma, viaja y se verifica', async () => {
    const originA = hashId('device-android-A');
    const hello = encodePacket({
      type: 'MESH_HELLO',
      msgId: 1234,
      ttl: 1,
      origin: originA,
      lat: null,
      lng: null,
      timestamp: Date.now(),
    });
    logMesh('hello-sent', 'A emite MESH_HELLO');

    const received = await airLink(hello);
    expect(received).not.toBeNull();

    const packet = decodePacket(received!);
    expect(packet?.type).toBe('MESH_HELLO');
    expect(packet?.origin).toBe(originA);
    logMesh('hello-received', 'B confirma handshake con A');

    const summary = meshHandshakeSummary();
    expect(summary.handshakeOk).toBe(true);
    expect(getMeshDiagnostics().length).toBeGreaterThanOrEqual(2);
  });

  it('rechaza tramas sin firma válida (SOS falsos)', async () => {
    const bogus = encodePacket({
      type: 'PANIC',
      msgId: 9,
      ttl: 2,
      origin: hashId('atacante'),
      lat: 19.4,
      lng: -99.1,
      timestamp: Date.now(),
    });
    // Se envía sin firmar: el receptor debe descartarla.
    expect(await verifyFrame(bogus)).toBeNull();
  });

  it('una alerta con coordenadas llega al buzón con lat/lng y hora', async () => {
    const originB = hashId('device-ios-B');
    const timestamp = Date.now();
    const sent = encodePacket({
      type: 'HELP_14',
      msgId: 4242,
      ttl: MESH_DEFAULT_TTL,
      origin: originB,
      lat: 19.4326,
      lng: -99.1332,
      timestamp,
    });

    const received = await airLink(sent);
    const packet = decodePacket(received!);
    expect(packet).not.toBeNull();

    const inbox: MeshInboxItem[] = [];
    const envelope = packetToEnvelope(packet!);
    inbox.push(envelopeToInboxItem(envelope));
    logMesh('message-received', `HELP_14 de ${originB.toString(16)}`);

    expect(inbox).toHaveLength(1);
    expect(inbox[0].type).toBe('HELP_14');
    expect(inbox[0].lat).toBeCloseTo(19.4326, 3);
    expect(inbox[0].lng).toBeCloseTo(-99.1332, 3);
    expect(inbox[0].receivedAt).toBeGreaterThan(0);
    expect(meshHandshakeSummary().messages).toBe(1);
  });
});
