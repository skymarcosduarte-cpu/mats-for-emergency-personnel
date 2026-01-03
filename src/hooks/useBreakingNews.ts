// Hook to fetch breaking news from RSS feeds via edge function

import { useState, useEffect, useCallback } from 'react';
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

export function useBreakingNews() {
  const [state, setState] = useState<BreakingNewsState>({
    items: [],
    loading: true,
    error: null,
    fetchedAt: null,
  });

  const fetchNews = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-rss-news');
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data?.success && data?.items) {
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
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Error al cargar noticias',
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(fetchNews, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  return {
    ...state,
    refresh: fetchNews,
  };
}
