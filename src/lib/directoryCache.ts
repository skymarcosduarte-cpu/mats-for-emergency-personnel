// Directory Cache - IndexedDB offline storage for emergency directory data
import { get, set, createStore } from 'idb-keyval';

const DIRECTORY_STORE = createStore('exsos-directory', 'data');
const DIRECTORY_KEY = 'emergency_directory';

interface DirectoryCacheEntry {
  data: any[];
  cachedAt: number;
}

/**
 * Save directory data to IndexedDB
 */
export async function cacheDirectoryData(data: any[]): Promise<void> {
  try {
    const entry: DirectoryCacheEntry = { data, cachedAt: Date.now() };
    await set(DIRECTORY_KEY, entry, DIRECTORY_STORE);
    console.log('[directoryCache] Saved', data.length, 'countries to cache');
  } catch (e) {
    console.error('[directoryCache] Failed to cache:', e);
  }
}

/**
 * Get cached directory data from IndexedDB
 */
export async function getCachedDirectoryData(): Promise<{ data: any[] | null; cachedAt: number | null }> {
  try {
    const entry = await get<DirectoryCacheEntry>(DIRECTORY_KEY, DIRECTORY_STORE);
    if (entry) {
      console.log('[directoryCache] Loaded', entry.data.length, 'countries from cache (cached at', new Date(entry.cachedAt).toLocaleString(), ')');
      return { data: entry.data, cachedAt: entry.cachedAt };
    }
  } catch (e) {
    console.error('[directoryCache] Failed to read cache:', e);
  }
  return { data: null, cachedAt: null };
}
