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
}

interface CachedXFeed {
  expiresAt: number;
  result: XFeedResult;
}

const xFeedCache = new Map<string, CachedXFeed>();
const X_FEED_CACHE_MS = 60 * 1000;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
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

async function fetchXFeed(screenName: string, logLabel: string): Promise<XFeedResult> {
  const attempts: XFeedResult['attempts'] = [];
  const cached = xFeedCache.get(screenName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const sources: Array<{ url: string; parser: (body: string) => XFeedRawItem[] }> = [
    {
      url: `https://syndication.twitter.com/srv/timeline-profile/screen-name/${screenName}`,
      parser: parseXSyndication,
    },
    {
      url: `https://cdn.syndication.twimg.com/timeline/profile?screen_name=${screenName}&suppress_response_codes=true`,
      parser: parseTwimgCdn,
    },
  ];

  let lastRetryAfter: number | undefined;
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': browserUA,
          'Accept': 'text/html,application/json,application/xhtml+xml',
          'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
          'Referer': 'https://platform.twitter.com/',
        },
        signal: AbortSignal.timeout(8000),
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
      const items = source.parser(body);
      attempts.push({ url: source.url, ok: items.length > 0, status: response.status });
      if (items.length > 0) {
        const result: XFeedResult = { items, mirror: source.url, attempts };
        xFeedCache.set(screenName, { result, expiresAt: Date.now() + X_FEED_CACHE_MS });
        return result;
      }
    } catch (error) {
      attempts.push({ url: source.url, ok: false, error: (error as Error).message });
      console.error(`[${logLabel}] Source ${source.url} failed:`, error);
    }
  }

  return cached?.result ?? {
    items: [],
    mirror: null,
    attempts,
    retryAfterSeconds: lastRetryAfter,
  };
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
      const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' '));
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

    if (debug && debug !== 'sassla' && debug !== 'skyalert') {
      return new Response(JSON.stringify({ error: 'Fuente de verificación no válida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (debug === 'sassla' || debug === 'skyalert') {
      const isSassla = debug === 'sassla';
      const { items: fetchedItems, mirror, attempts } = await fetchXFeed(
        isSassla ? 'SasslaMx' : 'SkyAlertMx',
        isSassla ? 'SASSLA' : 'SkyAlert X',
      );
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
