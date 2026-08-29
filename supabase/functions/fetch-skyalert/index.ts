// fetch-skyalert Edge Function
// Fetches active seismic alerts from SkyAlert sources
// Only returns alerts from the last 5 minutes

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface SkyAlert {
  id: string;
  level: 'preventiva' | 'moderada' | 'severa' | 'violenta';
  magnitude?: number;
  region: string;
  message: string;
  timestamp: string;
  source: string;
  epicenterLat?: number;
  epicenterLng?: number;
}

interface SkyAlertResponse {
  alerts: SkyAlert[];
  lastChecked: string;
  isActive: boolean;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// Parse Twitter/X posts for seismic alerts
function parseTwitterAlert(text: string, timestamp: string): SkyAlert | null {
  const text_lower = text.toLowerCase();
  
  let level: 'preventiva' | 'moderada' | 'severa' | 'violenta' = 'preventiva';
  if (text_lower.includes('violenta') || text_lower.includes('violento')) {
    level = 'violenta';
  } else if (text_lower.includes('severa') || text_lower.includes('severo') || text_lower.includes('🚨')) {
    level = 'severa';
  } else if (text_lower.includes('moderada') || text_lower.includes('moderad') || text_lower.includes('⚠️')) {
    level = 'moderada';
  }
  
  // Extract magnitude
  const magMatch = text.match(/[Mm](?:agnitud)?[:\s]*(\d+\.?\d*)/i) || 
                   text.match(/M(\d+\.?\d*)/);
  const magnitude = magMatch ? parseFloat(magMatch[1]) : undefined;
  
  // Extract region
  const regionPatterns = [
    /[Ee]picentro[:\s]*([A-Za-záéíóúñÁÉÍÓÚÑ\s,]+)/i,
    /en\s+([A-Za-záéíóúñÁÉÍÓÚÑ\s,]+?)(?:\.|,|$)/i,
  ];
  let region = 'México';
  for (const pattern of regionPatterns) {
    const match = text.match(pattern);
    if (match) {
      region = match[1].trim();
      break;
    }
  }
  
  // Only consider actual seismic alerts
  if (!text_lower.includes('sism') && !text_lower.includes('temblor') && !text_lower.includes('terremoto')) {
    return null;
  }
  
  return {
    id: `skyalert-${stableHash(text)}`,
    level,
    magnitude,
    region,
    message: text.substring(0, 200),
    timestamp,
    source: 'SkyAlert Twitter',
  };
}

// Scrape SkyAlert website for active alerts
async function fetchSkyAlertWebsite(): Promise<SkyAlert[]> {
  const alerts: SkyAlert[] = [];
  
  try {
    const response = await fetch('https://www.skyalert.mx/', {
      headers: {
        'User-Agent': 'MATS/1.0 (Emergency Alert System)',
        'Accept': 'text/html',
      },
    });
    
    if (!response.ok) {
      console.log('[SkyAlert] Website fetch failed:', response.status);
      return alerts;
    }
    
    const html = await response.text();
    
    const alertPatterns = [
      /<div[^>]*class="[^"]*alert[^"]*"[^>]*>([^<]+)/gi,
      /<span[^>]*class="[^"]*alerta[^"]*"[^>]*>([^<]+)/gi,
      /ALERTA\s+SÍSMICA[^<]*/gi,
    ];
    
    for (const pattern of alertPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const alertText = match[1] || match[0];
        if (alertText && alertText.toLowerCase().includes('sism')) {
          const parsed = parseTwitterAlert(alertText, new Date().toISOString());
          if (parsed) {
            alerts.push({
              ...parsed,
              source: 'SkyAlert Web',
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[SkyAlert] Error fetching website:', error);
  }
  
  return alerts;
}

// Fetch from SASMEX/SSN for real-time seismic data
async function fetchSASMEX(): Promise<SkyAlert[]> {
  const alerts: SkyAlert[] = [];
  
  try {
    const response = await fetch('http://www.ssn.unam.mx/sismicidad/ultimos/', {
      headers: {
        'User-Agent': 'MATS/1.0',
        'Accept': 'text/html',
      },
    });
    
    if (!response.ok) {
      return alerts;
    }
    
    const html = await response.text();
    
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    const eventPattern = /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\d+\.?\d*)\s+([^<\n]+)/g;
    const matches = html.matchAll(eventPattern);
    
    for (const match of matches) {
      const [, dateStr, magStr, region] = match;
      const magnitude = parseFloat(magStr);
      const eventTime = new Date(dateStr.replace(' ', 'T') + '-06:00').getTime();
      
      if (eventTime >= fiveMinutesAgo && magnitude >= 4.5) {
        let level: 'preventiva' | 'moderada' | 'severa' | 'violenta' = 'preventiva';
        if (magnitude >= 6.5) {
          level = 'violenta';
        } else if (magnitude >= 5.5) {
          level = 'severa';
        } else if (magnitude >= 4.5) {
          level = 'moderada';
        }
        
        alerts.push({
          id: `ssn-${eventTime}-${magnitude}`,
          level,
          magnitude,
          region: region.trim(),
          message: `Sismo M${magnitude.toFixed(1)} detectado en ${region.trim()}`,
          timestamp: new Date(eventTime).toISOString(),
          source: 'SSN/SASMEX',
        });
      }
    }
  } catch (error) {
    console.error('[SkyAlert] Error fetching SASMEX:', error);
  }
  
  return alerts;
}

interface XFeedRawItem {
  id: string;
  text: string;
  pubDate: string | null;
  timestamp: number | null;
}

interface XFeedResult {
  items: XFeedRawItem[];
  mirror: string | null;
  attempts: Array<{ url: string; ok: boolean; status?: number; error?: string }>;
  retryAfterSeconds?: number;
  stale?: boolean;
  cachedAt?: string;
  cacheAgeSeconds?: number;
  source?: 'network' | 'memory' | 'db';
}

interface CachedXFeed {
  freshUntil: number;
  cachedAt: number;
  result: XFeedResult;
}

const xFeedCache = new Map<string, CachedXFeed>();
// Fresh window: served without touching the network.
const X_FEED_FRESH_MS = 3 * 60 * 1000;
// Stale window (in-memory): served immediately while a background refresh runs.
const X_FEED_STALE_MS = 6 * 60 * 60 * 1000;
// Hard max age for DB fallback: after this we stop serving stale data.
const X_FEED_DB_MAX_MS = 24 * 60 * 60 * 1000;

// De-duplicate concurrent background refreshes per screen name.
const inFlightRefresh = new Map<string, Promise<XFeedResult | null>>();

function waitUntil(promise: Promise<unknown>): void {
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === 'function') {
    runtime.waitUntil(promise.catch((e) => console.error('[XFeed] waitUntil error:', e)));
  } else {
    promise.catch((e) => console.error('[XFeed] background refresh error:', e));
  }
}

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

async function readDbFeedCache(
  screenName: string,
  maxAgeMs: number = X_FEED_DB_MAX_MS,
): Promise<{ result: XFeedResult; cachedAt: number } | null> {
  const supa = getServiceClient();
  if (!supa) return null;
  try {
    const { data } = await supa
      .from('skyalert_cache')
      .select('alert_data, processed_at')
      .eq('alert_id', `xfeed:${screenName}`)
      .maybeSingle();
    if (!data) return null;
    const processedAt = new Date(data.processed_at as string).getTime();
    if (Number.isNaN(processedAt) || Date.now() - processedAt > maxAgeMs) return null;
    const cached = data.alert_data as XFeedResult;
    if (!cached || !Array.isArray(cached.items) || cached.items.length === 0) return null;
    return { result: cached, cachedAt: processedAt };
  } catch (e) {
    console.error('[XFeed] DB cache read error:', e);
    return null;
  }
}

async function writeDbFeedCache(screenName: string, result: XFeedResult): Promise<void> {
  if (result.items.length === 0) return;
  const supa = getServiceClient();
  if (!supa) return;
  try {
    await supa
      .from('skyalert_cache')
      .upsert({
        alert_id: `xfeed:${screenName}`,
        alert_data: { ...result, stale: false },
        processed_at: new Date().toISOString(),
      }, { onConflict: 'alert_id' });
  } catch (e) {
    console.error('[XFeed] DB cache write error:', e);
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanFeedText(value: string): string {
  let text = value;
  // Google News can HTML-encode an entire anchor inside the RSS description.
  // Decode before stripping tags, and repeat because some entries are encoded twice.
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = decodeEntities(text);
    const withoutTags = decoded.replace(/<[^>]*>/g, ' ');
    text = decodeEntities(withoutTags);
    if (text === decoded) break;
  }
  return text
    .replace(/\s+-\s+x\.com\s*$/i, '')
    .replace(/\s+x\.com\s*$/i, '')
    .trim();
}

function parseXSyndication(html: string): XFeedRawItem[] {
  const dataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!dataMatch) return [];

  const data = JSON.parse(dataMatch[1]);
  const entries = data?.props?.pageProps?.timeline?.entries;
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry: any) => {
    const tweet = entry?.content?.tweet;
    const text = decodeEntities(tweet?.full_text || '');
    if (!tweet || !text) return [];
    const id = String(tweet.id_str || tweet.conversation_id_str || entry.entry_id || stableHash(text));
    const pubDate = typeof tweet.created_at === 'string' ? tweet.created_at : null;
    const timestamp = pubDate ? new Date(pubDate).getTime() : NaN;
    return [{ id, text, pubDate, timestamp: Number.isNaN(timestamp) ? null : timestamp }];
  });
}

// Attempt to fetch fresh items from network sources. Returns null on total failure.
async function fetchFromNetwork(
  screenName: string,
  logLabel: string,
): Promise<{ result: XFeedResult; retryAfterSeconds?: number } | { failed: true; attempts: XFeedResult['attempts']; retryAfterSeconds?: number }> {
  const attempts: XFeedResult['attempts'] = [];
  const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  // Nitter mirrors (privacyredirect / privacydev / poast / nitter.net) are dead:
  // DNS failures, ECONNREFUSED, 410 and RSS-client whitelists. They were removed
  // because every attempt only burned the function's time budget.
  const sources: Array<{ url: string; parser: (body: string) => XFeedRawItem[] }> = [
    {
      url: `https://syndication.twitter.com/srv/timeline-profile/screen-name/${screenName}`,
      parser: parseXSyndication,
    },
    {
      url: `https://cdn.syndication.twimg.com/timeline/profile?screen_name=${screenName}&suppress_response_codes=true`,
      parser: parseTwimgCdn,
    },
    {
      // Google News continuously indexes public X posts and remains available
      // when X syndication returns an old curated timeline or rate-limits.
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(`site:x.com/${screenName}`)}&hl=es-419&gl=MX&ceid=MX:es-419`,
      parser: parseGoogleNewsXFeed,
    },
    {
      // Secondary Google News query: catches reposts/coverage naming the account
      // when the site: query returns nothing.
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(`"@${screenName}" sismo`)}&hl=es-419&gl=MX&ceid=MX:es-419`,
      parser: parseGoogleNewsXFeed,
    },
  ];


  let lastRetryAfter: number | undefined;
  let bestResult: XFeedResult | null = null;
  let bestTimestamp = 0;
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': browserUA,
          'Accept': 'text/html,application/json,application/xhtml+xml,application/rss+xml',
          'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
          'Referer': 'https://platform.twitter.com/',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        attempts.push({ url: source.url, ok: false, status: response.status });
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after'));
          lastRetryAfter = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
        }
        continue;
      }
      const body = await response.text();
      const items = source.parser(body).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
      attempts.push({ url: source.url, ok: items.length > 0, status: response.status });
      if (items.length > 0) {
        const newestTimestamp = items[0]?.timestamp ?? 0;
        if (!bestResult || newestTimestamp > bestTimestamp) {
          bestTimestamp = newestTimestamp;
          bestResult = { items, mirror: source.url, attempts: [...attempts], source: 'network', stale: false };
        }
        // X syndication sometimes returns a valid but years-old "top posts" list.
        // Only stop when the source contains an actually recent post; otherwise
        // continue through every fallback and retain the freshest result found.
        if (newestTimestamp >= recentCutoff) {
          return { result: bestResult, retryAfterSeconds: lastRetryAfter };
        }
      }
    } catch (error) {
      attempts.push({ url: source.url, ok: false, error: (error as Error).message });
      console.error(`[${logLabel}] Source ${source.url} failed:`, error);
    }
  }
  if (bestResult) {
    return { result: { ...bestResult, attempts }, retryAfterSeconds: lastRetryAfter };
  }
  return { failed: true, attempts, retryAfterSeconds: lastRetryAfter };
}

function decorateStale(result: XFeedResult, cachedAt: number, source: 'memory' | 'db'): XFeedResult {
  const ageMs = Date.now() - cachedAt;
  const stale = ageMs > X_FEED_FRESH_MS;
  return {
    ...result,
    stale,
    cachedAt: new Date(cachedAt).toISOString(),
    cacheAgeSeconds: Math.round(ageMs / 1000),
    source,
  };
}

async function refreshInBackground(screenName: string, logLabel: string): Promise<XFeedResult | null> {
  const existing = inFlightRefresh.get(screenName);
  if (existing) return existing;
  const p = (async () => {
    const outcome = await fetchFromNetwork(screenName, logLabel);
    if ('result' in outcome) {
      const now = Date.now();
      xFeedCache.set(screenName, {
        result: outcome.result,
        freshUntil: now + X_FEED_FRESH_MS,
        cachedAt: now,
      });
      writeDbFeedCache(screenName, outcome.result).catch(() => {});
      return outcome.result;
    }
    return null;
  })().finally(() => {
    inFlightRefresh.delete(screenName);
  });
  inFlightRefresh.set(screenName, p);
  return p;
}

// Stale-while-revalidate: always return the freshest available data, kicking off
// a background refresh whenever the cache is beyond its "fresh" window.
async function fetchXFeed(screenName: string, logLabel: string): Promise<XFeedResult> {
  const now = Date.now();

  // 1. Fresh in-memory hit → serve immediately, no network.
  const memHit = xFeedCache.get(screenName);
  if (memHit && memHit.freshUntil > now) {
    return decorateStale(memHit.result, memHit.cachedAt, 'memory');
  }

  // 2. Any usable cached copy (memory or DB, up to X_FEED_STALE_MS).
  let staleSource: 'memory' | 'db' | null = null;
  let staleResult: XFeedResult | null = null;
  let staleCachedAt = 0;

  if (memHit && now - memHit.cachedAt <= X_FEED_STALE_MS) {
    staleResult = memHit.result;
    staleCachedAt = memHit.cachedAt;
    staleSource = 'memory';
  } else {
    const dbHit = await readDbFeedCache(screenName, X_FEED_STALE_MS);
    if (dbHit) {
      staleResult = dbHit.result;
      staleCachedAt = dbHit.cachedAt;
      staleSource = 'db';
      // Hydrate in-memory cache from DB so other invocations benefit.
      xFeedCache.set(screenName, {
        result: dbHit.result,
        freshUntil: dbHit.cachedAt + X_FEED_FRESH_MS,
        cachedAt: dbHit.cachedAt,
      });
    }
  }

  // 3. If we have any stale copy, revalidate in the background and return it now.
  if (staleResult && staleSource) {
    waitUntil(refreshInBackground(screenName, logLabel));
    return decorateStale(staleResult, staleCachedAt, staleSource);
  }

  // 4. No cache at all — must wait for the network (blocking) this once.
  const outcome = await fetchFromNetwork(screenName, logLabel);
  if ('result' in outcome) {
    const stamp = Date.now();
    xFeedCache.set(screenName, { result: outcome.result, freshUntil: stamp + X_FEED_FRESH_MS, cachedAt: stamp });
    writeDbFeedCache(screenName, outcome.result).catch(() => {});
    return decorateStale(outcome.result, stamp, 'memory');
  }

  // 5. Last-ditch: try the DB one more time with the absolute max age.
  const emergencyDb = await readDbFeedCache(screenName, X_FEED_DB_MAX_MS);
  if (emergencyDb) {
    return decorateStale(emergencyDb.result, emergencyDb.cachedAt, 'db');
  }

  return {
    items: [],
    mirror: null,
    attempts: outcome.attempts,
    retryAfterSeconds: outcome.retryAfterSeconds,
    stale: false,
    source: 'network',
  };
}

async function forceRefreshXFeed(screenName: string, logLabel: string): Promise<XFeedResult> {
  const refreshed = await refreshInBackground(screenName, logLabel);
  if (refreshed) return refreshed;
  return fetchXFeed(screenName, logLabel);
}

function parseNitterRss(body: string): XFeedRawItem[] {
  const items: XFeedRawItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(body)) !== null) {
    const block = m[1];
    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const pubMatch = block.match(/<pubDate>([^<]+)<\/pubDate>/);
    const linkMatch = block.match(/<link>([^<]+)<\/link>/);
    const rawText = cleanFeedText(descMatch?.[1] || titleMatch?.[1] || '');
    if (!rawText) continue;
    const pubDate = pubMatch?.[1] ?? null;
    const ts = pubDate ? Date.parse(pubDate) : NaN;
    const idMatch = linkMatch?.[1]?.match(/status\/(\d+)/);
    const id = idMatch?.[1] || stableHash(rawText);
    items.push({ id, text: rawText, pubDate, timestamp: Number.isNaN(ts) ? null : ts });
  }
  return items;
}

function parseGoogleNewsXFeed(body: string): XFeedRawItem[] {
  return parseNitterRss(body).map((item) => ({
    ...item,
    text: cleanFeedText(item.text),
  }));
}

function parseTwimgCdn(body: string): XFeedRawItem[] {
  try {
    const data = JSON.parse(body);
    const html: string = data?.body || '';
    if (!html) return [];
    // Extract tweet objects from embedded JSON if present
    const items: XFeedRawItem[] = [];
    const tweetRegex = /data-tweet-id="(\d+)"[\s\S]*?<p[^>]*class="[^"]*timeline-Tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>[\s\S]*?<time[^>]*datetime="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = tweetRegex.exec(html)) !== null) {
      const id = m[1];
      const text = cleanFeedText(m[2]);
      const pubDate = m[3];
      const ts = Date.parse(pubDate);
      items.push({ id, text, pubDate, timestamp: Number.isNaN(ts) ? null : ts });
    }
    return items;
  } catch {
    return [];
  }
}

// Read SASSLA posts from X's public profile syndication feed.
// Keywords that indicate a foreign quake, retransmission, or informational content.
const FOREIGN_COUNTRY_TERMS = [
  'japón', 'japon', 'japan', '#japan', '#japon', 'kumamoto', 'tokio', 'tokyo', 'hokkaido', 'okinawa', 'kanto',
  '#jma', 'jma ', ' jma', 'usgs', 'emsc', '#usgs', '#emsc',
  'chile', '#chile', 'perú', 'peru', '#peru', 'argentina', 'colombia', 'ecuador', 'bolivia',
  'venezuela', 'costa rica', 'guatemala', 'honduras', 'nicaragua', 'panamá', 'panama',
  'salvador', 'republica dominicana', 'república dominicana', 'haití', 'haiti', 'cuba', 'puerto rico',
  'estados unidos', 'california', 'alaska', 'hawái', 'hawaii', 'oregon',
  'italia', 'grecia', 'turquía', 'turquia', 'indonesia', 'filipinas', 'china', 'taiwán', 'taiwan',
  'nepal', 'india', 'irán', 'iran', 'afganistán', 'afganistan', 'rusia',
  'nueva zelanda', 'australia', 'papúa', 'papua', 'vanuatu', 'fiji', 'tonga', 'samoa',
  'islandia', 'marruecos', 'siria', 'pakistán', 'pakistan',
];

const RETRANSMISSION_TERMS = [
  'momento del', 'grabado en', 'dashcam', 'cámara capta', 'camara capta', 'captado por',
  'video del', 'vídeo del', 'imágenes del', 'imagenes del', 'así se sintió', 'asi se sintio',
  'así se vivió', 'asi se vivio', 'retransmi', 'recordamos', 'hace un año',
  'hace años', 'aniversario', 'efeméride', 'efemeride', 'documental',
  'reportaje', 'análisis', 'analisis', '#tbt', 'throwback',
];

function isForeignOrRetransmission(lower: string): boolean {
  for (const term of FOREIGN_COUNTRY_TERMS) {
    if (lower.includes(term)) return true;
  }
  for (const term of RETRANSMISSION_TERMS) {
    if (lower.includes(term)) return true;
  }
  return false;
}

// SASSLA emits real Mexico alerts with markers like these.
const MEXICO_ALERT_MARKERS = [
  '#alertasismica', '#alertasísmica', 'alerta sísmica', 'alerta sismica',
  '#sismoendesarrollo', 'sismo en desarrollo', '#sismodetectado',
  'sasmex', 'ssn', 'cires', 'servicio sismológico nacional',
];

function isActiveMexicoAlert(lower: string): boolean {
  return MEXICO_ALERT_MARKERS.some((m) => lower.includes(m));
}

async function fetchSASSLA(feedItems?: XFeedRawItem[]): Promise<SkyAlert[]> {
  const alerts: SkyAlert[] = [];
  const items = feedItems ?? (await fetchXFeed('SasslaMx', 'SASSLA')).items;
  if (items.length === 0) {
    console.log('[SASSLA] Public X feed returned no posts');
    return alerts;
  }

  try {
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const { id, text: rawText, timestamp } of items) {
      const pubDate = timestamp ?? Date.now();
      if (pubDate < cutoff) continue;

      const lower = rawText.toLowerCase();
      const isSeismic = lower.includes('sism') || lower.includes('temblor') || lower.includes('terremoto') || lower.includes('alerta');
      if (!isSeismic) continue;

      // Exclude foreign quakes / retransmissions / informational posts.
      if (isForeignOrRetransmission(lower)) continue;
      // Require an active real-alert marker for Mexico.
      if (!isActiveMexicoAlert(lower)) continue;

      let level: SkyAlert['level'] = 'preventiva';
      if (lower.includes('violent')) level = 'violenta';
      else if (lower.includes('sever')) level = 'severa';
      else if (lower.includes('moderad')) level = 'moderada';

      const magMatch = rawText.match(/[Mm](?:agnitud)?[:\s]*(\d+\.?\d*)/) || rawText.match(/M(\d+\.?\d*)/);
      const magnitude = magMatch ? parseFloat(magMatch[1]) : undefined;

      let region = 'México';
      const regionMatch = rawText.match(/[Ee]picentro[:\s]*([A-Za-záéíóúñÁÉÍÓÚÑ\s,]+?)(?:\.|,|\||$)/) ||
                          rawText.match(/en\s+([A-Za-záéíóúñÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ\s,]{2,40}?)(?:\.|,|\||$)/);
      if (regionMatch) region = regionMatch[1].trim().slice(0, 80);

      alerts.push({
        id: `sassla-${id}`,
        level,
        magnitude,
        region,
        message: rawText.substring(0, 240),
        timestamp: new Date(pubDate).toISOString(),
        source: 'SASSLA (X)',
      });
    }
  } catch (e) {
    console.error('[SASSLA] Parse error:', e);
  }

  return alerts;
}

// Read active alerts from SkyAlert's official X public profile feed.
async function fetchSkyAlertX(feedItems?: XFeedRawItem[]): Promise<SkyAlert[]> {
  const alerts: SkyAlert[] = [];
  const items = feedItems ?? (await fetchXFeed('SkyAlertMx', 'SkyAlert X')).items;
  if (items.length === 0) {
    console.log('[SkyAlert X] Public X feed returned no posts');
    return alerts;
  }

  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const { id, text: rawText, timestamp } of items) {
    const pubDate = timestamp ?? 0;
    if (!pubDate || pubDate < cutoff) continue;

    const lower = rawText.toLowerCase();
    // A finalized post is informational and must never restart the siren.
    if (lower.includes('#sismofinalizado') || lower.includes('sismo finalizado')) continue;
    const isActiveSeismicPost = lower.includes('#sismoendesarrollo') ||
      lower.includes('#sismodetectado') ||
      lower.includes('sismo en desarrollo') ||
      lower.includes('alerta sísmica');
    if (!isActiveSeismicPost) continue;

    // Exclude foreign quakes / retransmissions / informational posts.
    if (isForeignOrRetransmission(lower)) continue;

    let level: SkyAlert['level'] = 'preventiva';
    if (lower.includes('violent')) level = 'violenta';
    else if (lower.includes('sever') || lower.includes('muy fuerte')) level = 'severa';
    else if (lower.includes('moderad') || lower.includes('fuerte')) level = 'moderada';

    const magMatch = rawText.match(/[Mm](?:agnitud)?[:\s]*(\d+\.?\d*)/) || rawText.match(/M(\d+\.?\d*)/);
    const magnitude = magMatch ? parseFloat(magMatch[1]) : undefined;
    const regionMatch = rawText.match(/(?:en|epicentro[:\s]*)\s*#?([A-Za-záéíóúñÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ\s]{1,45}(?:,\s*[A-Za-záéíóúñÁÉÍÓÚÑ.]{2,15})?)(?:\.|\n|$)/i);
    const region = regionMatch ? regionMatch[1].trim().slice(0, 80) : 'México';

    alerts.push({
      id: `skyalert-x-${id}`,
      level,
      magnitude,
      region,
      message: rawText.substring(0, 240),
      timestamp: new Date(pubDate).toISOString(),
      source: 'SkyAlert (X)',
    });
  }

  return alerts;
}

// Send push notification for severe alerts
async function sendPushNotification(
  alert: SkyAlert
): Promise<void> {
  if (alert.level !== 'severa' && alert.level !== 'violenta') return;
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');
    
    if (!subscriptions || subscriptions.length === 0) return;
    
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn('[SkyAlert] Missing VAPID keys, skipping push');
      return;
    }
    
    const payload = {
      title: `🚨 ALERTA SÍSMICA ${alert.level.toUpperCase()}`,
      body: `${alert.magnitude ? `M${alert.magnitude.toFixed(1)} - ` : ''}${alert.region}`,
      alertType: 'SKYALERT',
      data: {
        alertId: alert.id,
        level: alert.level,
        magnitude: alert.magnitude,
        region: alert.region,
      },
    };
    
    for (const sub of subscriptions) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            subscription: {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload,
          }),
        });
      } catch (e) {
        console.error('[SkyAlert] Push failed for subscription:', e);
      }
    }
    
    console.log(`[SkyAlert] Sent push for ${alert.level} alert to ${subscriptions.length} users`);
  } catch (error) {
    console.error('[SkyAlert] Error sending push notifications:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug');
    const forceRefresh = url.searchParams.get('refresh') === '1';

    if (debug && debug !== 'sassla' && debug !== 'skyalert') {
      return new Response(JSON.stringify({ error: 'Fuente de verificación no válida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (debug === 'sassla' || debug === 'skyalert') {
      const isSassla = debug === 'sassla';
      const screenName = isSassla ? 'SasslaMx' : 'SkyAlertMx';
      const logLabel = isSassla ? 'SASSLA' : 'SkyAlert X';
      const { items: fetchedItems, mirror, attempts } = forceRefresh
        ? await forceRefreshXFeed(screenName, logLabel)
        : await fetchXFeed(screenName, logLabel);
      const items = fetchedItems.slice(0, 10);
      const parsedAlerts = isSassla
        ? await fetchSASSLA(fetchedItems)
        : await fetchSkyAlertX(fetchedItems);
      return new Response(
        JSON.stringify({
          ok: items.length > 0,
          mirror,
          attempts,
          retryAfterSeconds: items.length === 0 ? 60 : undefined,
          itemCount: items.length,
          items: items.map((it) => ({
            text: it.text,
            pubDate: it.pubDate,
            ageMinutes: it.timestamp ? Math.round((Date.now() - it.timestamp) / 60000) : null,
          })),
          matchedAlerts: parsedAlerts,
          checkedAt: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [skyAlertXAlerts, sasmexAlerts, sasslaAlerts] = await Promise.all([
      fetchSkyAlertX(),
      fetchSASMEX(),
      fetchSASSLA(),
    ]);

    let allAlerts = [...skyAlertXAlerts, ...sasmexAlerts, ...sasslaAlerts];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    allAlerts = allAlerts.filter(alert => alert.timestamp >= fiveMinutesAgo);

    const newAlerts: SkyAlert[] = [];
    
    for (const alert of allAlerts) {
      const { data: existing } = await supabase
        .from('skyalert_cache')
        .select('id')
        .eq('alert_id', alert.id)
        .single();
      
      if (!existing) {
        await supabase
          .from('skyalert_cache')
          .insert({
            alert_id: alert.id,
            alert_data: alert,
            processed_at: new Date().toISOString(),
          });
        
        newAlerts.push(alert);
        
        if (alert.level === 'severa' || alert.level === 'violenta') {
          await sendPushNotification(alert);
        }
      }
    }

    const response: SkyAlertResponse = {
      alerts: allAlerts,
      lastChecked: new Date().toISOString(),
      isActive: allAlerts.some(a => a.level === 'severa' || a.level === 'violenta' || a.level === 'moderada'),
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        } 
      }
    );
  } catch (error) {
    console.error('[SkyAlert] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch alerts',
        alerts: [],
        lastChecked: new Date().toISOString(),
        isActive: false,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 200 
      }
    );
  }
});
