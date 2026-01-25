// Últimas Noticias Section - Clean, fluid display of emergency news

import React, { useState, useMemo } from 'react';
import { 
  Newspaper, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Loader2,
  Filter,
  Radio
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBreakingNews, NewsItem } from '@/hooks/useBreakingNews';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Available sources with category info
const SOURCE_CONFIG: Record<string, { category: 'nacionales' | 'internacionales' | 'deportes' | 'emergencias'; color: string }> = {
  // Nacionales (expanded)
  'Milenio': { category: 'nacionales', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  'El Universal': { category: 'nacionales', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  'El Informador': { category: 'nacionales', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  'La Jornada': { category: 'nacionales', color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  'Excélsior': { category: 'nacionales', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  'Reforma': { category: 'nacionales', color: 'bg-slate-500/10 text-slate-600 border-slate-500/30' },
  'Proceso': { category: 'nacionales', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  'Expansión': { category: 'nacionales', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30' },
  'El Financiero': { category: 'nacionales', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  'El Economista': { category: 'nacionales', color: 'bg-teal-500/10 text-teal-600 border-teal-500/30' },
  
  // Internacionales (expanded)
  'CNN en Español': { category: 'internacionales', color: 'bg-red-500/10 text-red-500 border-red-500/30' },
  'BBC Mundo': { category: 'internacionales', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  'Reuters': { category: 'internacionales', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  'Al Jazeera': { category: 'internacionales', color: 'bg-teal-500/10 text-teal-600 border-teal-500/30' },
  'France24 Español': { category: 'internacionales', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' },
  'DW Español': { category: 'internacionales', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  'El País': { category: 'internacionales', color: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
  'Infobae': { category: 'internacionales', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  'RTVE': { category: 'internacionales', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  'TeleSUR': { category: 'internacionales', color: 'bg-green-600/10 text-green-600 border-green-600/30' },
  
  // Deportes en Español (expanded)
  'ESPN Latam': { category: 'deportes', color: 'bg-red-500/10 text-red-500 border-red-500/30' },
  'Marca': { category: 'deportes', color: 'bg-red-500/10 text-red-500 border-red-500/30' },
  'AS': { category: 'deportes', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  'TyC Sports': { category: 'deportes', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  'Olé': { category: 'deportes', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  'Goal': { category: 'deportes', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  'Medio Tiempo': { category: 'deportes', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  'Récord': { category: 'deportes', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  'Depor': { category: 'deportes', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  'Mundo Deportivo': { category: 'deportes', color: 'bg-sky-500/10 text-sky-600 border-sky-500/30' },
  'Sport': { category: 'deportes', color: 'bg-pink-500/10 text-pink-600 border-pink-500/30' },
  
  // Emergencias (solo fuentes dedicadas a emergencias)
  'CENAPRED': { category: 'emergencias', color: 'bg-orange-600/10 text-orange-600 border-orange-600/30' },
  'ReliefWeb México': { category: 'emergencias', color: 'bg-blue-600/10 text-blue-600 border-blue-600/30' },
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Todas',
  nacionales: 'Nacionales',
  internacionales: 'Internacionales',
  deportes: 'Deportes',
  emergencias: 'Emergencias',
};

// Keywords to identify emergency news by content (not just source)
// Using phrases/patterns to reduce false positives
const EMERGENCY_KEYWORDS = [
  'accidente vial', 'accidente de tránsito', 'accidente carretero', 'accidente fatal',
  'emergencia médica', 'emergencia sanitaria', 'estado de emergencia', 'alerta de emergencia',
  'explosión', 'explosion', 'desastre natural', 
  'huracán', 'huracan', 'incendio forestal', 'incendio devastador',
  'terremoto', 'sismo de magnitud', 'temblor',
  'inundación', 'inundacion', 'tornado', 'tsunami', 
  'evacuación masiva', 'evacuacion de emergencia',
  'derrumbe', 'colapso de edificio', 'atentado',
  'tormenta tropical', 'ciclón', 'ciclon', 
  'erupción volcánica', 'erupcion volcanica', 'volcán en erupción',
  'rescate de víctimas', 'operativo de rescate', 'brigada de rescate',
  'deslizamiento de tierra', 'avalancha', 
  'fuga de gas', 'naufragio', 
  'tragedia en', 'catástrofe', 'catastrofe',
  'apagón masivo', 'apagon', 'epidemia de', 'pandemia',
  'alerta sísmica', 'alerta roja', 'alerta por huracán',
  'muertos por', 'víctimas del', 'heridos en el'
];

// Check if a news item matches emergency keywords
function isEmergencyNews(item: NewsItem): boolean {
  const textToSearch = `${item.title} ${item.description || ''}`.toLowerCase();
  // Require more specific phrase matching to avoid false positives
  return EMERGENCY_KEYWORDS.some(keyword => textToSearch.includes(keyword.toLowerCase()));
}

// Format relative time for news items (only for past dates)
function formatNewsTime(pubDate: string): string {
  try {
    const date = new Date(pubDate);
    if (isNaN(date.getTime())) return '';
    
    // If date is in the future, don't show relative time (RSS parsing error)
    const now = new Date();
    if (date > now) {
      return '';
    }
    
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  } catch {
    return '';
  }
}

// Get source color based on name
function getSourceColor(source: string): string {
  return SOURCE_CONFIG[source]?.color || 'bg-primary/10 text-primary border-primary/30';
}

interface NewsCardProps {
  item: NewsItem;
}

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const timeAgo = formatNewsTime(item.pubDate);
  
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className={cn(
        "p-3 rounded-lg border border-border/50 bg-card/50",
        "hover:bg-card hover:border-primary/30 hover:shadow-sm",
        "transition-all duration-200 active:scale-[0.99]"
      )}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Source and time */}
            <div className="flex items-center gap-2 mb-1.5">
              <Badge 
                variant="outline" 
                className={cn("text-xs px-2 py-0.5", getSourceColor(item.source))}
              >
                {item.source}
              </Badge>
              {timeAgo && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo}
                </span>
              )}
            </div>
            
            {/* Title */}
            <h3 className="text-base font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
              {item.title}
            </h3>
            
            {/* Description preview */}
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                {item.description}
              </p>
            )}
          </div>
          
          {/* External link icon */}
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
        </div>
      </div>
    </a>
  );
};

// Filter out news with future dates (RSS parsing errors)
function isValidNewsDate(pubDate: string): boolean {
  try {
    const date = new Date(pubDate);
    if (isNaN(date.getTime())) return true; // Keep if can't parse
    return date <= new Date();
  } catch {
    return true;
  }
}

const INITIAL_ITEMS_COUNT = 10;
const LOAD_MORE_COUNT = 10;
const MAX_ITEMS_COUNT = 30;

export const BreakingNewsSection: React.FC = () => {
  const { items, loading, error, fetchedAt, refresh } = useBreakingNews();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_ITEMS_COUNT);
  
  // Get all valid items (filtered by date only)
  const allValidItems = useMemo(() => {
    return items.filter(item => isValidNewsDate(item.pubDate));
  }, [items]);

  // Calculate counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: Math.min(allValidItems.length, MAX_ITEMS_COUNT),
      nacionales: 0,
      internacionales: 0,
      deportes: 0,
      emergencias: 0,
    };
    
    allValidItems.forEach(item => {
      const sourceConfig = SOURCE_CONFIG[item.source];
      if (sourceConfig?.category) {
        counts[sourceConfig.category]++;
      }
      // Also count emergency news by keywords
      if (isEmergencyNews(item)) {
        // Only count if not already counted as emergency source
        if (sourceConfig?.category !== 'emergencias') {
          counts.emergencias++;
        }
      }
    });
    
    // Cap each count to MAX_ITEMS_COUNT
    Object.keys(counts).forEach(key => {
      counts[key] = Math.min(counts[key], MAX_ITEMS_COUNT);
    });
    
    return counts;
  }, [allValidItems]);

  // Filter items by selected category
  const validItems = useMemo(() => {
    return allValidItems
      .filter(item => {
        if (selectedCategory === 'all') return true;
        
        // For emergencies, check both source AND content keywords
        if (selectedCategory === 'emergencias') {
          const sourceConfig = SOURCE_CONFIG[item.source];
          const isEmergencySource = sourceConfig?.category === 'emergencias';
          return isEmergencySource || isEmergencyNews(item);
        }
        
        const sourceConfig = SOURCE_CONFIG[item.source];
        return sourceConfig?.category === selectedCategory;
      })
      .slice(0, MAX_ITEMS_COUNT); // Limit to max 30 items
  }, [allValidItems, selectedCategory]);

  // Reset visible count when category changes
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setVisibleCount(INITIAL_ITEMS_COUNT);
  };

  const visibleItems = validItems.slice(0, visibleCount);
  const hasMore = visibleCount < validItems.length;
  const remainingCount = validItems.length - visibleCount;

  const loadMore = () => {
    setVisibleCount(prev => prev + LOAD_MORE_COUNT);
  };

  const categories = ['all', 'nacionales', 'internacionales', 'deportes', 'emergencias'];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-full bg-destructive/10">
              <Newspaper className="w-4 h-4 text-destructive" />
            </div>
            Últimas Noticias
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>
        {fetchedAt && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Actualizado {formatNewsTime(fetchedAt)}
          </p>
        )}
        
        {/* Category filter */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Filter className="w-3 h-3 text-muted-foreground" />
          {categories.map(category => {
            const count = categoryCounts[category] || 0;
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={() => handleCategoryChange(category)}
              >
                {CATEGORY_LABELS[category]}
                <span className={cn(
                  "text-[9px] px-1 py-0.5 rounded-full min-w-[16px] text-center",
                  selectedCategory === category 
                    ? "bg-primary-foreground/20 text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              </Button>
            );
          })}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {/* N+ Streaming en vivo link */}
        <a
          href="https://www.youtube.com/live/p2AzyIEuFak?si=L9WTy72PmRc9YTai"
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          <div className={cn(
            "p-3 rounded-lg border-2 border-red-500/50 bg-gradient-to-r from-red-500/10 to-orange-500/10",
            "hover:border-red-500 hover:shadow-md",
            "transition-all duration-200 active:scale-[0.99]"
          )}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/20 animate-pulse">
                <Radio className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-500 uppercase tracking-wide">EN VIVO</span>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-red-500 transition-colors">
                  N+ Streaming en vivo
                </h3>
              </div>
              <ExternalLink className="w-5 h-5 text-red-500/70 group-hover:text-red-500 transition-colors" />
            </div>
          </div>
        </a>

        {loading && validItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm">Cargando noticias...</p>
          </div>
        ) : error && validItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-2 text-destructive/50" />
            <p className="text-sm">Error al cargar noticias</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={refresh}
            >
              Reintentar
            </Button>
          </div>
        ) : validItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Newspaper className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Sin noticias en esta región</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleItems.map((item, index) => (
                <NewsCard key={`${item.link}-${index}`} item={item} />
              ))}
            </div>
            
            {/* Load more button */}
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={loadMore}
              >
                <Loader2 className="w-3 h-3 mr-2" />
                Ver más noticias ({remainingCount} restantes)
              </Button>
            )}
          </>
        )}
        
        {/* Sources info */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center">
            Fuentes: Milenio, El Universal, CNN, BBC, Reuters, ESPN, TyC Sports, Fox Sports, Olé, CENAPRED
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BreakingNewsSection;
