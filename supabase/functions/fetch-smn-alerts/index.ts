// Edge function to fetch SMN (CONAGUA) weather alerts RSS feed for Mexico
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch SMN CONAGUA avisos RSS
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://smn.conagua.gob.mx/rss/avisos.xml', {
      signal: controller.signal,
      headers: { 'User-Agent': 'MATS-App/2.6' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `SMN returned ${response.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xml = await response.text();

    return new Response(
      JSON.stringify({ success: true, xml }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching SMN alerts:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to fetch SMN alerts' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
