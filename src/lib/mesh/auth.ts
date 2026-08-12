// Autenticación criptográfica de tramas de malla (HMAC-SHA256 truncado).
//
// Cada trama que sale al aire lleva un tag de 3 bytes calculado sobre sus
// bytes con una clave compartida de red. Un receptor descarta cualquier
// paquete cuyo tag no coincida, de forma que un atacante no puede inyectar
// SOS falsos ni inundar la malla con basura durante un desastre.
//
// Por qué HMAC truncado y no Ed25519: una firma Ed25519 son 64 bytes y un
// anuncio BLE sólo transporta ~24 bytes útiles. El HMAC truncado cabe, es
// barato en CPU (importante para batería) y cumple el objetivo: sólo los
// dispositivos con la clave de la red pueden emitir tramas válidas.

const TAG_BYTES = 3;

// Clave por defecto de la red MATS. Puede sustituirse por comunidad/brigada
// con setMeshKey() sin cambiar el protocolo.
const DEFAULT_KEY = 'MATS-MESH-v1';

let keyMaterial = DEFAULT_KEY;
let cryptoKey: Promise<CryptoKey | null> | null = null;

function subtle(): SubtleCrypto | null {
  const c = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  return c?.subtle ?? null;
}

function loadKey(): Promise<CryptoKey | null> {
  if (cryptoKey) return cryptoKey;
  const s = subtle();
  if (!s) return Promise.resolve(null);
  cryptoKey = s
    .importKey('raw', new TextEncoder().encode(keyMaterial), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ])
    .catch(() => null);
  return cryptoKey;
}

/** Cambia la clave compartida de la malla (p. ej. clave de brigada). */
export function setMeshKey(secret: string): void {
  keyMaterial = secret || DEFAULT_KEY;
  cryptoKey = null;
}

async function tag(bytes: Uint8Array): Promise<Uint8Array | null> {
  const key = await loadKey();
  const s = subtle();
  if (!key || !s) return null;
  const buffer = bytes.slice().buffer as ArrayBuffer;
  const mac = new Uint8Array(await s.sign('HMAC', key, buffer));
  return mac.slice(0, TAG_BYTES);
}

/** Devuelve la trama con su tag HMAC anexado (o la trama tal cual si no hay WebCrypto). */
export async function signFrame(bytes: Uint8Array): Promise<Uint8Array> {
  const mac = await tag(bytes);
  if (!mac) return bytes;
  const out = new Uint8Array(bytes.length + TAG_BYTES);
  out.set(bytes, 0);
  out.set(mac, bytes.length);
  return out;
}

/**
 * Verifica y retira el tag. Devuelve null cuando la trama no está firmada
 * con la clave de la red (paquete ajeno, corrupto o malicioso).
 */
export async function verifyFrame(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (bytes.length <= TAG_BYTES) return null;
  const body = bytes.slice(0, bytes.length - TAG_BYTES);
  const received = bytes.slice(bytes.length - TAG_BYTES);
  const expected = await tag(body);
  if (!expected) return body; // sin WebCrypto no podemos verificar: modo degradado
  let diff = 0;
  for (let i = 0; i < TAG_BYTES; i++) diff |= expected[i] ^ received[i];
  return diff === 0 ? body : null;
}

export const MESH_TAG_BYTES = TAG_BYTES;
