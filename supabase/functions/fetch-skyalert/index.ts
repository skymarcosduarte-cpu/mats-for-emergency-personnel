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
  level: 'preventiva' | 'moderada' | 'severa';
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
  // Example patterns from @SkyAlertMx:
  // "🚨 ALERTA SÍSMICA SEVERA 🚨 Epicentro: Guerrero, Magnitud: 6.5"
  // "⚠️ Alerta Sísmica Moderada - Se detectó sismo de M5.2 en Oaxaca"
  
  const text_lower = text.toLowerCase();
  
  let level: 'preventiva' | 'moderada' | 'severa' = 'preventiva';
  if (text_lower.includes('severa') || text_lower.includes('🚨')) {
    level = 'severa';
  } else if (text_lower.includes('moderada') || text_lower.includes('⚠️')) {
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
    // Try to fetch SkyAlert's main page
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
    
    // Look for active alert banners in the HTML
    // SkyAlert typically shows active alerts prominently
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

// Fetch from SASMEX/SSN for real-time seismic data (backup source)
async function fetchSASMEX(): Promise<SkyAlert[]> {
  const alerts: SkyAlert[] = [];
  
  try {
    // SSN Mexico provides seismic data
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
    
    // Parse recent earthquakes from SSN
    // Look for events in the last 5 minutes with M >= 4.5
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    // SSN lists recent events - check for significant ones
    const eventPattern = /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\d+\.?\d*)\s+([^<\n]+)/g;
    const matches = html.matchAll(eventPattern);
    
    for (const match of matches) {
      const [, dateStr, magStr, region] = match;
      const magnitude = parseFloat(magStr);
      const eventTime = new Date(dateStr.replace(' ', 'T') + '-06:00').getTime();
      
      // Only recent significant events
      if (eventTime >= fiveMinutesAgo && magnitude >= 4.5) {
        let level: 'preventiva' | 'moderada' | 'severa' = 'preventiva';
        if (magnitude >= 6.0) {
          level = 'severa';
        } else if (magnitude >= 5.0) {
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

// Scrape SASSLA X/Twitter account via public Nitter RSS mirrors
async function fetchSASSLA(): Promise<SkyAlert[]> {
  const alerts: SkyAlert[] = [];
  const nitterMirrors = [
    'https://nitter.privacydev.net/SASSLA_/rss',
    'https://nitter.poast.org/SASSLA_/rss',
    'https://nitter.net/SASSLA_/rss',
  ];

  let xml: string | null = null;
  for (const url of nitterMirrors) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'MATS/1.0 (Emergency Alert System)',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        xml = await res.text();
        break;
      }
    } catch (e) {
      console.log('[SASSLA] Mirror failed:', url, (e as Error).message);
    }
  }

  if (!xml) {
    console.log('[SASSLA] All Nitter mirrors failed');
    return alerts;
  }

  try {
    // Only look at tweets from the last 15 minutes
    const cutoff = Date.now() - 15 * 60 * 1000;
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = xml.matchAll(itemRegex);

    for (const itemMatch of items) {
      const item = itemMatch[1];
      const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                         item.match(/<title>([\s\S]*?)<\/title>/);
      const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                        item.match(/<description>([\s\S]*?)<\/description>/);
      const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

      const rawText = (descMatch?.[1] || titleMatch?.[1] || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      if (!rawText) continue;

      const pubDate = dateMatch ? new Date(dateMatch[1]).getTime() : Date.now();
      if (isNaN(pubDate) || pubDate < cutoff) continue;

      const lower = rawText.toLowerCase();
      // Only real seismic alert posts
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
        id: `sassla-${pubDate}`,
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
  if (alert.level !== 'severa') return;
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all push subscriptions
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
    
    // Send to each subscription via send-web-push function
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
    
    console.log(`[SkyAlert] Sent push for severe alert to ${subscriptions.length} users`);
  } catch (error) {
    console.error('[SkyAlert] Error sending push notifications:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch alerts from multiple sources in parallel
    const [websiteAlerts, sasmexAlerts, sasslaAlerts] = await Promise.all([
      fetchSkyAlertWebsite(),
      fetchSASMEX(),
      fetchSASSLA(),
    ]);

    // Combine all alerts
    let allAlerts = [...websiteAlerts, ...sasmexAlerts, ...sasslaAlerts];

    // Filter to only last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    allAlerts = allAlerts.filter(alert => alert.timestamp >= fiveMinutesAgo);

    // Deduplicate by checking cache
    const newAlerts: SkyAlert[] = [];
    
    for (const alert of allAlerts) {
      // Check if already in cache
      const { data: existing } = await supabase
        .from('skyalert_cache')
        .select('id')
        .eq('alert_id', alert.id)
        .single();
      
      if (!existing) {
        // Add to cache
        await supabase
          .from('skyalert_cache')
          .insert({
            alert_id: alert.id,
            alert_data: alert,
            processed_at: new Date().toISOString(),
          });
        
        newAlerts.push(alert);
        
        // Send push for new severe alerts
        if (alert.level === 'severa') {
          await sendPushNotification(alert);
        }
      }
    }

    // Build response
    const response: SkyAlertResponse = {
      alerts: allAlerts,
      lastChecked: new Date().toISOString(),
      isActive: allAlerts.some(a => a.level === 'severa' || a.level === 'moderada'),
    };

    console.log(`[SkyAlert] Returning ${allAlerts.length} alerts (${newAlerts.length} new)`);

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
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
