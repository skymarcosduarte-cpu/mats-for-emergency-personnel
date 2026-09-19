import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Direct SSN URLs. The HTTPS endpoint currently fails its TLS handshake, while
// plain HTTP responds normally, so HTTP is tried first.
const SSN_URLS = [
  'http://www.ssn.unam.mx/rss/ultimos-sismos.xml',
  'https://www.ssn.unam.mx/rss/ultimos-sismos.xml',
];

// Proxy fallbacks (in case direct access is refused from datacenter IPs).
// corsproxy.io legacy keyless URLs now return 403, so it was removed.
const PROXY_TEMPLATES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
];

const TIMEOUT_MS = 7000;

// Last good feed kept in memory so a transient upstream outage still returns
// usable (slightly stale) data instead of nothing.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
let lastGood: { xml: string; ts: number } | null = null;

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

// Todas las rutas (directas y por proxy) se intentan EN PARALELO y se toma la
// primera que responda: el presupuesto total de tiempo es TIMEOUT_MS, no la
// suma de 8 intentos secuenciales (~2 minutos antes).
async function fetchSSNRss(): Promise<string> {
  const attempts: Array<Promise<string>> = [];

  for (const url of SSN_URLS) {
    attempts.push(
      tryFetch(url, `direct ${url}`).then((r) => {
        if (!r) throw new Error('no data');
        return r;
      }),
    );
    for (const proxyFn of PROXY_TEMPLATES) {
      attempts.push(
        tryFetch(proxyFn(url), `proxy for ${url}`).then((r) => {
          if (!r) throw new Error('no data');
          return r;
        }),
      );
    }
  }

  try {
    return await Promise.any(attempts);
  } catch {
    throw new Error('SSN RSS unavailable from all sources');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const xml = await fetchSSNRss();
    lastGood = { xml, ts: Date.now() };

    return new Response(JSON.stringify({ success: true, xml, stale: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.warn('[fetch-ssn-rss] All attempts failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Serve the last good feed if it is still recent enough.
    if (lastGood && Date.now() - lastGood.ts < CACHE_TTL_MS) {
      console.log('[fetch-ssn-rss] Serving cached feed from', new Date(lastGood.ts).toISOString());
      return new Response(
        JSON.stringify({ success: true, xml: lastGood.xml, stale: true, cachedAt: lastGood.ts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    // Return 200 so the client can fall back to USGS silently instead of
    // surfacing an invoke error for an upstream outage we cannot control.
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
