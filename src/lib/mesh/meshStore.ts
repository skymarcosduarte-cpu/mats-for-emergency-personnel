// Persistent store-and-forward for the BLE mesh (DTN behaviour).
//
// Everything lives in IndexedDB so a message survives the app being closed,
// the phone rebooting or the user walking kilometres away before finding
// another node. Falls back to memory when IndexedDB is unavailable.

const DB_NAME = 'mats_mesh';
const DB_VERSION = 1;
const OUTBOX = 'outbox';
const SEEN = 'seen';

export type MeshPriority = 0 | 1 | 2; // 0 = highest (SOS)

export interface OutboxItem {
  /** `${origin}:${msgId}:${fragIndex}` — stable, so re-queueing never duplicates */
  key: string;
  dataHex: string;
  priority: MeshPriority;
  attempts: number;
  /** epoch ms — do not transmit before this (backoff + jitter) */
  nextAt: number;
  createdAt: number;
  expiresAt: number;
}

const MAX_OUTBOX = 400;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OUTBOX)) {
          const store = db.createObjectStore(OUTBOX, { keyPath: 'key' });
          store.createIndex('priority', 'priority');
        }
        if (!db.objectStoreNames.contains(SEEN)) {
          db.createObjectStore(SEEN, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const request = run(db.transaction(store, mode).objectStore(store));
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

// ---------------------------------------------------------------- memory fallback
const memOutbox = new Map<string, OutboxItem>();
const memSeen = new Map<number, number>();
let useMemory = false;

openDb().then((db) => {
  useMemory = !db;
});

// ---------------------------------------------------------------- outbox

export async function enqueue(item: OutboxItem): Promise<void> {
  if (useMemory) {
    memOutbox.set(item.key, item);
    if (memOutbox.size > MAX_OUTBOX) memOutbox.delete(memOutbox.keys().next().value as string);
    return;
  }
  await tx(OUTBOX, 'readwrite', (s) => s.put(item) as unknown as IDBRequest<unknown>);
}

export async function removeFromOutbox(key: string): Promise<void> {
  if (useMemory) {
    memOutbox.delete(key);
    return;
  }
  await tx(OUTBOX, 'readwrite', (s) => s.delete(key) as unknown as IDBRequest<unknown>);
}

async function allOutbox(): Promise<OutboxItem[]> {
  if (useMemory) return Array.from(memOutbox.values());
  const items = await tx<OutboxItem[]>(OUTBOX, 'readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>);
  return items ?? [];
}

/** Drops expired entries and returns the next batch ordered by priority then age. */
export async function takeDue(limit: number, now = Date.now()): Promise<OutboxItem[]> {
  const items = await allOutbox();
  const expired = items.filter((i) => i.expiresAt <= now);
  await Promise.all(expired.map((i) => removeFromOutbox(i.key)));

  return items
    .filter((i) => i.expiresAt > now && i.nextAt <= now)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)
    .slice(0, limit);
}

export async function outboxSize(): Promise<number> {
  const items = await allOutbox();
  const now = Date.now();
  return items.filter((i) => i.expiresAt > now).length;
}

export async function clearOutbox(): Promise<void> {
  if (useMemory) {
    memOutbox.clear();
    return;
  }
  await tx(OUTBOX, 'readwrite', (s) => s.clear() as unknown as IDBRequest<unknown>);
}

// ---------------------------------------------------------------- seen cache

const SEEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 h — long enough for a walking courier
const seenMemory = new Map<number, number>();

/** Returns true when the id was already known (and records it otherwise). */
export async function markSeen(id: number): Promise<boolean> {
  const now = Date.now();
  const local = seenMemory.get(id);
  if (local && now - local < SEEN_TTL_MS) return true;
  seenMemory.set(id, now);
  if (seenMemory.size > 2000) seenMemory.delete(seenMemory.keys().next().value as number);

  if (useMemory) {
    const at = memSeen.get(id);
    memSeen.set(id, now);
    return Boolean(at && now - at < SEEN_TTL_MS);
  }

  const record = await tx<{ id: number; at: number } | undefined>(
    SEEN,
    'readonly',
    (s) => s.get(id) as IDBRequest<{ id: number; at: number } | undefined>
  );
  await tx(SEEN, 'readwrite', (s) => s.put({ id, at: now }) as unknown as IDBRequest<unknown>);
  return Boolean(record && now - record.at < SEEN_TTL_MS);
}

/** Warms the in-memory seen set from disk at startup. */
export async function hydrateSeen(): Promise<void> {
  if (useMemory) return;
  const rows = await tx<{ id: number; at: number }[]>(SEEN, 'readonly', (s) => s.getAll() as IDBRequest<{ id: number; at: number }[]>);
  const now = Date.now();
  (rows ?? []).forEach((row) => {
    if (now - row.at < SEEN_TTL_MS) seenMemory.set(row.id, row.at);
    else void tx(SEEN, 'readwrite', (s) => s.delete(row.id) as unknown as IDBRequest<unknown>);
  });
}