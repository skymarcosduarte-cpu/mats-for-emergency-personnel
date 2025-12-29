import React, { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Filter, 
  Heart, 
  Clock, 
  AlertTriangle,
  BookOpen,
  X,
  ChevronDown,
  Mic,
  MicOff,
  LayoutGrid
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useResources, AudienceFilter, LevelFilter } from '@/hooks/useResources';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { ResourceCard } from '@/components/ResourceCard';
import { ResourceDetailModal } from '@/components/ResourceDetailModal';
import { getCategoryLabel, getCategoryIcon, getCategoryCounts } from '@/lib/resourcesCache';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ResourcesScreen() {
  const {
    pack,
    loading,
    error,
    favorites,
    recents,
    categories,
    filteredCards,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    audienceFilter,
    setAudienceFilter,
    levelFilter,
    setLevelFilter,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showRecentsOnly,
    setShowRecentsOnly,
    toggleFavorite,
    markAsViewed,
    getCard,
  } = useResources();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    if (!pack?.cards) return {};
    return getCategoryCounts(pack.cards);
  }, [pack?.cards]);

  const totalCards = pack?.cards?.length || 0;

  // Voice search
  const handleVoiceResult = useCallback((transcript: string) => {
    setSearchQuery(transcript);
    toast.success(`Buscando: "${transcript}"`);
  }, [setSearchQuery]);

  const { 
    isListening, 
    isSupported: isVoiceSupported, 
    startListening, 
    stopListening,
    transcript: voiceTranscript 
  } = useVoiceSearch({ onResult: handleVoiceResult });

  const selectedCard = selectedCardId ? getCard(selectedCardId) : null;

  const handleCardClick = (cardId: string) => {
    setSelectedCardId(cardId);
    markAsViewed(cardId);
  };

  const handleCloseDetail = () => {
    setSelectedCardId(null);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setAudienceFilter('all');
    setLevelFilter('all');
    setShowFavoritesOnly(false);
    setShowRecentsOnly(false);
  };

  const hasActiveFilters = 
    searchQuery || 
    categoryFilter !== 'all' || 
    audienceFilter !== 'all' || 
    levelFilter !== 'all' ||
    showFavoritesOnly ||
    showRecentsOnly;

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-48" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Error al cargar</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Disclaimer Banner */}
      {pack?.disclaimer && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              {pack.disclaimer}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Recursos</h1>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {totalCards} total
            </Badge>
            <Badge variant="secondary">
              {filteredCards.length} mostradas
            </Badge>
          </div>
        </div>

        {/* Search with Voice */}
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isListening ? "Escuchando..." : "Buscar recursos..."}
              value={isListening ? voiceTranscript : searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-9 pr-9",
                isListening && "border-primary animate-pulse"
              )}
              readOnly={isListening}
            />
            {searchQuery && !isListening && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Voice Search Button */}
          {isVoiceSupported && (
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              className={cn(
                "flex-shrink-0 relative",
                isListening && "animate-pulse"
              )}
              onClick={isListening ? stopListening : startListening}
              aria-label={isListening ? "Detener búsqueda por voz" : "Buscar por voz"}
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                  </span>
                </>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Quick filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            className="flex-shrink-0"
            onClick={() => {
              setShowFavoritesOnly(!showFavoritesOnly);
              setShowRecentsOnly(false);
            }}
          >
            <Heart className={cn("h-4 w-4 mr-1", showFavoritesOnly && "fill-current")} />
            Favoritos
            {favorites.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                {favorites.length}
              </Badge>
            )}
          </Button>
          
          <Button
            variant={showRecentsOnly ? "default" : "outline"}
            size="sm"
            className="flex-shrink-0"
            onClick={() => {
              setShowRecentsOnly(!showRecentsOnly);
              setShowFavoritesOnly(false);
            }}
          >
            <Clock className="h-4 w-4 mr-1" />
            Recientes
          </Button>

          <Button
            variant={categoriesOpen ? "default" : "outline"}
            size="sm"
            className="flex-shrink-0"
            onClick={() => setCategoriesOpen(!categoriesOpen)}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Categorías
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
              {categories.length}
            </Badge>
          </Button>

          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button
                variant={hasActiveFilters && !showFavoritesOnly && !showRecentsOnly ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtros
                {hasActiveFilters && (
                  <ChevronDown className="h-3 w-3 ml-1" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[70vh]">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-4">
                {/* Category */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoría</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las categorías" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {getCategoryLabel(cat)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Audience */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Audiencia</label>
                  <Select 
                    value={audienceFilter} 
                    onValueChange={(v) => setAudienceFilter(v as AudienceFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Toda audiencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toda audiencia</SelectItem>
                      <SelectItem value="publico">Público general</SelectItem>
                      <SelectItem value="personal_capacitado">Personal capacitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Level */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nivel</label>
                  <Select 
                    value={levelFilter} 
                    onValueChange={(v) => setLevelFilter(v as LevelFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los niveles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los niveles</SelectItem>
                      <SelectItem value="basico">Básico</SelectItem>
                      <SelectItem value="intermedio">Intermedio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={clearFilters}
                  >
                    Limpiar filtros
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => setFiltersOpen(false)}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>

        {/* Categories Grid */}
        <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
          <CollapsibleContent className="pt-2">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                    categoryFilter === 'all'
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border hover:border-primary"
                  )}
                >
                  <span>📚</span>
                  <span>Todas</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {totalCards}
                  </Badge>
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                      categoryFilter === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border hover:border-primary"
                    )}
                  >
                    <span>{getCategoryIcon(cat)}</span>
                    <span>{getCategoryLabel(cat)}</span>
                    <Badge 
                      variant={categoryFilter === cat ? "outline" : "secondary"} 
                      className={cn(
                        "h-5 px-1.5 text-xs",
                        categoryFilter === cat && "border-primary-foreground/30"
                      )}
                    >
                      {categoryCounts[cat] || 0}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Cards List */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 pb-24">
          {filteredCards.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                {showFavoritesOnly 
                  ? "No tienes favoritos aún"
                  : showRecentsOnly
                  ? "No has visto recursos aún"
                  : "No se encontraron recursos"}
              </p>
              {hasActiveFilters && (
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={clearFilters}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            filteredCards.map(card => (
              <ResourceCard
                key={card.id}
                card={card}
                isFavorite={favorites.includes(card.id)}
                onToggleFavorite={() => toggleFavorite(card.id)}
                onClick={() => handleCardClick(card.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Detail Modal */}
      <ResourceDetailModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={handleCloseDetail}
        isFavorite={selectedCardId ? favorites.includes(selectedCardId) : false}
        onToggleFavorite={() => selectedCardId && toggleFavorite(selectedCardId)}
      />
    </div>
  );
}
