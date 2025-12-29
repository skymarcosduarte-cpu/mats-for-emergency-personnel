// Resources Cache for offline access
// Uses IndexedDB to cache resources pack, favorites, and recent views

import { get, set, createStore } from 'idb-keyval';

const RESOURCES_STORE = createStore('exsos-resources', 'data');

// Cache keys
const RESOURCES_PACK_KEY = 'resources_pack';
const FAVORITES_KEY = 'resources_favorites';
const RECENTS_KEY = 'resources_recents';

const MAX_RECENTS = 10;

export interface ResourceCard {
  id: string;
  category: string;
  audience: 'publico' | 'personal_capacitado';
  level: 'basico' | 'intermedio';
  title: string;
  summary: string;
  doNow: string[];
  steps: string[];
  redFlags: string[];
  handover: string;
}

export interface ResourcesPack {
  packId: string;
  language: string;
  regionHint: string;
  version: string;
  disclaimer: string;
  cards: ResourceCard[];
}

interface CacheEntry {
  data: ResourcesPack;
  cachedAt: number;
}

/**
 * Cache the resources pack
 */
export async function cacheResourcesPack(pack: ResourcesPack): Promise<void> {
  const entry: CacheEntry = {
    data: pack,
    cachedAt: Date.now(),
  };
  await set(RESOURCES_PACK_KEY, entry, RESOURCES_STORE);
}

/**
 * Get cached resources pack
 */
export async function getCachedResourcesPack(): Promise<{
  data: ResourcesPack | null;
  isCached: boolean;
  cachedAt: number | null;
}> {
  const entry = await get<CacheEntry>(RESOURCES_PACK_KEY, RESOURCES_STORE);
  
  if (!entry) {
    return { data: null, isCached: false, cachedAt: null };
  }

  return {
    data: entry.data,
    isCached: true,
    cachedAt: entry.cachedAt,
  };
}

/**
 * Check if cached version matches
 */
export async function isCacheVersionMatch(version: string): Promise<boolean> {
  const entry = await get<CacheEntry>(RESOURCES_PACK_KEY, RESOURCES_STORE);
  
  if (!entry) return false;
  
  return entry.data.version === version;
}

/**
 * Get favorites
 */
export async function getFavorites(): Promise<string[]> {
  const favorites = await get<string[]>(FAVORITES_KEY, RESOURCES_STORE);
  return favorites || [];
}

/**
 * Add to favorites
 */
export async function addToFavorites(cardId: string): Promise<void> {
  const favorites = await getFavorites();
  if (!favorites.includes(cardId)) {
    favorites.push(cardId);
    await set(FAVORITES_KEY, favorites, RESOURCES_STORE);
  }
}

/**
 * Remove from favorites
 */
export async function removeFromFavorites(cardId: string): Promise<void> {
  const favorites = await getFavorites();
  const updated = favorites.filter(id => id !== cardId);
  await set(FAVORITES_KEY, updated, RESOURCES_STORE);
}

/**
 * Check if card is favorite
 */
export async function isFavorite(cardId: string): Promise<boolean> {
  const favorites = await getFavorites();
  return favorites.includes(cardId);
}

/**
 * Get recent views
 */
export async function getRecents(): Promise<string[]> {
  const recents = await get<string[]>(RECENTS_KEY, RESOURCES_STORE);
  return recents || [];
}

/**
 * Add to recents (keeps max 10, most recent first)
 */
export async function addToRecents(cardId: string): Promise<void> {
  const recents = await getRecents();
  // Remove if already exists
  const filtered = recents.filter(id => id !== cardId);
  // Add to front
  filtered.unshift(cardId);
  // Keep only max
  const trimmed = filtered.slice(0, MAX_RECENTS);
  await set(RECENTS_KEY, trimmed, RESOURCES_STORE);
}

/**
 * Get unique categories from cards
 */
export function getCategories(cards: ResourceCard[]): string[] {
  const categories = new Set(cards.map(card => card.category));
  return Array.from(categories).sort();
}

/**
 * Category labels for display
 */
export const CATEGORY_LABELS: Record<string, string> = {
  'comunidad_preparacion': 'Preparación',
  'comunicacion': 'Comunicación',
  'evacuacion': 'Evacuación',
  'seguridad': 'Seguridad',
  'amenazas': 'Amenazas',
  'primeros_auxilios': 'Primeros Auxilios',
  'salud_publica': 'Salud Pública',
  'salud_mental': 'Salud Mental',
  'comando_comunicacion': 'Comando',
  'mci_operaciones': 'MCI Operaciones',
  'mci_triage': 'Triage',
  'mci_lsi_trauma': 'LSI/Trauma',
  'trauma': 'Trauma',
  'medico': 'Médico',
  'refugio': 'Refugio',
  'refugio_wash': 'WASH',
};

/**
 * Get category label
 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}
