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

    // Fetch fire hotspots around Mexico from NASA FIRMS
    // NOTE: We use the /area endpoint (bbox) instead of /country because /country has intermittent outages.
    const source = 'VIIRS_SNPP_NRT';
    const bbox = '-118,14,-86,33'; // approx Mexico bounds: west,south,east,north
    const dayRange = '3'; // use last 72h to avoid showing empty results too often
    const firmsUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${source}/${bbox}/${dayRange}`;

    console.log('Fetching fires from FIRMS...', { source, bbox, dayRange });

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
    const trimmed = csvText.trim();

    // FIRMS sometimes returns plain-text errors like "Invalid API call." with 200 OK.
    if (trimmed.toLowerCase().includes('invalid api call')) {
      console.error('FIRMS returned error text:', trimmed.slice(0, 200));
      return new Response(
        JSON.stringify({ success: false, error: 'FIRMS invalid API call (check MAP_KEY / endpoint)' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lines = trimmed.split(/\r?\n/);
    const headerLine = (lines[0] || '').trim();
    const header = headerLine.toLowerCase().split(',').map((h) => h.trim());

    const idx = (name: string) => header.indexOf(name);
    const latIdx = idx('latitude');
    const lngIdx = idx('longitude');
    const confIdx = idx('confidence');
    const frpIdx = idx('frp');
    const dateIdx = idx('acq_date');
    const timeIdx = idx('acq_time');
    const satIdx = idx('satellite');
    const brightIdx = header.findIndex((h) => h === 'bright_ti4' || h === 'brightness' || h === 'bright');

    if (latIdx === -1 || lngIdx === -1) {
      console.error('Unexpected FIRMS CSV header:', headerLine);
      return new Response(
        JSON.stringify({ success: false, error: 'Unexpected FIRMS CSV header' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (lines.length <= 1) {
      return new Response(JSON.stringify({ success: true, fires: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fires: Array<Record<string, unknown>> = [];

    for (let i = 1; i < Math.min(lines.length, 400); i++) {
      const row = lines[i];
      if (!row) continue;

      const parts = row.split(',');
      const lat = parseFloat(parts[latIdx] || '');
      const lng = parseFloat(parts[lngIdx] || '');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const brightness = brightIdx >= 0 ? parseFloat(parts[brightIdx] || '') : NaN;

      const rawConf = (confIdx >= 0 ? parts[confIdx] : '')?.toString().trim().toLowerCase();
      let confidence: 'low' | 'nominal' | 'high' = 'nominal';
      if (rawConf === 'h' || rawConf?.includes('high')) confidence = 'high';
      else if (rawConf === 'l' || rawConf?.includes('low')) confidence = 'low';
      else if (rawConf === 'n' || rawConf?.includes('nom')) confidence = 'nominal';
      else {
        const numericConfidence = Number(rawConf);
        if (Number.isFinite(numericConfidence)) {
          confidence = numericConfidence >= 80 ? 'high' : numericConfidence >= 30 ? 'nominal' : 'low';
        }
      }

      const frp = frpIdx >= 0 ? parseFloat(parts[frpIdx] || '') || 0 : 0;
      const acqDate = dateIdx >= 0 ? (parts[dateIdx] || '').toString() : '';
      const acqTime = timeIdx >= 0 ? (parts[timeIdx] || '').toString() : '';
      const satellite = satIdx >= 0 ? (parts[satIdx] || '').toString() : 'VIIRS';

      fires.push({
        id: `fire-${i}-${lat.toFixed(3)}-${lng.toFixed(3)}-${acqDate}-${acqTime}`,
        lat,
        lng,
        brightness: Number.isFinite(brightness) ? brightness : undefined,
        confidence,
        frp,
        satellite,
        acqDate,
        acqTime,
      });

      if (fires.length >= 200) break;
    }

    console.log(`Found ${fires.length} fire hotspots`);

    return new Response(JSON.stringify({ success: true, fires }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching fires:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
