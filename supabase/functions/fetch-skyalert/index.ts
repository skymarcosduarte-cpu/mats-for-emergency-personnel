// fetch-skyalert Edge Function
// Fetches active seismic alerts from SkyAlert sources
// Only returns alerts from the last 5 minutes

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    id: `skyalert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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

const SASSLA_MIRRORS = [
  'https://nitter.cz/SasslaMx/rss',
  'https://nitter.it/SasslaMx/rss',
  'https://nitter.privacydev.net/SasslaMx/rss',
  'https://nitter.poast.org/SasslaMx/rss',
  'https://nitter.projectsegfau.lt/SasslaMx/rss',
  'https://nitter.rawbit.ninja/SasslaMx/rss',
  'https://nitter.moomoo.me/SasslaMx/rss',
  'https://nitter.tiekoetter.com/SasslaMx/rss'
];

interface SasslaFetchResult {
  xml: string | null;
  mirror: string | null;
  attempts: Array<{ url: string; ok: boolean; status?: number; error?: string }>;
}

async function fetchSasslaXml(): Promise<SasslaFetchResult> {
  const attempts: SasslaFetchResult['attempts'] = [];
  for (const url of SASSLA_MIRRORS) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'MATS/1.0 (Emergency Alert System)',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const xml = await res.text();
        attempts.push({ url, ok: true, status: res.status });
        return { xml, mirror: url, attempts };
      }
      attempts.push({ url, ok: false, status: res.status });
    } catch (e) {
      attempts.push({ url, ok: false, error: (e as Error).message });
      console.log('[SASSLA] Mirror failed:', url, (e as Error).message);
    }
  }
  return { xml: null, mirror: null, attempts };
}

interface SasslaRawItem {
  text: string;
  pubDate: string | null;
  timestamp: number | null;
}

function parseSasslaItems(xml: string): SasslaRawItem[] {
  const items: SasslaRawItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  for (const itemMatch of xml.matchAll(itemRegex)) {
    const item = itemMatch[1];
    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                       item.match(/<title>([\s\S]*?)<\/title>/);
    const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                      item.match(/<description>([\s\S]*?)<\/description>/);
    const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

    const text = (descMatch?.[1] || titleMatch?.[1] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;

    const pubDate = dateMatch ? dateMatch[1].trim() : null;
    const ts = pubDate ? new Date(pubDate).getTime() : NaN;
    items.push({ text, pubDate, timestamp: isNaN(ts) ? null : ts });
  }
  return items;
}

// Scrape SASSLA X/Twitter account via public Nitter RSS mirrors
async function fetchSASSLA(): Promise<SkyAlert[]> {
  const alerts: SkyAlert[] = [];
  const { xml } = await fetchSasslaXml();
  if (!xml) {
    console.log('[SASSLA] All Nitter mirrors failed');
    return alerts;
  }

  try {
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const { text: rawText, timestamp } of parseSasslaItems(xml)) {
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

      // Generate a stable unique ID
      const textHash = rawText.length % 1000;
      alerts.push({
        id: `sassla-${pubDate}-${textHash}`,
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

    if (debug === 'sassla') {
      const { xml, mirror, attempts } = await fetchSasslaXml();
      const items = xml ? parseSasslaItems(xml).slice(0, 10) : [];
      const parsedAlerts = xml ? await fetchSASSLA() : [];
      return new Response(
        JSON.stringify({
          ok: !!xml,
          mirror,
          attempts,
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

    const [websiteAlerts, sasmexAlerts, sasslaAlerts] = await Promise.all([
      fetchSkyAlertWebsite(),
      fetchSASMEX(),
      fetchSASSLA(),
    ]);

    let allAlerts = [...websiteAlerts, ...sasmexAlerts, ...sasslaAlerts];
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
