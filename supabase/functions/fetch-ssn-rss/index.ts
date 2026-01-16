import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Direct SSN URLs
const SSN_URLS = [
  'https://www.ssn.unam.mx/rss/ultimos-sismos.xml',
  'http://www.ssn.unam.mx/rss/ultimos-sismos.xml',
];

// CORS/Proxy fallbacks (when SSN blocks direct connections from datacenter)
const PROXY_TEMPLATES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

const TIMEOUT_MS = 20000;

async function tryFetch(url: string, label: string): Promise<string | null> {
  try {
    console.log(`[fetch-ssn-rss] Trying ${label}...`);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/xml, text/xml, application/rss+xml, */*',
        'Accept-Language': 'es-MX,es;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    if (!res.ok) {
      console.warn(`[fetch-ssn-rss] ${label} returned ${res.status}`);
      return null;
    }

    const text = await res.text();
    if (text.includes('<rss') || text.includes('<item')) {
      console.log(`[fetch-ssn-rss] ${label} success, length: ${text.length}`);
      return text;
    }

    console.warn(`[fetch-ssn-rss] ${label} response not valid RSS`);
    return null;
  } catch (err) {
    console.error(`[fetch-ssn-rss] ${label} error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchSSNRss(): Promise<string> {
  // 1) Try direct URLs first
  for (const url of SSN_URLS) {
    const result = await tryFetch(url, `direct ${url}`);
    if (result) return result;
  }

  // 2) Try via proxy services
  for (const proxyFn of PROXY_TEMPLATES) {
    for (const url of SSN_URLS) {
      const proxyUrl = proxyFn(url);
      const result = await tryFetch(proxyUrl, `proxy for ${url}`);
      if (result) return result;
    }
  }

  throw new Error('SSN RSS unavailable from all sources');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const xml = await fetchSSNRss();

    return new Response(JSON.stringify({ success: true, xml }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[fetch-ssn-rss] All attempts failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
