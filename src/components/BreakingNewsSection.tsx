// Breaking News Section - Clean, fluid display of emergency news

import React from 'react';
import { 
  Newspaper, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBreakingNews, NewsItem } from '@/hooks/useBreakingNews';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const colors: Record<string, string> = {
    'CNN en Español': 'bg-red-500/10 text-red-500 border-red-500/30',
    'BBC Mundo': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    'Milenio': 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    'El Universal': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    'NY Times': 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  };
  return colors[source] || 'bg-primary/10 text-primary border-primary/30';
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
                className={cn("text-[10px] px-1.5 py-0", getSourceColor(item.source))}
              >
                {item.source}
              </Badge>
              {timeAgo && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {timeAgo}
                </span>
              )}
            </div>
            
            {/* Title */}
            <h3 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {item.title}
            </h3>
            
            {/* Description preview */}
            {item.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
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

export const BreakingNewsSection: React.FC = () => {
  const { items, loading, error, fetchedAt, refresh } = useBreakingNews();

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-full bg-destructive/10">
              <Newspaper className="w-4 h-4 text-destructive" />
            </div>
            Breaking News
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
      </CardHeader>
      
      <CardContent className="space-y-2">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm">Cargando noticias...</p>
          </div>
        ) : error && items.length === 0 ? (
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
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Newspaper className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Sin noticias recientes</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
            {items.map((item, index) => (
              <NewsCard key={`${item.link}-${index}`} item={item} />
            ))}
          </div>
        )}
        
        {/* Sources info */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center">
            Fuentes: CNN, BBC, Milenio, El Universal, NY Times
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BreakingNewsSection;
