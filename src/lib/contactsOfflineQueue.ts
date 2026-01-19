// Offline queue for emergency contacts operations
// Uses IndexedDB to persist pending operations

import { get, set, del } from 'idb-keyval';

export type ContactOperation = {
  id: string;
  type: 'add' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
};

const QUEUE_KEY = 'emergency_contacts_offline_queue';
const MAX_RETRIES = 3;

export async function getOfflineQueue(): Promise<ContactOperation[]> {
  try {
    const queue = await get<ContactOperation[]>(QUEUE_KEY);
    return queue || [];
  } catch {
    return [];
  }
}

export async function addToOfflineQueue(operation: Omit<ContactOperation, 'id' | 'timestamp' | 'retries'>): Promise<ContactOperation> {
  const queue = await getOfflineQueue();
  const newOp: ContactOperation = {
    ...operation,
    id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retries: 0,
  };
  queue.push(newOp);
  await set(QUEUE_KEY, queue);
  return newOp;
}

export async function removeFromOfflineQueue(operationId: string): Promise<void> {
  const queue = await getOfflineQueue();
  const filtered = queue.filter(op => op.id !== operationId);
  await set(QUEUE_KEY, filtered);
}

export async function incrementRetry(operationId: string): Promise<boolean> {
  const queue = await getOfflineQueue();
  const op = queue.find(o => o.id === operationId);
  if (op) {
    op.retries++;
    if (op.retries >= MAX_RETRIES) {
      // Remove failed operations after max retries
      await removeFromOfflineQueue(operationId);
      return false;
    }
    await set(QUEUE_KEY, queue);
    return true;
  }
  return false;
}

export async function clearOfflineQueue(): Promise<void> {
  await del(QUEUE_KEY);
}

export async function getPendingCount(): Promise<number> {
  const queue = await getOfflineQueue();
  return queue.length;
}

// Local contacts cache for offline viewing
const LOCAL_CONTACTS_KEY = 'emergency_contacts_local_cache';

export async function cacheContactsLocally(contacts: unknown[]): Promise<void> {
  try {
    await set(LOCAL_CONTACTS_KEY, { contacts, cachedAt: Date.now() });
  } catch (err) {
    console.error('Failed to cache contacts locally:', err);
  }
}

export async function getCachedContacts(): Promise<{ contacts: unknown[]; cachedAt: number } | null> {
  try {
    return await get(LOCAL_CONTACTS_KEY);
  } catch {
    return null;
  }
}
