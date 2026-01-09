import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRMS_MAP_KEY');
    
    if (!apiKey) {
      console.error('FIRMS_MAP_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'FIRMS API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch fire hotspots for Mexico from NASA FIRMS
    const firmsUrl = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${apiKey}/VIIRS_SNPP_NRT/MEX/1`;
    
    console.log('Fetching fires from FIRMS...');
    
    const response = await fetch(firmsUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error('FIRMS API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ success: false, error: `FIRMS API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    
    if (lines.length <= 1) {
      return new Response(
        JSON.stringify({ success: true, fires: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse CSV
    const fires = [];
    for (let i = 1; i < Math.min(lines.length, 200); i++) {
      const parts = lines[i].split(',');
      if (parts.length < 10) continue;

      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      const brightness = parseFloat(parts[2]);
      const confidence = parts[8]?.toLowerCase() || 'nominal';
      const frp = parseFloat(parts[12]) || 0;

      if (!isNaN(lat) && !isNaN(lng)) {
        fires.push({
          id: `fire-${i}-${lat.toFixed(3)}-${lng.toFixed(3)}`,
          lat,
          lng,
          brightness,
          confidence,
          frp,
          satellite: 'VIIRS',
          acqDate: parts[5] || '',
          acqTime: parts[6] || '',
        });
      }
    }

    console.log(`Found ${fires.length} fire hotspots`);

    return new Response(
      JSON.stringify({ success: true, fires }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching fires:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
