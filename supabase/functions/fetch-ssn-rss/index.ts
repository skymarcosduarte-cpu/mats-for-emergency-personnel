import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SSN_RSS_URL = 'https://www.ssn.unam.mx/rss/ultimos-sismos.xml';
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[fetch-ssn-rss] Attempt ${attempt}/${retries}`);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MATSApp/1.0)',
          'Accept': 'application/xml, text/xml, */*',
          'Accept-Language': 'es-MX,es;q=0.9,en;q=0.6',
        },
      });

      if (res.ok) return res;

      lastError = new Error(`SSN RSS fetch failed: ${res.status} ${res.statusText}`);
      console.error('[fetch-ssn-rss] Non-OK response:', res.status, res.statusText);
    } catch (err) {
      lastError = err;
      console.error('[fetch-ssn-rss] Error:', err instanceof Error ? err.message : err);
    }

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 750 * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown error fetching SSN RSS');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const res = await fetchWithRetry(SSN_RSS_URL);
    const xml = await res.text();

    console.log(`[fetch-ssn-rss] XML length: ${xml.length}`);

    return new Response(JSON.stringify({ success: true, xml }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[fetch-ssn-rss] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
