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
 * Category labels and icons for display
 */
export const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  'comunidad_preparacion': { label: 'Preparación', icon: '🏠' },
  'comunicacion': { label: 'Comunicación', icon: '📞' },
  'evacuacion': { label: 'Evacuación', icon: '🚨' },
  'seguridad': { label: 'Seguridad', icon: '🛡️' },
  'amenazas': { label: 'Amenazas', icon: '⚠️' },
  'primeros_auxilios': { label: 'Primeros Auxilios', icon: '🩹' },
  'salud_publica': { label: 'Salud Pública', icon: '🏥' },
  'salud_mental': { label: 'Salud Mental', icon: '🧠' },
  'comando_comunicacion': { label: 'Comando', icon: '📡' },
  'mci_operaciones': { label: 'MCI Operaciones', icon: '🚒' },
  'mci_triage': { label: 'Triage', icon: '🏷️' },
  'mci_lsi_trauma': { label: 'LSI/Trauma', icon: '🩸' },
  'trauma': { label: 'Trauma', icon: '🚑' },
  'medico': { label: 'Médico', icon: '⚕️' },
  'refugio': { label: 'Refugio', icon: '🏕️' },
  'refugio_wash': { label: 'WASH', icon: '🚿' },
  'sci_mando': { label: 'SCI Mando', icon: '👮' },
  'sci_planificacion': { label: 'SCI Planificación', icon: '📋' },
  'sci_logistica': { label: 'SCI Logística', icon: '📦' },
  'seguridad_operativa': { label: 'Seguridad Operativa', icon: '🦺' },
  'proteccion_vulnerable': { label: 'Protección Vulnerable', icon: '👶' },
  'violencia_crisis': { label: 'Violencia/Crisis', icon: '🆘' },
  'conflicto_social': { label: 'Conflicto Social', icon: '⚡' },
};

// Backwards compatibility
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([key, val]) => [key, val.label])
);

/**
 * Get category label
 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_CONFIG[category]?.label || category;
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: string): string {
  return CATEGORY_CONFIG[category]?.icon || '📄';
}

/**
 * Get category counts from cards
 */
export function getCategoryCounts(cards: ResourceCard[]): Record<string, number> {
  return cards.reduce((acc, card) => {
    acc[card.category] = (acc[card.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
