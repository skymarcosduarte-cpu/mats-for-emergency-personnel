// Offline Data Cache for COMUNIDAD EX SOS
// Uses IndexedDB to cache earthquake data and user reports for offline access

import { get, set, createStore } from 'idb-keyval';
import type { USGSEarthquake, RoadReport } from '@/types';

const CACHE_STORE = createStore('exsos-cache', 'data');

// Cache keys
const EARTHQUAKE_CACHE_KEY = 'earthquakes';
const ROAD_REPORTS_CACHE_KEY = 'road_reports';
const LAST_SYNC_KEY = 'last_sync';

// Cache expiry (30 minutes for earthquakes, 1 hour for reports)
const EARTHQUAKE_CACHE_EXPIRY_MS = 30 * 60 * 1000;
const REPORTS_CACHE_EXPIRY_MS = 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

/**
 * Cache earthquake data
 */
export async function cacheEarthquakes(earthquakes: USGSEarthquake[]): Promise<void> {
  const entry: CacheEntry<USGSEarthquake[]> = {
    data: earthquakes,
    cachedAt: Date.now(),
  };
  await set(EARTHQUAKE_CACHE_KEY, entry, CACHE_STORE);
}

/**
 * Get cached earthquakes
 */
export async function getCachedEarthquakes(): Promise<{
  data: USGSEarthquake[];
  isCached: boolean;
  cachedAt: number | null;
}> {
  const entry = await get<CacheEntry<USGSEarthquake[]>>(EARTHQUAKE_CACHE_KEY, CACHE_STORE);
  
  if (!entry) {
    return { data: [], isCached: false, cachedAt: null };
  }

  return {
    data: entry.data,
    isCached: true,
    cachedAt: entry.cachedAt,
  };
}

/**
 * Check if earthquake cache is fresh
 */
export async function isEarthquakeCacheFresh(): Promise<boolean> {
  const entry = await get<CacheEntry<USGSEarthquake[]>>(EARTHQUAKE_CACHE_KEY, CACHE_STORE);
  
  if (!entry) return false;
  
  return Date.now() - entry.cachedAt < EARTHQUAKE_CACHE_EXPIRY_MS;
}

/**
 * Cache road reports
 */
export async function cacheRoadReports(reports: RoadReport[]): Promise<void> {
  const entry: CacheEntry<RoadReport[]> = {
    data: reports,
    cachedAt: Date.now(),
  };
  await set(ROAD_REPORTS_CACHE_KEY, entry, CACHE_STORE);
}

/**
 * Get cached road reports
 */
export async function getCachedRoadReports(): Promise<{
  data: RoadReport[];
  isCached: boolean;
  cachedAt: number | null;
}> {
  const entry = await get<CacheEntry<RoadReport[]>>(ROAD_REPORTS_CACHE_KEY, CACHE_STORE);
  
  if (!entry) {
    return { data: [], isCached: false, cachedAt: null };
  }

  return {
    data: entry.data,
    isCached: true,
    cachedAt: entry.cachedAt,
  };
}

/**
 * Check if road reports cache is fresh
 */
export async function isRoadReportsCacheFresh(): Promise<boolean> {
  const entry = await get<CacheEntry<RoadReport[]>>(ROAD_REPORTS_CACHE_KEY, CACHE_STORE);
  
  if (!entry) return false;
  
  return Date.now() - entry.cachedAt < REPORTS_CACHE_EXPIRY_MS;
}

/**
 * Update last sync timestamp
 */
export async function updateLastSync(): Promise<void> {
  await set(LAST_SYNC_KEY, Date.now(), CACHE_STORE);
}

/**
 * Get last sync timestamp
 */
export async function getLastSync(): Promise<number | null> {
  return await get<number>(LAST_SYNC_KEY, CACHE_STORE);
}

/**
 * Get cache status for display
 */
export async function getCacheStatus(): Promise<{
  hasEarthquakes: boolean;
  hasReports: boolean;
  lastSync: number | null;
}> {
  const earthquakeEntry = await get<CacheEntry<USGSEarthquake[]>>(EARTHQUAKE_CACHE_KEY, CACHE_STORE);
  const reportsEntry = await get<CacheEntry<RoadReport[]>>(ROAD_REPORTS_CACHE_KEY, CACHE_STORE);
  const lastSync = await get<number>(LAST_SYNC_KEY, CACHE_STORE);

  return {
    hasEarthquakes: !!earthquakeEntry?.data?.length,
    hasReports: !!reportsEntry?.data?.length,
    lastSync: lastSync || null,
  };
}
