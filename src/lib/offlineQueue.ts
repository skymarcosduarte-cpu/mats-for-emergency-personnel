// Offline Queue for COMUNIDAD EX SOS
// Stores actions when offline and syncs when connection returns

import { get, set, del, keys, createStore } from 'idb-keyval';
import type { OfflineQueueItem } from '@/types';

const QUEUE_STORE = createStore('exsos-offline', 'queue');
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

type ActionHandler = (payload: unknown) => Promise<void>;

const actionHandlers: Map<string, ActionHandler> = new Map();

/**
 * Register an action handler
 */
export function registerActionHandler(action: string, handler: ActionHandler): void {
  actionHandlers.set(action, handler);
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add item to offline queue
 */
export async function queueAction(action: string, payload: unknown): Promise<string> {
  const item: OfflineQueueItem = {
    id: generateId(),
    action,
    payload,
    created_at: new Date().toISOString(),
    retries: 0,
  };
  
  await set(item.id, item, QUEUE_STORE);
  
  // Try to process immediately if online
  if (navigator.onLine) {
    processQueue();
  }
  
  return item.id;
}

/**
 * Get all queued items
 */
export async function getQueuedItems(): Promise<OfflineQueueItem[]> {
  const allKeys = await keys(QUEUE_STORE);
  const items: OfflineQueueItem[] = [];
  
  for (const key of allKeys) {
    const item = await get<OfflineQueueItem>(key, QUEUE_STORE);
    if (item) {
      items.push(item);
    }
  }
  
  // Sort by creation time
  return items.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * Remove item from queue
 */
export async function removeFromQueue(id: string): Promise<void> {
  await del(id, QUEUE_STORE);
}

/**
 * Process single queue item
 */
async function processItem(item: OfflineQueueItem): Promise<boolean> {
  const handler = actionHandlers.get(item.action);
  
  if (!handler) {
    console.warn(`No handler registered for action: ${item.action}`);
    return false;
  }
  
  try {
    await handler(item.payload);
    await removeFromQueue(item.id);
    return true;
  } catch (error) {
    console.error(`Failed to process queue item ${item.id}:`, error);
    
    // Update retry count
    item.retries += 1;
    
    if (item.retries >= MAX_RETRIES) {
      console.error(`Max retries reached for item ${item.id}, removing from queue`);
      await removeFromQueue(item.id);
      return false;
    }
    
    // Update item in store
    await set(item.id, item, QUEUE_STORE);
    return false;
  }
}

/**
 * Process all queued items
 */
let isProcessing = false;

export async function processQueue(): Promise<void> {
  if (!navigator.onLine || isProcessing) {
    return;
  }
  
  isProcessing = true;
  
  try {
    const items = await getQueuedItems();
    
    for (const item of items) {
      if (!navigator.onLine) {
        break;
      }
      
      await processItem(item);
      
      // Small delay between items
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Get queue size
 */
export async function getQueueSize(): Promise<number> {
  const allKeys = await keys(QUEUE_STORE);
  return allKeys.length;
}

/**
 * Clear entire queue
 */
export async function clearQueue(): Promise<void> {
  const allKeys = await keys(QUEUE_STORE);
  for (const key of allKeys) {
    await del(key, QUEUE_STORE);
  }
}

// Set up online listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online, processing queue...');
    setTimeout(processQueue, 1000);
  });
  
  // Periodic retry when online
  setInterval(() => {
    if (navigator.onLine) {
      processQueue();
    }
  }, RETRY_DELAY_MS);
}
