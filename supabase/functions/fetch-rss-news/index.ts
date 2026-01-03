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
const PRIORITY_FEEDS: { url: string; source: string }[] = [
  // Mexico - High reliability
  { url: 'https://www.milenio.com/rss', source: 'Milenio' },
  { url: 'https://www.eluniversal.com.mx/rss.xml', source: 'El Universal' },
  
  // Latinoamérica - Very high reliability
  { url: 'https://cnnespanol.cnn.com/feed/', source: 'CNN en Español' },
  { url: 'https://feeds.bbci.co.uk/mundo/rss.xml', source: 'BBC Mundo' },
  
  // Internacional - Open RSS
  { url: 'https://www.reuters.com/arc/outboundfeeds/news/?outputType=xml', source: 'Reuters' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
  { url: 'https://www.france24.com/es/rss', source: 'France24 Español' },
  { url: 'https://www.dw.com/es/noticias/s-30684/rss', source: 'DW Español' },
  
  // España
  { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', source: 'El País' },
  { url: 'https://api.rtve.es/api/lives.rss', source: 'RTVE' },
];

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
      const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = itemXml.match(regex);
      if (match) {
        const raw = (match[1] || match[2] || '').trim().replace(/<[^>]+>/g, '');
        return decodeHtmlEntities(raw);
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
    
    // Return top 15 items
    const finalItems = uniqueItems.slice(0, 15);
    
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
