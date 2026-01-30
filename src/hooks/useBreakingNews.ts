// Hook to fetch breaking news from RSS feeds via edge function
// With localStorage caching for instant loading

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description?: string;
}

interface BreakingNewsState {
  items: NewsItem[];
  loading: boolean;
  error: string | null;
  fetchedAt: string | null;
}

interface CachedNews {
  items: NewsItem[];
  fetchedAt: string;
  cachedAt: number;
}

const CACHE_KEY = 'mats_breaking_news_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes - consider cache fresh
const STALE_TTL = 30 * 60 * 1000; // 30 minutes - show stale but refetch

function getCachedNews(): CachedNews | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCachedNews(items: NewsItem[], fetchedAt: string): void {
  try {
    const cache: CachedNews = {
      items,
      fetchedAt,
      cachedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[useBreakingNews] Failed to cache news:', e);
  }
}

export function useBreakingNews() {
  const [state, setState] = useState<BreakingNewsState>(() => {
    // Initialize from cache immediately
    const cached = getCachedNews();
    if (cached && cached.items.length > 0) {
      const age = Date.now() - cached.cachedAt;
      return {
        items: cached.items,
        loading: age > CACHE_TTL, // Only show loading if cache is stale
        error: null,
        fetchedAt: cached.fetchedAt,
      };
    }
    return {
      items: [],
      loading: true,
      error: null,
      fetchedAt: null,
    };
  });

  const fetchingRef = useRef(false);

  const fetchNews = useCallback(async (showLoading = true) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (showLoading) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-rss-news');
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data?.success && data?.items) {
        // Cache the results
        setCachedNews(data.items, data.fetchedAt);
        
        setState({
          items: data.items,
          loading: false,
          error: null,
          fetchedAt: data.fetchedAt,
        });
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching breaking news:', err);
      // Only show error if we don't have cached data
      setState(prev => ({
        ...prev,
        loading: false,
        error: prev.items.length === 0 
          ? (err instanceof Error ? err.message : 'Error al cargar noticias')
          : null,
      }));
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Initial fetch - check if cache is fresh or needs refresh
  useEffect(() => {
    const cached = getCachedNews();
    if (cached) {
      const age = Date.now() - cached.cachedAt;
      if (age < CACHE_TTL) {
        // Cache is fresh, no need to fetch
        return;
      }
      if (age < STALE_TTL) {
        // Cache is stale but usable, fetch in background without loading indicator
        fetchNews(false);
        return;
      }
    }
    // No cache or very old, fetch with loading indicator
    fetchNews(true);
  }, [fetchNews]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchNews(false), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  return {
    ...state,
    refresh: () => fetchNews(true),
  };
}
