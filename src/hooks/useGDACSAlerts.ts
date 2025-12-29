// Multi-source International Alerts Hook
// Integrates GDACS, AEMET, CONAGUA, NASA EONET, ReliefWeb, and other sources

import { useState, useEffect, useCallback, useRef } from 'react';

// GDACS RSS Feed URLs
const GDACS_FEEDS = {
  all_24h: 'https://gdacs.org/xml/rss_24h.xml',
  all_7d: 'https://gdacs.org/xml/rss_7d.xml',
  tc_7d: 'https://gdacs.org/xml/rss_tc_7d.xml',
  fl_7d: 'https://gdacs.org/xml/rss_fl_7d.xml',
};

// Additional RSS Feed URLs from fuentes_otras.json
const ADDITIONAL_FEEDS = {
  conagua: 'https://smn.conagua.gob.mx/rss/avisos.xml',
  nasa_eonet: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20',
  reliefweb: 'https://reliefweb.int/updates/rss.xml',
  aemet: 'https://www.aemet.es/es/rss_info/avisos/esp',
};

// CORS proxy for fetching external feeds
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

export interface GDACSAlert {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category: 'earthquake' | 'cyclone' | 'flood' | 'volcano' | 'drought' | 'wildfire' | 'weather' | 'security' | 'humanitarian' | 'other';
  alertLevel?: 'green' | 'orange' | 'red';
  country?: string;
  coordinates?: [number, number];
  magnitude?: number;
  source: 'GDACS' | 'CONAGUA' | 'NASA' | 'ReliefWeb' | 'Interpol' | 'ERCC';
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

// Fetch with CORS proxy fallback
async function fetchWithCorsProxy(url: string): Promise<Response | null> {
  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = proxy + encodeURIComponent(url);
      const response = await fetch(proxyUrl, { 
        signal: AbortSignal.timeout(15000) 
      });
      if (response.ok) {
        return response;
      }
    } catch (error) {
      console.warn(`[Proxy ${proxy}] Failed for ${url}`);
    }
  }
  return null;
}

// Parse GDACS RSS feed
async function parseGDACSFeed(feedUrl: string): Promise<GDACSAlert[]> {
  try {
    const response = await fetchWithCorsProxy(feedUrl);
    if (!response) {
      console.warn(`[GDACS] Failed to fetch ${feedUrl}`);
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
      
      // Parse category
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
      
      // Parse alert level
      let alertLevel: GDACSAlert['alertLevel'];
      if (titleLower.includes('red') || titleLower.includes('rojo')) {
        alertLevel = 'red';
      } else if (titleLower.includes('orange') || titleLower.includes('naranja')) {
        alertLevel = 'orange';
      } else if (titleLower.includes('green') || titleLower.includes('verde')) {
        alertLevel = 'green';
      }
      
      // Extract magnitude for earthquakes
      let magnitude: number | undefined;
      const magMatch = title.match(/M\s*([\d.]+)/i) || description.match(/magnitude\s*([\d.]+)/i);
      if (magMatch) {
        magnitude = parseFloat(magMatch[1]);
      }
      
      // Extract country
      let country: string | undefined;
      const countryMatch = title.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s*-|\s*$|,)/);
      if (countryMatch) {
        country = countryMatch[1].trim();
      }
      
      // Extract coordinates
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

// Parse CONAGUA RSS feed (Mexico weather alerts)
async function parseCONAGUAFeed(): Promise<GDACSAlert[]> {
  try {
    const response = await fetchWithCorsProxy(ADDITIONAL_FEEDS.conagua);
    if (!response) {
      console.warn('[CONAGUA] Failed to fetch');
      return [];
    }
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      console.warn('[CONAGUA] XML parse error');
      return [];
    }
    
    const items = xml.querySelectorAll('item');
    const alerts: GDACSAlert[] = [];
    
    items.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
      
      // Determine category from content
      let category: GDACSAlert['category'] = 'weather';
      const titleLower = title.toLowerCase();
      if (titleLower.includes('huracán') || titleLower.includes('ciclón') || titleLower.includes('tormenta tropical')) {
        category = 'cyclone';
      } else if (titleLower.includes('lluvia') || titleLower.includes('inundación')) {
        category = 'flood';
      }
      
      // Determine alert level
      let alertLevel: GDACSAlert['alertLevel'];
      if (titleLower.includes('rojo') || titleLower.includes('extremo') || titleLower.includes('mayor')) {
        alertLevel = 'red';
      } else if (titleLower.includes('naranja') || titleLower.includes('alto')) {
        alertLevel = 'orange';
      } else {
        alertLevel = 'green';
      }
      
      alerts.push({
        id: `conagua-${index}-${Date.now()}`,
        title: title.replace(/<[^>]*>/g, '').trim(),
        description: description.replace(/<[^>]*>/g, '').trim(),
        link,
        pubDate,
        category,
        alertLevel,
        country: 'México',
        source: 'CONAGUA',
      });
    });
    
    return alerts;
  } catch (error) {
    console.error('[CONAGUA] Error fetching feed:', error);
    return [];
  }
}

// Parse NASA EONET API (natural events)
async function parseNASAEONET(): Promise<GDACSAlert[]> {
  try {
    const response = await fetchWithCorsProxy(ADDITIONAL_FEEDS.nasa_eonet);
    if (!response) {
      console.warn('[NASA EONET] Failed to fetch');
      return [];
    }
    
    const data = await response.json();
    const alerts: GDACSAlert[] = [];
    
    if (data.events && Array.isArray(data.events)) {
      data.events.forEach((event: any, index: number) => {
        // Map NASA category to our categories
        let category: GDACSAlert['category'] = 'other';
        const categoryId = event.categories?.[0]?.id || '';
        
        if (categoryId === 'wildfires') category = 'wildfire';
        else if (categoryId === 'volcanoes') category = 'volcano';
        else if (categoryId === 'severeStorms') category = 'cyclone';
        else if (categoryId === 'floods') category = 'flood';
        else if (categoryId === 'drought') category = 'drought';
        else if (categoryId === 'earthquakes') category = 'earthquake';
        
        // Get coordinates from geometry
        let coordinates: [number, number] | undefined;
        const geometry = event.geometry?.[0];
        if (geometry?.coordinates) {
          coordinates = [geometry.coordinates[1], geometry.coordinates[0]]; // [lat, lng]
        }
        
        alerts.push({
          id: `nasa-${event.id || index}-${Date.now()}`,
          title: event.title || 'NASA EONET Event',
          description: `Categoría: ${event.categories?.[0]?.title || 'Evento natural'}. Fuente: ${event.sources?.[0]?.id || 'NASA'}`,
          link: event.sources?.[0]?.url || 'https://eonet.gsfc.nasa.gov/',
          pubDate: geometry?.date || new Date().toISOString(),
          category,
          alertLevel: 'orange',
          coordinates,
          source: 'NASA',
        });
      });
    }
    
    return alerts;
  } catch (error) {
    console.error('[NASA EONET] Error fetching:', error);
    return [];
  }
}

// Parse ReliefWeb RSS feed (humanitarian alerts)
async function parseReliefWebFeed(): Promise<GDACSAlert[]> {
  try {
    const response = await fetchWithCorsProxy(ADDITIONAL_FEEDS.reliefweb);
    if (!response) {
      console.warn('[ReliefWeb] Failed to fetch');
      return [];
    }
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    
    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      console.warn('[ReliefWeb] XML parse error');
      return [];
    }
    
    const items = xml.querySelectorAll('item');
    const alerts: GDACSAlert[] = [];
    
    // Only take latest 10 items
    const itemsArray = Array.from(items).slice(0, 10);
    
    itemsArray.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
      
      // Determine category from content
      let category: GDACSAlert['category'] = 'humanitarian';
      const titleLower = title.toLowerCase();
      if (titleLower.includes('earthquake') || titleLower.includes('terremoto')) {
        category = 'earthquake';
      } else if (titleLower.includes('flood') || titleLower.includes('inundación')) {
        category = 'flood';
      } else if (titleLower.includes('conflict') || titleLower.includes('crisis') || titleLower.includes('emergency')) {
        category = 'security';
      }
      
      alerts.push({
        id: `reliefweb-${index}-${Date.now()}`,
        title: title.replace(/<[^>]*>/g, '').trim(),
        description: description.replace(/<[^>]*>/g, '').substring(0, 300).trim(),
        link,
        pubDate,
        category,
        alertLevel: 'orange',
        source: 'ReliefWeb',
      });
    });
    
    return alerts;
  } catch (error) {
    console.error('[ReliefWeb] Error fetching feed:', error);
    return [];
  }
}

// Parse AEMET RSS feed
async function parseAEMETFeed(): Promise<AEMETAlert[]> {
  try {
    const response = await fetchWithCorsProxy(ADDITIONAL_FEEDS.aemet);
    if (!response) {
      console.warn('[AEMET] Failed to fetch');
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

interface UseGDACSAlertsOptions {
  onNewRedAlert?: (alert: GDACSAlert) => void;
}

export function useGDACSAlerts(options?: UseGDACSAlertsOptions) {
  const [state, setState] = useState<GDACSAlertsState>({
    gdacsAlerts: [],
    aemetAlerts: [],
    loading: false,
    error: null,
    lastChecked: null,
  });

  // Track already notified red alerts to avoid duplicates
  const notifiedRedAlertsRef = useRef<Set<string>>(new Set());

  const fetchAlerts = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch all feeds in parallel
      const [
        gdacs24h,
        gdacsTc,
        gdacsFl,
        conaguaAlerts,
        nasaAlerts,
        reliefwebAlerts,
        aemetAlerts,
      ] = await Promise.all([
        parseGDACSFeed(GDACS_FEEDS.all_24h),
        parseGDACSFeed(GDACS_FEEDS.tc_7d),
        parseGDACSFeed(GDACS_FEEDS.fl_7d),
        parseCONAGUAFeed(),
        parseNASAEONET(),
        parseReliefWebFeed(),
        parseAEMETFeed(),
      ]);

      // Combine all alerts
      const allAlerts = [
        ...gdacs24h,
        ...gdacsTc,
        ...gdacsFl,
        ...conaguaAlerts,
        ...nasaAlerts,
        ...reliefwebAlerts,
      ];
      
      // Deduplicate by title
      const seenTitles = new Set<string>();
      const uniqueAlerts = allAlerts.filter(alert => {
        const key = alert.title.toLowerCase().substring(0, 50);
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      });

      // Check for new red alerts and notify
      if (options?.onNewRedAlert) {
        const redAlerts = uniqueAlerts.filter(alert => alert.alertLevel === 'red');
        for (const alert of redAlerts) {
          // Create a stable key based on title (first 50 chars)
          const alertKey = alert.title.toLowerCase().substring(0, 50);
          if (!notifiedRedAlertsRef.current.has(alertKey)) {
            notifiedRedAlertsRef.current.add(alertKey);
            console.log('[Alerts] New RED alert detected:', alert.title);
            options.onNewRedAlert(alert);
          }
        }
      }

      // Sort by alert level (red > orange > green > undefined) then by date
      const levelOrder = { red: 0, orange: 1, green: 2 };
      uniqueAlerts.sort((a, b) => {
        const levelA = a.alertLevel ? levelOrder[a.alertLevel] : 3;
        const levelB = b.alertLevel ? levelOrder[b.alertLevel] : 3;
        if (levelA !== levelB) return levelA - levelB;
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      });

      console.log(`[Alerts] Fetched: GDACS=${gdacs24h.length + gdacsTc.length + gdacsFl.length}, CONAGUA=${conaguaAlerts.length}, NASA=${nasaAlerts.length}, ReliefWeb=${reliefwebAlerts.length}, AEMET=${aemetAlerts.length}`);

      setState({
        gdacsAlerts: uniqueAlerts,
        aemetAlerts,
        loading: false,
        error: null,
        lastChecked: new Date(),
      });
    } catch (error) {
      console.error('[Alerts] Error fetching:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Error al obtener alertas internacionales',
      }));
    }
  }, [options?.onNewRedAlert]);

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
      case 'weather': return '🌤️';
      case 'security': return '🛡️';
      case 'humanitarian': return '🆘';
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
      case 'weather': return 'Clima';
      case 'security': return 'Seguridad';
      case 'humanitarian': return 'Humanitario';
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

  const getSourceColor = (source: GDACSAlert['source']) => {
    switch (source) {
      case 'GDACS': return 'border-primary text-primary';
      case 'CONAGUA': return 'border-success text-success';
      case 'NASA': return 'border-blue-500 text-blue-500';
      case 'ReliefWeb': return 'border-orange-500 text-orange-500';
      default: return 'border-muted-foreground text-muted-foreground';
    }
  };

  return {
    ...state,
    refresh: fetchAlerts,
    getCategoryIcon,
    getCategoryLabel,
    getAlertLevelColor,
    getAEMETLevelColor,
    getSourceColor,
  };
}
