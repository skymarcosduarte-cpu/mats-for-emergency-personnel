// Edge function to fetch and parse RSS feeds for Breaking News
// Avoids CORS issues and caches results

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description?: string;
}

interface RSSSource {
  nombre: string;
  feeds: { url: string; categoria: string; prioridad: string }[];
  confiabilidad: string;
}

// High-priority, reliable sources to fetch
const PRIORITY_FEEDS: { url: string; source: string; category: string }[] = [
  // Mexico - Nacionales (expanded)
  { url: 'https://www.milenio.com/rss', source: 'Milenio', category: 'nacionales' },
  { url: 'https://www.eluniversal.com.mx/rss.xml', source: 'El Universal', category: 'nacionales' },
  { url: 'https://www.informador.mx/rss/jalisco.xml', source: 'El Informador', category: 'nacionales' },
  { url: 'https://www.jornada.com.mx/rss/edicion.xml', source: 'La Jornada', category: 'nacionales' },
  { url: 'https://www.excelsior.com.mx/rss.xml', source: 'Excélsior', category: 'nacionales' },
  { url: 'https://www.reforma.com/rss/portada.xml', source: 'Reforma', category: 'nacionales' },
  { url: 'https://www.proceso.com.mx/feed', source: 'Proceso', category: 'nacionales' },
  { url: 'https://expansion.mx/rss', source: 'Expansión', category: 'nacionales' },
  { url: 'https://www.elfinanciero.com.mx/arc/outboundfeeds/rss/', source: 'El Financiero', category: 'nacionales' },
  { url: 'https://www.eleconomista.com.mx/rss/', source: 'El Economista', category: 'nacionales' },
  
  // Internacionales (expanded)
  { url: 'https://cnnespanol.cnn.com/feed/', source: 'CNN en Español', category: 'internacionales' },
  { url: 'https://feeds.bbci.co.uk/mundo/rss.xml', source: 'BBC Mundo', category: 'internacionales' },
  { url: 'https://www.reuters.com/arc/outboundfeeds/news/?outputType=xml', source: 'Reuters', category: 'internacionales' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera', category: 'internacionales' },
  { url: 'https://www.france24.com/es/rss', source: 'France24 Español', category: 'internacionales' },
  { url: 'https://www.dw.com/es/noticias/s-30684/rss', source: 'DW Español', category: 'internacionales' },
  { url: 'https://elpais.com/rss/elpais/portada.xml', source: 'El País', category: 'internacionales' },
  { url: 'https://www.infobae.com/america/rss/', source: 'Infobae', category: 'internacionales' },
  { url: 'https://www.rtve.es/noticias/rss/', source: 'RTVE', category: 'internacionales' },
  { url: 'https://www.telesurtv.net/rss/news.xml', source: 'TeleSUR', category: 'internacionales' },
  
  // Deportes en Español (expanded)
  { url: 'https://www.espn.com.mx/espn/rss/noticias', source: 'ESPN Latam', category: 'deportes' },
  { url: 'https://www.marca.com/rss/portada.xml', source: 'Marca', category: 'deportes' },
  { url: 'https://as.com/rss/tags/ultimas_noticias.xml', source: 'AS', category: 'deportes' },
  { url: 'https://www.tycsports.com/rss/futbol.xml', source: 'TyC Sports', category: 'deportes' },
  { url: 'https://www.ole.com.ar/rss/ultimas-noticias/', source: 'Olé', category: 'deportes' },
  { url: 'https://www.goal.com/feeds/es/news', source: 'Goal', category: 'deportes' },
  { url: 'https://www.mediotiempo.com/rss.xml', source: 'Medio Tiempo', category: 'deportes' },
  { url: 'https://www.record.com.mx/rss.xml', source: 'Récord', category: 'deportes' },
  { url: 'https://depor.com/rss/home.xml', source: 'Depor', category: 'deportes' },
  { url: 'https://www.mundodeportivo.com/rss/home.xml', source: 'Mundo Deportivo', category: 'deportes' },
  { url: 'https://www.sport.es/es/rss/home.xml', source: 'Sport', category: 'deportes' },
  
  // Emergencias
  { url: 'https://www.gob.mx/cenapred/es/archivo/rss', source: 'CENAPRED', category: 'emergencias' },
  { url: 'https://reliefweb.int/updates/rss.xml?country=170', source: 'ReliefWeb México', category: 'emergencias' },
];

// Strip all HTML tags from text
function stripHtmlTags(text: string): string {
  // Remove all HTML tags including self-closing ones
  let result = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
    .replace(/<[^>]+>/g, '') // Remove all HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  return result;
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&quot;': '"',
    '&apos;': "'",
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&#39;': "'",
    '&#34;': '"',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&iexcl;': '¡',
    '&iquest;': '¿',
    '&ntilde;': 'ñ',
    '&Ntilde;': 'Ñ',
    '&aacute;': 'á',
    '&eacute;': 'é',
    '&iacute;': 'í',
    '&oacute;': 'ó',
    '&uacute;': 'ú',
    '&Aacute;': 'Á',
    '&Eacute;': 'É',
    '&Iacute;': 'Í',
    '&Oacute;': 'Ó',
    '&Uacute;': 'Ú',
    '&uuml;': 'ü',
    '&Uuml;': 'Ü',
  };
  
  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }
  
  // Handle numeric entities like &#123;
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  
  return result;
}

// Simple XML parsing for RSS
function parseRSSItem(itemXml: string, source: string): RSSItem | null {
  try {
    const getTagContent = (tag: string): string => {
      // Match CDATA or plain content
      const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = itemXml.match(regex);
      if (match) {
        let raw = (match[1] || match[2] || '').trim();
        // First decode HTML entities, then strip HTML tags
        raw = decodeHtmlEntities(raw);
        raw = stripHtmlTags(raw);
        return raw;
      }
      return '';
    };

    const title = getTagContent('title');
    const link = getTagContent('link');
    const pubDate = getTagContent('pubDate');
    const description = getTagContent('description');

    if (!title || !link) return null;

    return {
      title: title.substring(0, 200),
      link,
      pubDate,
      source,
      description: description?.substring(0, 300),
    };
  } catch {
    return null;
  }
}

async function fetchFeed(url: string, source: string): Promise<RSSItem[]> {
  try {
    console.log(`Fetching feed: ${source} - ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EmergencyNewsBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`Feed ${source} returned ${response.status}`);
      return [];
    }

    const text = await response.text();
    
    // Extract items from RSS
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items: RSSItem[] = [];
    let match;
    
    while ((match = itemRegex.exec(text)) !== null && items.length < 5) {
      const parsed = parseRSSItem(match[1], source);
      if (parsed) {
        items.push(parsed);
      }
    }
    
    console.log(`Feed ${source}: got ${items.length} items`);
    return items;
  } catch (err) {
    console.error(`Error fetching ${source}:`, err);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting RSS news fetch...');
    
    // Fetch all feeds in parallel
    const results = await Promise.allSettled(
      PRIORITY_FEEDS.map(feed => fetchFeed(feed.url, feed.source))
    );
    
    // Collect all items
    const allItems: RSSItem[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allItems.push(...result.value);
      }
    }
    
    // Sort by date (most recent first)
    allItems.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime() || 0;
      const dateB = new Date(b.pubDate).getTime() || 0;
      return dateB - dateA;
    });
    
    // Deduplicate by title similarity
    const seen = new Set<string>();
    const uniqueItems = allItems.filter(item => {
      const key = item.title.toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Return top 30 items to ensure category diversity
    const finalItems = uniqueItems.slice(0, 30);
    
    console.log(`Returning ${finalItems.length} news items`);
    
    return new Response(
      JSON.stringify({
        success: true,
        items: finalItems,
        fetchedAt: new Date().toISOString(),
        sourcesCount: PRIORITY_FEEDS.length,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600', // Cache 10 min
        } 
      }
    );
  } catch (error) {
    console.error('Error in fetch-rss-news:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch news' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
