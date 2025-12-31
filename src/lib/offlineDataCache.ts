// Offline Data Cache for COMUNIDAD EX SOS
// Uses IndexedDB to cache earthquake data, user reports, and trips for offline access

import { get, set, createStore } from 'idb-keyval';
import type { USGSEarthquake, RoadReport } from '@/types';

const CACHE_STORE = createStore('exsos-cache', 'data');

// Cache keys
const EARTHQUAKE_CACHE_KEY = 'earthquakes';
const ROAD_REPORTS_CACHE_KEY = 'road_reports';
const MY_TRIPS_CACHE_KEY = 'my_trips';
const COMMUNITY_TRIPS_CACHE_KEY = 'community_trips';
const USER_LOCATIONS_CACHE_KEY = 'user_locations';
const AUTH_SESSION_CACHE_KEY = 'auth_session';
const LAST_SYNC_KEY = 'last_sync';

// Cache expiry (10 minutes for earthquakes for more frequent updates, 1 hour for reports)
const EARTHQUAKE_CACHE_EXPIRY_MS = 10 * 60 * 1000;
const REPORTS_CACHE_EXPIRY_MS = 60 * 60 * 1000;
const TRIPS_CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for trips
const USER_LOCATIONS_CACHE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes for locations
const AUTH_SESSION_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours for auth

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

// ============= TRIPS CACHE =============

/**
 * Cache my trips data
 */
export async function cacheMyTrips<T>(trips: T[]): Promise<void> {
  const entry: CacheEntry<T[]> = {
    data: trips,
    cachedAt: Date.now(),
  };
  await set(MY_TRIPS_CACHE_KEY, entry, CACHE_STORE);
}

/**
 * Get cached my trips
 */
export async function getCachedMyTrips<T>(): Promise<{
  data: T[];
  isCached: boolean;
  cachedAt: number | null;
}> {
  const entry = await get<CacheEntry<T[]>>(MY_TRIPS_CACHE_KEY, CACHE_STORE);
  
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
 * Check if my trips cache is fresh
 */
export async function isMyTripsCacheFresh(): Promise<boolean> {
  const entry = await get<CacheEntry<unknown[]>>(MY_TRIPS_CACHE_KEY, CACHE_STORE);
  
  if (!entry) return false;
  
  return Date.now() - entry.cachedAt < TRIPS_CACHE_EXPIRY_MS;
}

/**
 * Cache community trips data
 */
export async function cacheCommunityTrips<T>(trips: T[]): Promise<void> {
  const entry: CacheEntry<T[]> = {
    data: trips,
    cachedAt: Date.now(),
  };
  await set(COMMUNITY_TRIPS_CACHE_KEY, entry, CACHE_STORE);
}

/**
 * Get cached community trips
 */
export async function getCachedCommunityTrips<T>(): Promise<{
  data: T[];
  isCached: boolean;
  cachedAt: number | null;
}> {
  const entry = await get<CacheEntry<T[]>>(COMMUNITY_TRIPS_CACHE_KEY, CACHE_STORE);
  
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
 * Check if community trips cache is fresh
 */
export async function isCommunityTripsCacheFresh(): Promise<boolean> {
  const entry = await get<CacheEntry<unknown[]>>(COMMUNITY_TRIPS_CACHE_KEY, CACHE_STORE);
  
  if (!entry) return false;
  
  return Date.now() - entry.cachedAt < TRIPS_CACHE_EXPIRY_MS;
}

// ============= USER LOCATIONS CACHE =============

/**
 * Cache user locations data for instant display
 */
export async function cacheUserLocations<T>(locations: T[]): Promise<void> {
  const entry: CacheEntry<T[]> = {
    data: locations,
    cachedAt: Date.now(),
  };
  await set(USER_LOCATIONS_CACHE_KEY, entry, CACHE_STORE);
}

/**
 * Get cached user locations
 */
export async function getCachedUserLocations<T>(): Promise<{
  data: T[];
  isCached: boolean;
  cachedAt: number | null;
}> {
  const entry = await get<CacheEntry<T[]>>(USER_LOCATIONS_CACHE_KEY, CACHE_STORE);
  
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
 * Check if user locations cache is fresh
 */
export async function isUserLocationsCacheFresh(): Promise<boolean> {
  const entry = await get<CacheEntry<unknown[]>>(USER_LOCATIONS_CACHE_KEY, CACHE_STORE);
  
  if (!entry) return false;
  
  return Date.now() - entry.cachedAt < USER_LOCATIONS_CACHE_EXPIRY_MS;
}

// ============= AUTH SESSION CACHE =============

interface AuthCacheEntry {
  userId: string;
  profile: unknown;
  role: string | null;
  cachedAt: number;
}

/**
 * Cache auth session for instant recognition
 */
export async function cacheAuthSession(userId: string, profile: unknown, role: string | null): Promise<void> {
  const entry: AuthCacheEntry = {
    userId,
    profile,
    role,
    cachedAt: Date.now(),
  };
  await set(AUTH_SESSION_CACHE_KEY, entry, CACHE_STORE);
}

/**
 * Get cached auth session
 */
export async function getCachedAuthSession(): Promise<{
  userId: string;
  profile: unknown;
  role: string | null;
  cachedAt: number;
} | null> {
  const entry = await get<AuthCacheEntry>(AUTH_SESSION_CACHE_KEY, CACHE_STORE);
  
  if (!entry) return null;
  
  // Check if cache is still valid
  if (Date.now() - entry.cachedAt > AUTH_SESSION_CACHE_EXPIRY_MS) {
    return null;
  }
  
  return entry;
}

/**
 * Clear auth session cache (on logout)
 */
export async function clearAuthSessionCache(): Promise<void> {
  await set(AUTH_SESSION_CACHE_KEY, null, CACHE_STORE);
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
  hasMyTrips: boolean;
  hasCommunityTrips: boolean;
  hasUserLocations: boolean;
  lastSync: number | null;
}> {
  const earthquakeEntry = await get<CacheEntry<USGSEarthquake[]>>(EARTHQUAKE_CACHE_KEY, CACHE_STORE);
  const reportsEntry = await get<CacheEntry<RoadReport[]>>(ROAD_REPORTS_CACHE_KEY, CACHE_STORE);
  const myTripsEntry = await get<CacheEntry<unknown[]>>(MY_TRIPS_CACHE_KEY, CACHE_STORE);
  const communityTripsEntry = await get<CacheEntry<unknown[]>>(COMMUNITY_TRIPS_CACHE_KEY, CACHE_STORE);
  const userLocationsEntry = await get<CacheEntry<unknown[]>>(USER_LOCATIONS_CACHE_KEY, CACHE_STORE);
  const lastSync = await get<number>(LAST_SYNC_KEY, CACHE_STORE);

  return {
    hasEarthquakes: !!earthquakeEntry?.data?.length,
    hasReports: !!reportsEntry?.data?.length,
    hasMyTrips: !!myTripsEntry?.data?.length,
    hasCommunityTrips: !!communityTripsEntry?.data?.length,
    hasUserLocations: !!userLocationsEntry?.data?.length,
    lastSync: lastSync || null,
  };
}
