// GDACS + AEMET RSS Feeds Hook
// Integrates GDACS global alerts and AEMET Spain alerts

import { useState, useEffect, useCallback, useRef } from 'react';

// GDACS RSS Feed URLs
const GDACS_FEEDS = {
  all_24h: 'https://gdacs.org/xml/rss_24h.xml',
  all_7d: 'https://gdacs.org/xml/rss_7d.xml',
  eq_24h: 'https://gdacs.org/xml/rss_eq_24h.xml',
  eq_48h_low: 'https://gdacs.org/xml/rss_eq_48h_low.xml',
  eq_48h_med: 'https://gdacs.org/xml/rss_eq_48h_med.xml',
  tc_7d: 'https://gdacs.org/xml/rss_tc_7d.xml',
  fl_7d: 'https://gdacs.org/xml/rss_fl_7d.xml',
};

// AEMET RSS Feed URL
const AEMET_FEED = 'https://www.aemet.es/es/rss_info/avisos/esp';

// CORS proxy for fetching external feeds
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

export interface GDACSAlert {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category: 'earthquake' | 'cyclone' | 'flood' | 'volcano' | 'drought' | 'wildfire' | 'other';
  alertLevel?: 'green' | 'orange' | 'red';
  country?: string;
  coordinates?: [number, number];
  magnitude?: number;
  source: 'GDACS';
}

export interface AEMETAlert {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  zone?: string;
  level?: 'amarillo' | 'naranja' | 'rojo';
  source: 'AEMET';
}

export interface GDACSAlertsState {
  gdacsAlerts: GDACSAlert[];
  aemetAlerts: AEMETAlert[];
  loading: boolean;
  error: string | null;
  lastChecked: Date | null;
}

// Parse GDACS RSS feed
async function parseGDACSFeed(feedUrl: string): Promise<GDACSAlert[]> {
  try {
    const proxyUrl = CORS_PROXY + encodeURIComponent(feedUrl);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      console.warn(`[GDACS] Failed to fetch ${feedUrl}: ${response.status}`);
      return [];
    }
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      console.warn('[GDACS] XML parse error');
      return [];
    }
    
    const items = xml.querySelectorAll('item');
    const alerts: GDACSAlert[] = [];
    
    items.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const categoryEl = item.querySelector('category')?.textContent?.toLowerCase() || '';
      
      // Parse category from title or category element
      let category: GDACSAlert['category'] = 'other';
      const titleLower = title.toLowerCase();
      if (titleLower.includes('earthquake') || titleLower.includes('terremoto') || categoryEl.includes('eq')) {
        category = 'earthquake';
      } else if (titleLower.includes('cyclone') || titleLower.includes('typhoon') || titleLower.includes('hurricane') || categoryEl.includes('tc')) {
        category = 'cyclone';
      } else if (titleLower.includes('flood') || titleLower.includes('inundación') || categoryEl.includes('fl')) {
        category = 'flood';
      } else if (titleLower.includes('volcano') || titleLower.includes('volcán') || categoryEl.includes('vo')) {
        category = 'volcano';
      } else if (titleLower.includes('drought') || titleLower.includes('sequía') || categoryEl.includes('dr')) {
        category = 'drought';
      } else if (titleLower.includes('wildfire') || titleLower.includes('incendio') || categoryEl.includes('wf')) {
        category = 'wildfire';
      }
      
      // Parse alert level from title (Green, Orange, Red)
      let alertLevel: GDACSAlert['alertLevel'];
      if (titleLower.includes('red') || titleLower.includes('rojo')) {
        alertLevel = 'red';
      } else if (titleLower.includes('orange') || titleLower.includes('naranja')) {
        alertLevel = 'orange';
      } else if (titleLower.includes('green') || titleLower.includes('verde')) {
        alertLevel = 'green';
      }
      
      // Try to extract magnitude for earthquakes
      let magnitude: number | undefined;
      const magMatch = title.match(/M\s*([\d.]+)/i) || description.match(/magnitude\s*([\d.]+)/i);
      if (magMatch) {
        magnitude = parseFloat(magMatch[1]);
      }
      
      // Try to extract country
      let country: string | undefined;
      const countryMatch = title.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s*-|\s*$|,)/);
      if (countryMatch) {
        country = countryMatch[1].trim();
      }
      
      // Try to extract coordinates
      let coordinates: [number, number] | undefined;
      const geoLat = item.querySelector('geo\\:lat, lat')?.textContent;
      const geoLong = item.querySelector('geo\\:long, long')?.textContent;
      if (geoLat && geoLong) {
        coordinates = [parseFloat(geoLat), parseFloat(geoLong)];
      }
      
      alerts.push({
        id: `gdacs-${index}-${Date.now()}`,
        title: title.replace(/<[^>]*>/g, '').trim(),
        description: description.replace(/<[^>]*>/g, '').trim(),
        link,
        pubDate,
        category,
        alertLevel,
        country,
        coordinates,
        magnitude,
        source: 'GDACS',
      });
    });
    
    return alerts;
  } catch (error) {
    console.error('[GDACS] Error fetching feed:', error);
    return [];
  }
}

// Parse AEMET RSS feed
async function parseAEMETFeed(): Promise<AEMETAlert[]> {
  try {
    const proxyUrl = CORS_PROXY + encodeURIComponent(AEMET_FEED);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      console.warn(`[AEMET] Failed to fetch: ${response.status}`);
      return [];
    }
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      console.warn('[AEMET] XML parse error');
      return [];
    }
    
    const items = xml.querySelectorAll('item');
    const alerts: AEMETAlert[] = [];
    
    items.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      
      // Parse alert level from title
      let level: AEMETAlert['level'];
      const titleLower = title.toLowerCase();
      if (titleLower.includes('rojo')) {
        level = 'rojo';
      } else if (titleLower.includes('naranja')) {
        level = 'naranja';
      } else if (titleLower.includes('amarillo')) {
        level = 'amarillo';
      }
      
      // Extract zone from title
      let zone: string | undefined;
      const zoneMatch = title.match(/(?:en|para)\s+([^.]+)/i);
      if (zoneMatch) {
        zone = zoneMatch[1].trim();
      }
      
      alerts.push({
        id: `aemet-${index}-${Date.now()}`,
        title: title.replace(/<[^>]*>/g, '').trim(),
        description: description.replace(/<[^>]*>/g, '').trim(),
        link,
        pubDate,
        level,
        zone,
        source: 'AEMET',
      });
    });
    
    return alerts;
  } catch (error) {
    console.error('[AEMET] Error fetching feed:', error);
    return [];
  }
}

export function useGDACSAlerts() {
  const [state, setState] = useState<GDACSAlertsState>({
    gdacsAlerts: [],
    aemetAlerts: [],
    loading: false,
    error: null,
    lastChecked: null,
  });

  const fetchAlerts = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch all GDACS feeds in parallel
      const [
        all24h,
        tc7d,
        fl7d,
        aemetAlerts,
      ] = await Promise.all([
        parseGDACSFeed(GDACS_FEEDS.all_24h),
        parseGDACSFeed(GDACS_FEEDS.tc_7d),
        parseGDACSFeed(GDACS_FEEDS.fl_7d),
        parseAEMETFeed(),
      ]);

      // Combine and deduplicate GDACS alerts by title
      const allGDACS = [...all24h, ...tc7d, ...fl7d];
      const seenTitles = new Set<string>();
      const uniqueGDACS = allGDACS.filter(alert => {
        const key = alert.title.toLowerCase().substring(0, 50);
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      });

      // Sort by alert level (red > orange > green > undefined) then by date
      const levelOrder = { red: 0, orange: 1, green: 2 };
      uniqueGDACS.sort((a, b) => {
        const levelA = a.alertLevel ? levelOrder[a.alertLevel] : 3;
        const levelB = b.alertLevel ? levelOrder[b.alertLevel] : 3;
        if (levelA !== levelB) return levelA - levelB;
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      });

      setState({
        gdacsAlerts: uniqueGDACS,
        aemetAlerts,
        loading: false,
        error: null,
        lastChecked: new Date(),
      });
    } catch (error) {
      console.error('[GDACS/AEMET] Error fetching alerts:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Error al obtener alertas internacionales',
      }));
    }
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Helper functions
  const getCategoryIcon = (category: GDACSAlert['category']) => {
    switch (category) {
      case 'earthquake': return '🌍';
      case 'cyclone': return '🌀';
      case 'flood': return '🌊';
      case 'volcano': return '🌋';
      case 'drought': return '☀️';
      case 'wildfire': return '🔥';
      default: return '⚠️';
    }
  };

  const getCategoryLabel = (category: GDACSAlert['category']) => {
    switch (category) {
      case 'earthquake': return 'Terremoto';
      case 'cyclone': return 'Ciclón';
      case 'flood': return 'Inundación';
      case 'volcano': return 'Volcán';
      case 'drought': return 'Sequía';
      case 'wildfire': return 'Incendio';
      default: return 'Otro';
    }
  };

  const getAlertLevelColor = (level?: GDACSAlert['alertLevel']) => {
    switch (level) {
      case 'red': return 'text-destructive bg-destructive/10 border-destructive';
      case 'orange': return 'text-panic bg-panic/10 border-panic';
      case 'green': return 'text-success bg-success/10 border-success';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getAEMETLevelColor = (level?: AEMETAlert['level']) => {
    switch (level) {
      case 'rojo': return 'text-destructive bg-destructive/10 border-destructive';
      case 'naranja': return 'text-panic bg-panic/10 border-panic';
      case 'amarillo': return 'text-warning bg-warning/10 border-warning';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  return {
    ...state,
    refresh: fetchAlerts,
    getCategoryIcon,
    getCategoryLabel,
    getAlertLevelColor,
    getAEMETLevelColor,
  };
}
