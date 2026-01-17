import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Heart,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  useReadingRoom, 
  ReadingCategory, 
  ReadingItem, 
  CATEGORY_CONFIG 
} from '@/hooks/useReadingRoom';

// ============ Result Card Component ============
interface ResultCardProps {
  item: ReadingItem;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

function ResultCard({ item, isFavorite, onToggleFavorite }: ResultCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Image */}
          {item.imageUrl && (
            <div className="w-16 h-20 flex-shrink-0 rounded overflow-hidden bg-muted">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm text-foreground line-clamp-2">
                {item.title}
              </h4>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
              >
                <Heart
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                  )}
                />
              </Button>
            </div>

            {item.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {item.subtitle}
              </p>
            )}

            {item.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {item.description}
              </p>
            )}

            {/* Metadata badges */}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {CATEGORY_CONFIG[item.type]?.icon} {CATEGORY_CONFIG[item.type]?.label}
              </Badge>
              
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Category Button ============
interface CategoryButtonProps {
  id: ReadingCategory;
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}

function CategoryButton({ id, label, icon, isActive, onClick }: CategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-2 rounded-lg transition-all',
        'min-w-[72px] text-center',
        isActive
          ? 'bg-primary text-primary-foreground shadow-md'
          : 'bg-muted/50 hover:bg-muted text-muted-foreground'
      )}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-[10px] font-medium mt-0.5 line-clamp-1">{label}</span>
    </button>
  );
}

// ============ Main Component ============
export function ReadingRoomTab() {
  const {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    results,
    loading,
    error,
    searchHistory,
    toggleFavorite,
    isFavorite,
    clearHistory,
    removeFromHistory,
    refresh,
    categories,
  } = useReadingRoom();

  const [showHistory, setShowHistory] = useState(false);

  const currentCategoryConfig = CATEGORY_CONFIG[activeCategory];
  const needsSearch = !['finance', 'weather', 'bestsellers'].includes(activeCategory);
  
  // Get placeholder text based on category
  const getPlaceholder = () => {
    switch (activeCategory) {
      case 'books':
        return 'Buscar libros por título o autor...';
      case 'medical':
        return 'Buscar artículos médicos (ej: diabetes, trauma)...';
      case 'papers':
        return 'Buscar papers científicos...';
      case 'latam':
        return 'Buscar en revistas latinoamericanas...';
      case 'dictionary':
        return 'Buscar palabra en inglés...';
      case 'nutrition':
        return 'Buscar alimento (ej: manzana, arroz)...';
      case 'weather':
        return 'Buscar ciudad (ej: Guadalajara, Monterrey)...';
      default:
        return 'Buscar...';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-5 h-5 text-primary" />
            Sala de Lectura
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Explora libros, artículos médicos, papers y más recursos gratuitos
          </p>
        </CardHeader>
      </Card>

      {/* Category Selector - Horizontal scroll */}
      <ScrollArea className="w-full pb-2">
        <div className="flex gap-2 px-1">
          {categories.map((cat) => (
            <CategoryButton
              key={cat.id}
              id={cat.id}
              label={cat.label}
              icon={cat.icon}
              isActive={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={getPlaceholder()}
          className="pl-9 pr-20"
          onFocus={() => searchHistory.length > 0 && setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 200)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>

        {/* Search History Dropdown */}
        {showHistory && searchHistory.length > 0 && (
          <Card className="absolute top-full mt-1 left-0 right-0 z-50 shadow-lg">
            <CardContent className="p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Búsquedas recientes
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={clearHistory}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Limpiar
                </Button>
              </div>
              <div className="space-y-1">
                {searchHistory.slice(0, 5).map((item, index) => (
                  <button
                    key={`${item.query}-${item.category}-${index}`}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-muted text-left"
                    onClick={() => {
                      setActiveCategory(item.category);
                      setSearchQuery(item.query);
                      setShowHistory(false);
                    }}
                  >
                    <span className="text-sm truncate">{item.query}</span>
                    <Badge variant="outline" className="text-[10px] ml-2">
                      {CATEGORY_CONFIG[item.category]?.icon}
                    </Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Category Info */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {currentCategoryConfig.icon} {currentCategoryConfig.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          vía {currentCategoryConfig.description}
        </span>
        {!needsSearch && (
          <Badge variant="outline" className="text-xs text-primary">
            Carga automática
          </Badge>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Buscando...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={refresh}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && results.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground mt-2">
              {needsSearch
                ? 'Escribe algo para buscar'
                : 'No hay resultados disponibles'}
            </p>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Intenta con otros términos de búsqueda
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2">
            {results.map((item) => (
              <ResultCard
                key={item.id}
                item={item}
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick Tips */}
      {!loading && !error && results.length === 0 && searchQuery === '' && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <h4 className="font-medium text-sm mb-2">💡 Sugerencias de búsqueda</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              {activeCategory === 'books' && (
                <>
                  <p>• Prueba: "primeros auxilios" o "medicina de emergencia"</p>
                  <p>• Busca por autor: "Stephen King"</p>
                </>
              )}
              {activeCategory === 'medical' && (
                <>
                  <p>• Prueba: "trauma care" o "emergency medicine"</p>
                  <p>• Busca protocolos: "CPR guidelines"</p>
                </>
              )}
              {activeCategory === 'papers' && (
                <>
                  <p>• Prueba: "machine learning" o "earthquake prediction"</p>
                  <p>• Busca por tema: "disaster response"</p>
                </>
              )}
              {activeCategory === 'dictionary' && (
                <>
                  <p>• Busca términos médicos en inglés</p>
                  <p>• Prueba: "triage" o "hemorrhage"</p>
                </>
              )}
              {activeCategory === 'nutrition' && (
                <>
                  <p>• Busca alimentos: "avena", "quinoa"</p>
                  <p>• Busca productos: "barras de proteína"</p>
                </>
              )}
              {activeCategory === 'weather' && (
                <p>• Busca cualquier ciudad del mundo</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ReadingRoomTab;
