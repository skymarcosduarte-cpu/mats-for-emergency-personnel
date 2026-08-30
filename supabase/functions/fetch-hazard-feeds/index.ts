import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEEDS: Record<string, string> = {
  gdacs_24h: "https://gdacs.org/xml/rss_24h.xml",
  gdacs_tc: "https://gdacs.org/xml/rss_tc_7d.xml",
  gdacs_fl: "https://gdacs.org/xml/rss_fl_7d.xml",
  gdacs_vo: "https://gdacs.org/xml/rss_vo_7d.xml",
  nasa_eonet: "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30&category=volcanoes,severeStorms,floods",
  reliefweb: "https://reliefweb.int/disasters/rss.xml",
  // USGS Volcano HANS public API (JSON)
  usgs_volcano: "https://volcanoes.usgs.gov/hans-public/api/notice/latest",
  // Smithsonian Global Volcanism Program
  smithsonian_volc: "https://volcano.si.edu/news/WeeklyVolcanoRSS.xml",
  // NOTE: GDELT doc API removed — api.gdeltproject.org is unreachable from the edge
  // runtime (every request aborts on timeout), so it only added latency.
};

// Per-feed timeout overrides (some APIs are slow)
const FEED_TIMEOUTS: Record<string, number> = {};

async function fetchFeed(key: string, url: string): Promise<string | null> {
  const timeoutMs = FEED_TIMEOUTS[key] || 10000;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[hazard] ${url} returned ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[hazard] Failed to fetch ${url}: ${e.message}`);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const results: Record<string, string | null> = {};

    // Fetch all feeds in parallel with individual timeouts
    const entries = Object.entries(FEEDS);
    const fetches = entries.map(async ([key, url]) => {
      const data = await fetchFeed(key, url);
      results[key] = data;
    });

    await Promise.allSettled(fetches);

    // Count successes
    const successCount = Object.values(results).filter(Boolean).length;
    console.log(`[hazard] Fetched ${successCount}/${entries.length} feeds successfully`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[hazard] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
