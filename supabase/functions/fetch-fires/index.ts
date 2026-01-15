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
    // We fetch from multiple sources to maximize coverage and get the freshest data
    const bbox = '-118,14,-86,33'; // approx Mexico bounds: west,south,east,north
    const dayRange = '3'; // use last 72h to avoid showing empty results too often
    
    // VIIRS_NOAA20_NRT often has more recent data than VIIRS_SNPP_NRT
    // We fetch from both and combine results
    const sources = ['VIIRS_NOAA20_NRT', 'VIIRS_SNPP_NRT'];
    
    const allFires: Array<Record<string, unknown>> = [];
    const seenIds = new Set<string>();
    
    for (const source of sources) {
      try {
        const firmsUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${source}/${bbox}/${dayRange}`;
        console.log('Fetching fires from FIRMS...', { source, bbox, dayRange });

        const response = await fetch(firmsUrl, {
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.warn(`FIRMS API error for ${source}:`, response.status, response.statusText);
          continue; // Try next source
        }

        const csvText = await response.text();
        const trimmed = csvText.trim();

        // FIRMS sometimes returns plain-text errors like "Invalid API call." with 200 OK.
        if (trimmed.toLowerCase().includes('invalid api call')) {
          console.warn(`FIRMS returned error text for ${source}:`, trimmed.slice(0, 200));
          continue; // Try next source
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
          console.warn(`Unexpected FIRMS CSV header for ${source}:`, headerLine);
          continue; // Try next source
        }

        if (lines.length <= 1) {
          console.log(`No fires found for ${source}`);
          continue;
        }

        for (let i = 1; i < lines.length; i++) {
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
          const satellite = satIdx >= 0 ? (parts[satIdx] || '').toString() : source;

          // Create unique ID based on location and time to avoid duplicates
          const fireId = `fire-${lat.toFixed(3)}-${lng.toFixed(3)}-${acqDate}-${acqTime}`;
          
          if (seenIds.has(fireId)) continue;
          seenIds.add(fireId);

          allFires.push({
            id: fireId,
            lat,
            lng,
            brightness: Number.isFinite(brightness) ? brightness : undefined,
            confidence,
            frp,
            satellite,
            acqDate,
            acqTime,
            source,
          });
        }
        
        console.log(`Found ${allFires.length} unique fire hotspots after ${source}`);
      } catch (sourceError) {
        console.warn(`Error fetching from ${source}:`, sourceError);
        continue; // Try next source
      }
    }

    // Sort by date (newest first) and limit to 200
    allFires.sort((a, b) => {
      const dateA = `${a.acqDate}-${String(a.acqTime).padStart(4, '0')}`;
      const dateB = `${b.acqDate}-${String(b.acqTime).padStart(4, '0')}`;
      return dateB.localeCompare(dateA);
    });
    
    const fires = allFires.slice(0, 200);

    console.log(`Returning ${fires.length} fire hotspots (newest date: ${fires[0]?.acqDate || 'none'})`);

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
