import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SSN_URL = 'http://www.ssn.unam.mx/sismicidad/ultimos/';
const TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`SSN fetch attempt ${attempt}/${retries}...`);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MATSApp/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-MX,es;q=0.9',
        },
      });
      
      if (response.ok) {
        return response;
      }
      
      console.error(`SSN attempt ${attempt} failed with status: ${response.status}`);
      
      if (attempt < retries) {
        // Wait before retry (exponential backoff)
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    } catch (error) {
      console.error(`SSN attempt ${attempt} error:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`Failed to fetch SSN after ${retries} attempts`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching SSN latest earthquakes...');

    const response = await fetchWithRetry(SSN_URL);
    const html = await response.text();
    
    console.log(`SSN HTML received: ${html.length} bytes`);

    return new Response(
      JSON.stringify({ success: true, html }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching SSN:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
