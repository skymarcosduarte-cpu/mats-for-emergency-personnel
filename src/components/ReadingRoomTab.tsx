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
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  useReadingRoom, 
  ReadingCategory, 
  ReadingItem, 
  CATEGORY_CONFIG,
  PUBMED_DATE_OPTIONS,
  PUBMED_STUDY_OPTIONS,
  PUBMED_CATEGORY_OPTIONS,
  PubMedDateFilter,
  PubMedStudyType,
  PubMedCategory,
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
        'flex flex-col items-center justify-center p-2 rounded-lg transition-all flex-shrink-0',
        'w-[68px] text-center',
        isActive
          ? 'bg-primary text-primary-foreground shadow-md'
          : 'bg-muted/50 hover:bg-muted text-muted-foreground'
      )}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[9px] font-medium mt-0.5 leading-tight">{label}</span>
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
    pubmedFilters,
    setPubmedFilters,
  } = useReadingRoom();

  const [showHistory, setShowHistory] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const currentCategoryConfig = CATEGORY_CONFIG[activeCategory];
  const needsSearch = !['finance', 'weather'].includes(activeCategory);
  
  // Check if any PubMed filter is active
  const hasActiveFilters = activeCategory === 'medical' && (
    pubmedFilters.dateFilter !== 'all' ||
    pubmedFilters.studyType !== 'all' ||
    pubmedFilters.category !== 'all'
  );
  
  // Reset filters
  const resetFilters = () => {
    setPubmedFilters({
      dateFilter: 'all',
      studyType: 'all',
      category: 'all',
    });
  };
  
  // Get placeholder text based on category
  const getPlaceholder = () => {
    switch (activeCategory) {
      case 'books':
        return 'Buscar libros por título o autor...';
      case 'medical':
        return 'Buscar artículos médicos (ej: diabetes, trauma)...';
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
      <div className="flex items-center gap-2 flex-wrap">
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
        
        {/* Filter toggle for medical */}
        {activeCategory === 'medical' && (
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs ml-auto"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3 w-3 mr-1" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-[10px] rounded-full">
                {[pubmedFilters.dateFilter, pubmedFilters.studyType, pubmedFilters.category]
                  .filter(f => f !== 'all').length}
              </Badge>
            )}
            {showFilters ? (
              <ChevronUp className="h-3 w-3 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" />
            )}
          </Button>
        )}
      </div>

      {/* PubMed Filters Panel */}
      {activeCategory === 'medical' && showFilters && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-1">
                <Filter className="h-4 w-4" /> Filtros Avanzados
              </h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={resetFilters}
                >
                  <X className="h-3 w-3 mr-1" /> Limpiar
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Date Filter */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fecha de publicación</label>
                <Select
                  value={pubmedFilters.dateFilter}
                  onValueChange={(value: PubMedDateFilter) => 
                    setPubmedFilters(prev => ({ ...prev, dateFilter: value }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar fecha" />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBMED_DATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Study Type Filter */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo de estudio</label>
                <Select
                  value={pubmedFilters.studyType}
                  onValueChange={(value: PubMedStudyType) => 
                    setPubmedFilters(prev => ({ ...prev, studyType: value }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBMED_STUDY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Categoría médica</label>
                <Select
                  value={pubmedFilters.category}
                  onValueChange={(value: PubMedCategory) => 
                    setPubmedFilters(prev => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBMED_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1 pt-1">
                <span className="text-xs text-muted-foreground">Filtros activos:</span>
                {pubmedFilters.dateFilter !== 'all' && (
                  <Badge variant="secondary" className="text-[10px]">
                    {PUBMED_DATE_OPTIONS.find(o => o.value === pubmedFilters.dateFilter)?.label}
                  </Badge>
                )}
                {pubmedFilters.studyType !== 'all' && (
                  <Badge variant="secondary" className="text-[10px]">
                    {PUBMED_STUDY_OPTIONS.find(o => o.value === pubmedFilters.studyType)?.label}
                  </Badge>
                )}
                {pubmedFilters.category !== 'all' && (
                  <Badge variant="secondary" className="text-[10px]">
                    {PUBMED_CATEGORY_OPTIONS.find(o => o.value === pubmedFilters.category)?.label}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
