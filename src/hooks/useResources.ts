import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResourcesPack,
  ResourceCard,
  getCachedResourcesPack,
  cacheResourcesPack,
  isCacheVersionMatch,
  getFavorites,
  addToFavorites,
  removeFromFavorites,
  getRecents,
  addToRecents,
  getCategories,
} from '@/lib/resourcesCache';

export type AudienceFilter = 'all' | 'publico' | 'personal_capacitado';
export type LevelFilter = 'all' | 'basico' | 'intermedio';

export function useResources() {
  const [pack, setPack] = useState<ResourcesPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showRecentsOnly, setShowRecentsOnly] = useState(false);

  // Load resources pack
  useEffect(() => {
    async function loadResources() {
      try {
        setLoading(true);
        
        // Try to fetch fresh data first
        let freshPack: ResourcesPack | null = null;
        try {
          const response = await fetch('/resources_pack.json');
          if (response.ok) {
            freshPack = await response.json();
          }
        } catch (fetchError) {
          console.log('[Resources] Fetch failed, will try cache:', fetchError);
        }

        // Check if we need to update cache
        if (freshPack) {
          const versionMatch = await isCacheVersionMatch(freshPack.version);
          if (!versionMatch) {
            console.log('[Resources] Caching new version:', freshPack.version);
            await cacheResourcesPack(freshPack);
          }
          setPack(freshPack);
        } else {
          // Try to use cached data
          const cached = await getCachedResourcesPack();
          if (cached.data) {
            console.log('[Resources] Using cached data from:', new Date(cached.cachedAt || 0));
            setPack(cached.data);
          } else {
            setError('No hay datos disponibles. Conéctate a internet para descargar los recursos.');
          }
        }

        // Load favorites and recents
        const [favs, recs] = await Promise.all([getFavorites(), getRecents()]);
        setFavorites(favs);
        setRecents(recs);
        
      } catch (err) {
        console.error('[Resources] Error loading:', err);
        setError('Error al cargar los recursos');
      } finally {
        setLoading(false);
      }
    }

    loadResources();
  }, []);

  // Toggle favorite
  const toggleFavorite = useCallback(async (cardId: string) => {
    const isFav = favorites.includes(cardId);
    if (isFav) {
      await removeFromFavorites(cardId);
      setFavorites(prev => prev.filter(id => id !== cardId));
    } else {
      await addToFavorites(cardId);
      setFavorites(prev => [...prev, cardId]);
    }
  }, [favorites]);

  // Mark as viewed (add to recents)
  const markAsViewed = useCallback(async (cardId: string) => {
    await addToRecents(cardId);
    setRecents(prev => {
      const filtered = prev.filter(id => id !== cardId);
      return [cardId, ...filtered].slice(0, 10);
    });
  }, []);

  // Get categories list
  const categories = useMemo(() => {
    if (!pack) return [];
    return getCategories(pack.cards);
  }, [pack]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    if (!pack) return [];
    
    let cards = pack.cards;

    // Show only favorites
    if (showFavoritesOnly) {
      cards = cards.filter(card => favorites.includes(card.id));
    }

    // Show only recents
    if (showRecentsOnly) {
      cards = cards.filter(card => recents.includes(card.id));
      // Sort by recent order
      cards = cards.sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id));
    }

    // Category filter
    if (categoryFilter !== 'all') {
      cards = cards.filter(card => card.category === categoryFilter);
    }

    // Audience filter
    if (audienceFilter !== 'all') {
      cards = cards.filter(card => card.audience === audienceFilter);
    }

    // Level filter
    if (levelFilter !== 'all') {
      cards = cards.filter(card => card.level === levelFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      cards = cards.filter(card => 
        card.title.toLowerCase().includes(query) ||
        card.summary.toLowerCase().includes(query) ||
        card.doNow.some(item => item.toLowerCase().includes(query)) ||
        card.steps.some(item => item.toLowerCase().includes(query))
      );
    }

    return cards;
  }, [pack, searchQuery, categoryFilter, audienceFilter, levelFilter, showFavoritesOnly, showRecentsOnly, favorites, recents]);

  // Get card by ID
  const getCard = useCallback((cardId: string): ResourceCard | null => {
    if (!pack) return null;
    return pack.cards.find(card => card.id === cardId) || null;
  }, [pack]);

  return {
    pack,
    loading,
    error,
    favorites,
    recents,
    categories,
    filteredCards,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    audienceFilter,
    setAudienceFilter,
    levelFilter,
    setLevelFilter,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showRecentsOnly,
    setShowRecentsOnly,
    toggleFavorite,
    markAsViewed,
    getCard,
  };
}
