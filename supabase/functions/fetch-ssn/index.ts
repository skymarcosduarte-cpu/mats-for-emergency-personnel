import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SSN_URL = 'https://www.ssn.unam.mx/sismicidad/ultimos/';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching SSN latest earthquakes HTML...');

    const response = await fetch(SSN_URL, {
      signal: AbortSignal.timeout(15000),
      headers: {
        // Some sites behave better with an explicit UA
        'User-Agent': 'LovableCloud/1.0 (+https://lovable.dev)',
      },
    });

    if (!response.ok) {
      console.error('SSN fetch error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ success: false, error: `SSN error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    console.log(`SSN HTML length: ${html.length}`);

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
