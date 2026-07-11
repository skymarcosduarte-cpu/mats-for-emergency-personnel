// Multi-source International Alerts Hook
// Fetches hazard feeds via backend edge function to avoid CORS issues

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GDACSAlert {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category: 'earthquake' | 'cyclone' | 'flood' | 'volcano' | 'drought' | 'wildfire' | 'weather' | 'security' | 'humanitarian' | 'other' | 'tsunami';
  alertLevel?: 'green' | 'orange' | 'red';
  country?: string;
  coordinates?: [number, number];
  magnitude?: number;
  source: 'GDACS' | 'CONAGUA' | 'NASA' | 'ReliefWeb' | 'Interpol' | 'ERCC' | 'NOAA-Tsunami' | 'USGS-Volcano' | 'GDELT';
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

// ─── XML Parsers ───

function parseGDACSXml(xmlText: string, feedKey: string): GDACSAlert[] {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    if (xml.querySelector('parsererror')) return [];

    const items = xml.querySelectorAll('item');
    const alerts: GDACSAlert[] = [];

    items.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const categoryEl = item.querySelector('category')?.textContent?.toLowerCase() || '';
      const titleLower = title.toLowerCase();

      let category: GDACSAlert['category'] = 'other';
      if (titleLower.includes('earthquake') || titleLower.includes('terremoto') || categoryEl.includes('eq')) category = 'earthquake';
      else if (titleLower.includes('cyclone') || titleLower.includes('typhoon') || titleLower.includes('hurricane') || categoryEl.includes('tc')) category = 'cyclone';
      else if (titleLower.includes('flood') || titleLower.includes('inundación') || categoryEl.includes('fl')) category = 'flood';
      else if (titleLower.includes('volcano') || titleLower.includes('volcán') || categoryEl.includes('vo')) category = 'volcano';
      else if (titleLower.includes('drought') || titleLower.includes('sequía') || categoryEl.includes('dr')) category = 'drought';
      else if (titleLower.includes('wildfire') || titleLower.includes('incendio') || categoryEl.includes('wf')) category = 'wildfire';

      let alertLevel: GDACSAlert['alertLevel'];
      if (titleLower.includes('red') || titleLower.includes('rojo')) alertLevel = 'red';
      else if (titleLower.includes('orange') || titleLower.includes('naranja')) alertLevel = 'orange';
      else if (titleLower.includes('green') || titleLower.includes('verde')) alertLevel = 'green';

      let magnitude: number | undefined;
      const magMatch = title.match(/M\s*([\d.]+)/i) || description.match(/magnitude\s*([\d.]+)/i);
      if (magMatch) magnitude = parseFloat(magMatch[1]);

      let country: string | undefined;
      const countryMatch = title.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s*-|\s*$|,)/);
      if (countryMatch) country = countryMatch[1].trim();

      let coordinates: [number, number] | undefined;
      const geoLat = item.querySelector('geo\\:lat, lat')?.textContent;
      const geoLong = item.querySelector('geo\\:long, long')?.textContent;
      if (geoLat && geoLong) {
        coordinates = [parseFloat(geoLat), parseFloat(geoLong)];
      }

      alerts.push({
        id: `gdacs-${feedKey}-${index}`,
        title: title.replace(/<[^>]*>/g, '').trim(),
        description: description.replace(/<[^>]*>/g, '').trim(),
        link, pubDate, category, alertLevel, country, coordinates, magnitude,
        source: 'GDACS',
      });
    });
    return alerts;
  } catch { return []; }
}

function parseCONAGUAXml(xmlText: string): GDACSAlert[] {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    if (xml.querySelector('parsererror')) return [];

    const alerts: GDACSAlert[] = [];
    xml.querySelectorAll('item').forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
      const titleLower = title.toLowerCase();

      let category: GDACSAlert['category'] = 'weather';
      if (titleLower.includes('huracán') || titleLower.includes('ciclón') || titleLower.includes('tormenta tropical')) category = 'cyclone';
      else if (titleLower.includes('lluvia') || titleLower.includes('inundación')) category = 'flood';

      let alertLevel: GDACSAlert['alertLevel'] = 'green';
      if (titleLower.includes('rojo') || titleLower.includes('extremo') || titleLower.includes('mayor')) alertLevel = 'red';
      else if (titleLower.includes('naranja') || titleLower.includes('alto')) alertLevel = 'orange';

      alerts.push({
        id: `conagua-${index}`,
        title: title.replace(/<[^>]*>/g, '').trim(),
        description: description.replace(/<[^>]*>/g, '').trim(),
        link, pubDate, category, alertLevel, country: 'México',
        source: 'CONAGUA',
      });
    });
    return alerts;
  } catch { return []; }
}

function parseNASAEONETJson(jsonText: string): GDACSAlert[] {
  try {
    const data = JSON.parse(jsonText);
    if (!data.events || !Array.isArray(data.events)) return [];

    return data.events.map((event: any, index: number) => {
      const categoryId = event.categories?.[0]?.id || '';
      let category: GDACSAlert['category'] = 'other';
      if (categoryId === 'wildfires') category = 'wildfire';
      else if (categoryId === 'volcanoes') category = 'volcano';
      else if (categoryId === 'severeStorms') category = 'cyclone';
      else if (categoryId === 'floods') category = 'flood';
      else if (categoryId === 'earthquakes') category = 'earthquake';

      let coordinates: [number, number] | undefined;
      const geometry = event.geometry?.[0];
      if (geometry?.coordinates) coordinates = [geometry.coordinates[1], geometry.coordinates[0]];

      return {
        id: `nasa-${event.id || index}`,
        title: event.title || 'NASA EONET Event',
        description: `Categoría: ${event.categories?.[0]?.title || 'Evento natural'}. Fuente: ${event.sources?.[0]?.id || 'NASA'}`,
        link: event.sources?.[0]?.url || 'https://eonet.gsfc.nasa.gov/',
        pubDate: geometry?.date || new Date().toISOString(),
        category, alertLevel: 'orange' as const, coordinates,
        source: 'NASA' as const,
      };
    });
  } catch { return []; }
}

function parseReliefWebXml(xmlText: string): GDACSAlert[] {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    if (xml.querySelector('parsererror')) return [];

    const alerts: GDACSAlert[] = [];
    Array.from(xml.querySelectorAll('item')).slice(0, 10).forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
      const titleLower = title.toLowerCase();

      let category: GDACSAlert['category'] = 'humanitarian';
      if (titleLower.includes('earthquake') || titleLower.includes('terremoto')) category = 'earthquake';
      else if (titleLower.includes('flood') || titleLower.includes('inundación')) category = 'flood';
      else if (titleLower.includes('conflict') || titleLower.includes('crisis') || titleLower.includes('emergency')) category = 'security';

      alerts.push({
        id: `reliefweb-${index}`,
        title: title.replace(/<[^>]*>/g, '').trim(),
        description: description.replace(/<[^>]*>/g, '').substring(0, 300).trim(),
        link, pubDate, category, alertLevel: 'orange',
        source: 'ReliefWeb',
      });
    });
    return alerts;
  } catch { return []; }
}

function parseTsunamiXml(xmlText: string, basin: string): GDACSAlert[] {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    if (xml.querySelector('parsererror')) return [];

    const alerts: GDACSAlert[] = [];
    xml.querySelectorAll('item').forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const titleLower = title.toLowerCase();

      if (titleLower.includes('test') || titleLower.includes('no advisory') || titleLower.includes('cancellation')) return;

      let alertLevel: GDACSAlert['alertLevel'] = 'orange';
      if (titleLower.includes('warning')) alertLevel = 'red';
      else if (titleLower.includes('watch')) alertLevel = 'orange';
      else if (titleLower.includes('advisory') || titleLower.includes('information')) alertLevel = 'green';

      let coordinates: [number, number] | undefined;
      const coordMatch = description.match(/(\d+\.?\d*)[°\s]*([NS])[,\s]+(\d+\.?\d*)[°\s]*([EW])/i);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]) * (coordMatch[2].toUpperCase() === 'S' ? -1 : 1);
        const lng = parseFloat(coordMatch[3]) * (coordMatch[4].toUpperCase() === 'W' ? -1 : 1);
        if (!isNaN(lat) && !isNaN(lng)) coordinates = [lat, lng];
      }

      alerts.push({
        id: `tsunami-${basin}-${index}`,
        title: title.replace(/<[^>]*>/g, '').trim(),
        description: description.replace(/<[^>]*>/g, '').substring(0, 400).trim(),
        link, pubDate, category: 'tsunami', alertLevel, coordinates,
        source: 'NOAA-Tsunami',
      });
    });
    return alerts;
  } catch { return []; }
}

function parseUSGSVolcanoXml(xmlText: string): GDACSAlert[] {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    if (xml.querySelector('parsererror')) return [];

    const alerts: GDACSAlert[] = [];
    Array.from(xml.querySelectorAll('item')).slice(0, 15).forEach((item, index) => {
      const title = item.querySelector('title')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const titleLower = title.toLowerCase();

      if (!titleLower.includes('volcano') && !titleLower.includes('eruption') && !titleLower.includes('lava') && !titleLower.includes('ash')) return;

      let alertLevel: GDACSAlert['alertLevel'] = 'green';
      if (titleLower.includes('red') || titleLower.includes('eruption') || titleLower.includes('erupting')) alertLevel = 'red';
      else if (titleLower.includes('orange') || titleLower.includes('elevated')) alertLevel = 'orange';

      alerts.push({
        id: `usgs-volcano-${index}`,
        title: title.replace(/<[^>]*>/g, '').trim(),
        description: description.replace(/<[^>]*>/g, '').substring(0, 400).trim(),
        link, pubDate, category: 'volcano', alertLevel,
        source: 'USGS-Volcano',
      });
    });
    return alerts;
  } catch { return []; }
}

function parseGDELTArticles(jsonText: string): GDACSAlert[] {
  try {
    const data = JSON.parse(jsonText);
    const articles = data.articles || [];
    if (!Array.isArray(articles) || articles.length === 0) return [];

    return articles.slice(0, 15).map((article: any, index: number) => {
      const title = article.title || 'Conflict Event';
      const url = article.url || '';
      const domain = article.domain || '';
      const seenDate = article.seendate || '';
      const lang = article.language || '';
      const socialImage = article.socialimage || '';

      const titleLower = title.toLowerCase();
      let alertLevel: GDACSAlert['alertLevel'] = 'orange';
      if (titleLower.includes('bombing') || titleLower.includes('airstrike') || titleLower.includes('terrorism') || titleLower.includes('massacre')) {
        alertLevel = 'red';
      } else if (titleLower.includes('shooting') || titleLower.includes('explosion') || titleLower.includes('attack')) {
        alertLevel = 'orange';
      }

      // Extract country from title
      let country: string | undefined;
      const countryMatch = title.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\s*[-–|,:.!]|\s*$)/);
      if (countryMatch) country = countryMatch[1].trim();

      // Parse seendate "20260301T162900Z" format
      let pubDate = new Date().toISOString();
      if (seenDate) {
        try {
          const cleaned = seenDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
          pubDate = new Date(cleaned).toISOString();
        } catch {}
      }

      return {
        id: `gdelt-${index}-${seenDate || Date.now()}`,
        title: title.replace(/<[^>]*>/g, '').substring(0, 120).trim(),
        description: `Fuente: ${domain}. Evento de seguridad/conflicto reportado en medios internacionales.`,
        link: url,
        pubDate,
        category: 'security' as const,
        alertLevel,
        country,
        coordinates: undefined, // artlist format doesn't include coordinates
        source: 'GDELT' as const,
      };
    });
  } catch (e) {
    console.warn('[Alerts] Failed to parse GDELT articles:', e);
    return [];
  }
}

// ─── Main Hook ───

interface UseGDACSAlertsOptions {
  onNewRedAlert?: (alert: GDACSAlert) => void;
}

// Preserve announced hazards while the Sismos screen is unmounted/remounted.
const sessionNotifiedRedAlerts = new Set<string>();

export function useGDACSAlerts(options?: UseGDACSAlertsOptions) {
  const [state, setState] = useState<GDACSAlertsState>({
    gdacsAlerts: [],
    aemetAlerts: [],
    loading: false,
    error: null,
    lastChecked: null,
  });

  const notifiedRedAlertsRef = useRef<Set<string>>(new Set(sessionNotifiedRedAlerts));
  const isFirstLoadRef = useRef(true);

  const fetchAlerts = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('[Alerts] Fetching hazard feeds via edge function...');

      const { data, error } = await supabase.functions.invoke('fetch-hazard-feeds');

      if (error) {
        console.error('[Alerts] Edge function error:', error);
        throw error;
      }

      if (!data) {
        console.warn('[Alerts] No data returned from edge function');
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // Parse each feed result
      const allAlerts: GDACSAlert[] = [];

      if (data.gdacs_24h) allAlerts.push(...parseGDACSXml(data.gdacs_24h, '24h'));
      if (data.gdacs_tc) allAlerts.push(...parseGDACSXml(data.gdacs_tc, 'tc'));
      if (data.gdacs_fl) allAlerts.push(...parseGDACSXml(data.gdacs_fl, 'fl'));
      if (data.gdacs_vo) allAlerts.push(...parseGDACSXml(data.gdacs_vo, 'vo'));
      if (data.conagua) allAlerts.push(...parseCONAGUAXml(data.conagua));
      if (data.nasa_eonet) allAlerts.push(...parseNASAEONETJson(data.nasa_eonet));
      if (data.reliefweb) allAlerts.push(...parseReliefWebXml(data.reliefweb));
      if (data.usgs_volcano) allAlerts.push(...parseUSGSVolcanoXml(data.usgs_volcano));
      if (data.smithsonian_volc) allAlerts.push(...parseUSGSVolcanoXml(data.smithsonian_volc));
      if (data.gdelt_conflicts) allAlerts.push(...parseGDELTArticles(data.gdelt_conflicts));

      // Deduplicate by title
      const seenTitles = new Set<string>();
      const uniqueAlerts = allAlerts.filter(alert => {
        const key = alert.title.toLowerCase().substring(0, 50);
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      });

      const redAlerts = uniqueAlerts.filter(a => a.alertLevel === 'red');

      // Existing feed items are baseline data, not new notifications. This
      // prevents the Sismos screen from sounding every time it is opened.
      if (isFirstLoadRef.current) {
        redAlerts.forEach((alert) => {
          const alertKey = alert.title.toLowerCase().substring(0, 50);
          notifiedRedAlertsRef.current.add(alertKey);
          sessionNotifiedRedAlerts.add(alertKey);
        });
        isFirstLoadRef.current = false;
      } else if (options?.onNewRedAlert) {
        for (const alert of redAlerts) {
          const alertKey = alert.title.toLowerCase().substring(0, 50);
          if (notifiedRedAlertsRef.current.has(alertKey)) continue;
          notifiedRedAlertsRef.current.add(alertKey);
          sessionNotifiedRedAlerts.add(alertKey);
          console.log('[Alerts] New RED alert:', alert.title);
          options.onNewRedAlert(alert);
        }
      }

      // Sort: red > orange > green > undefined, then by date
      const levelOrder = { red: 0, orange: 1, green: 2 };
      uniqueAlerts.sort((a, b) => {
        const la = a.alertLevel ? levelOrder[a.alertLevel] : 3;
        const lb = b.alertLevel ? levelOrder[b.alertLevel] : 3;
        if (la !== lb) return la - lb;
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      });

      // Count sources for logging
      const sourceCounts: Record<string, number> = {};
      uniqueAlerts.forEach(a => { sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1; });
      console.log(`[Alerts] Total: ${uniqueAlerts.length}`, sourceCounts);

      setState({
        gdacsAlerts: uniqueAlerts,
        aemetAlerts: [],
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

  // Initial fetch and periodic refresh (every 5 minutes)
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const getCategoryIcon = (category: GDACSAlert['category']) => {
    const map: Record<string, string> = {
      earthquake: '🌍', cyclone: '🌀', flood: '🌊', tsunami: '🌊',
      volcano: '🌋', drought: '☀️', wildfire: '🔥', weather: '🌤️',
      security: '🛡️', humanitarian: '🆘',
    };
    return map[category] || '⚠️';
  };

  const getCategoryLabel = (category: GDACSAlert['category']) => {
    const map: Record<string, string> = {
      earthquake: 'Terremoto', cyclone: 'Ciclón', flood: 'Inundación', tsunami: 'Tsunami',
      volcano: 'Volcán', drought: 'Sequía', wildfire: 'Incendio', weather: 'Clima',
      security: 'Seguridad', humanitarian: 'Humanitario',
    };
    return map[category] || 'Otro';
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
      case 'GDELT': return 'border-red-600 text-red-600';
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
