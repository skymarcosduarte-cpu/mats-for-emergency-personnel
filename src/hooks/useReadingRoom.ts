import { useState, useEffect, useCallback, useMemo } from 'react';

// ============ Types ============
export type ReadingCategory = 
  | 'books' 
  | 'medical' 
  | 'latam' 
  | 'dictionary' 
  | 'nutrition' 
  | 'finance' 
  | 'weather';

export interface ReadingItem {
  id: string;
  type: ReadingCategory;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  metadata?: Record<string, any>;
}

export interface SearchHistory {
  query: string;
  category: ReadingCategory;
  timestamp: number;
}

// PubMed Filter Types
export type PubMedDateFilter = 'all' | '1week' | '1month' | '1year' | '5years';
export type PubMedStudyType = 'all' | 'clinical_trial' | 'review' | 'meta_analysis' | 'case_report' | 'randomized_controlled_trial';
export type PubMedCategory = 'all' | 'trauma' | 'emergency' | 'critical_care' | 'protocols' | 'surgery' | 'cardiology' | 'neurology';

export interface PubMedFilters {
  dateFilter: PubMedDateFilter;
  studyType: PubMedStudyType;
  category: PubMedCategory;
}

export const PUBMED_DATE_OPTIONS: { value: PubMedDateFilter; label: string }[] = [
  { value: 'all', label: 'Todo el tiempo' },
  { value: '1week', label: 'Última semana' },
  { value: '1month', label: 'Último mes' },
  { value: '1year', label: 'Último año' },
  { value: '5years', label: 'Últimos 5 años' },
];

export const PUBMED_STUDY_OPTIONS: { value: PubMedStudyType; label: string }[] = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'clinical_trial', label: 'Ensayo clínico' },
  { value: 'randomized_controlled_trial', label: 'Ensayo controlado aleatorio' },
  { value: 'review', label: 'Revisión' },
  { value: 'meta_analysis', label: 'Meta-análisis' },
  { value: 'case_report', label: 'Reporte de caso' },
];

export const PUBMED_CATEGORY_OPTIONS: { value: PubMedCategory; label: string }[] = [
  { value: 'all', label: 'Todas las categorías' },
  { value: 'trauma', label: 'Trauma' },
  { value: 'emergency', label: 'Emergencias' },
  { value: 'critical_care', label: 'Cuidados Intensivos' },
  { value: 'protocols', label: 'Protocolos' },
  { value: 'surgery', label: 'Cirugía' },
  { value: 'cardiology', label: 'Cardiología' },
  { value: 'neurology', label: 'Neurología' },
];

const FAVORITES_KEY = 'reading_room_favorites';
const HISTORY_KEY = 'reading_room_history';
const MAX_HISTORY = 10;

// ============ Category Config ============
export const CATEGORY_CONFIG: Record<ReadingCategory, { label: string; icon: string; description: string }> = {
  books: { label: 'Libros', icon: '📚', description: 'Open Library' },
  medical: { label: 'Médico', icon: '🏥', description: 'PubMed' },
  latam: { label: 'LATAM', icon: '🌎', description: 'SciELO' },
  dictionary: { label: 'Diccionario', icon: '📖', description: 'Free Dictionary' },
  nutrition: { label: 'Nutrición', icon: '🥗', description: 'Open Food Facts' },
  finance: { label: 'Finanzas', icon: '💱', description: 'Exchange Rates' },
  weather: { label: 'Clima', icon: '🌤️', description: 'OpenWeatherMap' },
};

// ============ API Functions ============

// Open Library - Free Books
async function searchOpenLibrary(query: string): Promise<ReadingItem[]> {
  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`
    );
    const data = await response.json();
    
    return (data.docs || []).slice(0, 20).map((book: any) => ({
      id: `ol-${book.key}`,
      type: 'books' as ReadingCategory,
      title: book.title || 'Sin título',
      subtitle: book.author_name?.join(', ') || 'Autor desconocido',
      description: book.first_sentence?.join(' ') || `Publicado: ${book.first_publish_year || 'Año desconocido'}`,
      imageUrl: book.cover_i 
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` 
        : undefined,
      link: `https://openlibrary.org${book.key}`,
      metadata: {
        year: book.first_publish_year,
        languages: book.language,
        pages: book.number_of_pages_median,
      },
    }));
  } catch (error) {
    console.error('[ReadingRoom] Open Library error:', error);
    throw new Error('Error al buscar libros');
  }
}

// PubMed - Medical Articles with filters
async function searchPubMed(query: string, filters: PubMedFilters): Promise<ReadingItem[]> {
  try {
    // Build the search term with filters
    let searchTerm = encodeURIComponent(query);
    
    // Add category filter
    if (filters.category !== 'all') {
      const categoryTerms: Record<PubMedCategory, string> = {
        all: '',
        trauma: 'trauma[MeSH Terms]',
        emergency: 'emergency medicine[MeSH Terms]',
        critical_care: 'critical care[MeSH Terms]',
        protocols: 'clinical protocols[MeSH Terms]',
        surgery: 'surgery[MeSH Terms]',
        cardiology: 'cardiology[MeSH Terms]',
        neurology: 'neurology[MeSH Terms]',
      };
      searchTerm += `+AND+${encodeURIComponent(categoryTerms[filters.category])}`;
    }
    
    // Add study type filter
    if (filters.studyType !== 'all') {
      const studyTypeTerms: Record<PubMedStudyType, string> = {
        all: '',
        clinical_trial: 'Clinical Trial[pt]',
        randomized_controlled_trial: 'Randomized Controlled Trial[pt]',
        review: 'Review[pt]',
        meta_analysis: 'Meta-Analysis[pt]',
        case_report: 'Case Reports[pt]',
      };
      searchTerm += `+AND+${encodeURIComponent(studyTypeTerms[filters.studyType])}`;
    }
    
    // Add date filter
    let dateParam = '';
    if (filters.dateFilter !== 'all') {
      const dateRanges: Record<PubMedDateFilter, string> = {
        all: '',
        '1week': '&datetype=pdat&reldate=7',
        '1month': '&datetype=pdat&reldate=30',
        '1year': '&datetype=pdat&reldate=365',
        '5years': '&datetype=pdat&reldate=1825',
      };
      dateParam = dateRanges[filters.dateFilter];
    }
    
    // First get IDs
    const searchResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${searchTerm}&retmode=json&retmax=20${dateParam}`
    );
    const searchData = await searchResponse.json();
    const ids = searchData.esearchresult?.idlist || [];
    
    if (ids.length === 0) return [];
    
    // Then get details
    const summaryResponse = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
    );
    const summaryData = await summaryResponse.json();
    
    return ids.map((id: string) => {
      const article = summaryData.result?.[id] || {};
      const pubTypes = article.pubtype || [];
      
      return {
        id: `pm-${id}`,
        type: 'medical' as ReadingCategory,
        title: article.title || 'Sin título',
        subtitle: article.authors?.map((a: any) => a.name).slice(0, 3).join(', ') || 'Autores desconocidos',
        description: article.source ? `${article.source} (${article.pubdate})` : '',
        link: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        metadata: {
          journal: article.source,
          date: article.pubdate,
          pmid: id,
          pubTypes: pubTypes,
        },
      };
    });
  } catch (error) {
    console.error('[ReadingRoom] PubMed error:', error);
    throw new Error('Error al buscar artículos médicos');
  }
}


// SciELO - Latin American Journals (simplified search via web)
async function searchScielo(query: string): Promise<ReadingItem[]> {
  try {
    // SciELO doesn't have a simple public API, we'll create placeholder results
    // that link to SciELO search
    const searchUrl = `https://search.scielo.org/?q=${encodeURIComponent(query)}&lang=es`;
    
    return [{
      id: 'scielo-search',
      type: 'latam' as ReadingCategory,
      title: `Buscar "${query}" en SciELO`,
      subtitle: 'Revistas científicas de América Latina',
      description: 'Haz clic para buscar en SciELO - Scientific Electronic Library Online',
      link: searchUrl,
      metadata: { isSearchLink: true },
    }];
  } catch (error) {
    console.error('[ReadingRoom] SciELO error:', error);
    throw new Error('Error al buscar en SciELO');
  }
}

// Free Dictionary
async function searchDictionary(word: string): Promise<ReadingItem[]> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return [{
          id: 'dict-not-found',
          type: 'dictionary' as ReadingCategory,
          title: `"${word}" no encontrado`,
          description: 'Intenta con otra palabra o revisa la ortografía',
          metadata: { notFound: true },
        }];
      }
      throw new Error('Error en la búsqueda');
    }
    
    const data = await response.json();
    
    return data.map((entry: any, index: number) => {
      const meanings = entry.meanings || [];
      const definitions = meanings
        .flatMap((m: any) => m.definitions?.slice(0, 2) || [])
        .map((d: any) => d.definition)
        .slice(0, 3)
        .join(' • ');
      
      const phonetic = entry.phonetics?.find((p: any) => p.text)?.text || '';
      
      return {
        id: `dict-${entry.word}-${index}`,
        type: 'dictionary' as ReadingCategory,
        title: entry.word,
        subtitle: phonetic,
        description: definitions,
        link: entry.sourceUrls?.[0],
        metadata: {
          phonetics: entry.phonetics,
          meanings: meanings,
          origin: entry.origin,
        },
      };
    });
  } catch (error) {
    console.error('[ReadingRoom] Dictionary error:', error);
    throw new Error('Error al buscar definición');
  }
}

// Open Food Facts - Nutrition
async function searchNutrition(query: string): Promise<ReadingItem[]> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=true&page_size=20`
    );
    const data = await response.json();
    
    return (data.products || []).slice(0, 20).map((product: any) => ({
      id: `off-${product.code || product._id}`,
      type: 'nutrition' as ReadingCategory,
      title: product.product_name || 'Producto sin nombre',
      subtitle: product.brands || 'Marca desconocida',
      description: product.nutriments ? 
        `Calorías: ${product.nutriments['energy-kcal_100g'] || '?'} kcal/100g • ` +
        `Proteínas: ${product.nutriments.proteins_100g || '?'}g • ` +
        `Carbos: ${product.nutriments.carbohydrates_100g || '?'}g` : 
        'Información nutricional no disponible',
      imageUrl: product.image_small_url || product.image_url,
      link: `https://world.openfoodfacts.org/product/${product.code}`,
      metadata: {
        nutriscore: product.nutriscore_grade,
        categories: product.categories,
        nutriments: product.nutriments,
      },
    }));
  } catch (error) {
    console.error('[ReadingRoom] Open Food Facts error:', error);
    throw new Error('Error al buscar información nutricional');
  }
}

// Exchange Rates
async function getExchangeRates(): Promise<ReadingItem[]> {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/MXN');
    const data = await response.json();
    
    const importantRates = ['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'BRL', 'ARS', 'COP', 'CLP'];
    
    return importantRates.map(currency => {
      const rate = data.rates?.[currency];
      const mxnPer1 = rate ? (1 / rate).toFixed(2) : '?';
      
      return {
        id: `fx-${currency}`,
        type: 'finance' as ReadingCategory,
        title: `1 ${currency}`,
        subtitle: `= ${mxnPer1} MXN`,
        description: `Tipo de cambio: ${rate?.toFixed(6) || 'No disponible'}`,
        metadata: {
          currency,
          rate,
          base: 'MXN',
          lastUpdate: data.date,
        },
      };
    });
  } catch (error) {
    console.error('[ReadingRoom] Exchange Rate error:', error);
    throw new Error('Error al obtener tipos de cambio');
  }
}

// Weather - Basic without API key (using Open-Meteo as fallback)
async function getWeather(city: string = 'Ciudad de México'): Promise<ReadingItem[]> {
  try {
    // Use Open-Meteo which doesn't require API key
    // First get coordinates
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`
    );
    const geoData = await geoResponse.json();
    
    if (!geoData.results?.length) {
      return [{
        id: 'weather-not-found',
        type: 'weather' as ReadingCategory,
        title: `"${city}" no encontrado`,
        description: 'Intenta con otra ciudad',
        metadata: { notFound: true },
      }];
    }
    
    const { latitude, longitude, name, country } = geoData.results[0];
    
    // Then get weather
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=5`
    );
    const weatherData = await weatherResponse.json();
    
    const current = weatherData.current;
    const daily = weatherData.daily;
    
    const weatherCodes: Record<number, string> = {
      0: '☀️ Despejado',
      1: '🌤️ Mayormente despejado',
      2: '⛅ Parcialmente nublado',
      3: '☁️ Nublado',
      45: '🌫️ Neblina',
      48: '🌫️ Neblina helada',
      51: '🌧️ Llovizna ligera',
      53: '🌧️ Llovizna',
      55: '🌧️ Llovizna densa',
      61: '🌧️ Lluvia ligera',
      63: '🌧️ Lluvia',
      65: '🌧️ Lluvia intensa',
      71: '🌨️ Nieve ligera',
      73: '🌨️ Nieve',
      75: '🌨️ Nieve intensa',
      95: '⛈️ Tormenta',
    };
    
    const items: ReadingItem[] = [{
      id: 'weather-current',
      type: 'weather' as ReadingCategory,
      title: `${name}, ${country}`,
      subtitle: `${current?.temperature_2m || '?'}°C - ${weatherCodes[current?.weather_code] || 'N/A'}`,
      description: `Humedad: ${current?.relative_humidity_2m || '?'}% • Viento: ${current?.wind_speed_10m || '?'} km/h`,
      metadata: {
        current,
        isCurrent: true,
      },
    }];
    
    // Add forecast
    if (daily?.time) {
      daily.time.slice(1, 5).forEach((date: string, index: number) => {
        items.push({
          id: `weather-forecast-${index}`,
          type: 'weather' as ReadingCategory,
          title: new Date(date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
          subtitle: weatherCodes[daily.weather_code?.[index + 1]] || 'N/A',
          description: `Max: ${daily.temperature_2m_max?.[index + 1]}°C • Min: ${daily.temperature_2m_min?.[index + 1]}°C`,
          metadata: {
            date,
            isForecast: true,
          },
        });
      });
    }
    
    return items;
  } catch (error) {
    console.error('[ReadingRoom] Weather error:', error);
    throw new Error('Error al obtener el clima');
  }
}


// ============ Main Hook ============
export function useReadingRoom() {
  const [activeCategory, setActiveCategory] = useState<ReadingCategory>('books');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<ReadingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  
  // PubMed filters
  const [pubmedFilters, setPubmedFilters] = useState<PubMedFilters>({
    dateFilter: 'all',
    studyType: 'all',
    category: 'all',
  });

  // Load favorites and history from localStorage
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem(FAVORITES_KEY);
      if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
      
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.error('[ReadingRoom] Error loading saved data:', e);
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.error('[ReadingRoom] Error saving favorites:', e);
    }
  }, [favorites]);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory));
    } catch (e) {
      console.error('[ReadingRoom] Error saving history:', e);
    }
  }, [searchHistory]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search function
  const performSearch = useCallback(async (query: string, category: ReadingCategory, filters?: PubMedFilters) => {
    if (!query.trim() && !['finance', 'weather'].includes(category)) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let items: ReadingItem[] = [];

      switch (category) {
        case 'books':
          items = await searchOpenLibrary(query);
          break;
        case 'medical':
          items = await searchPubMed(query, filters || pubmedFilters);
          break;
        case 'latam':
          items = await searchScielo(query);
          break;
        case 'dictionary':
          items = await searchDictionary(query);
          break;
        case 'nutrition':
          items = await searchNutrition(query);
          break;
        case 'finance':
          items = await getExchangeRates();
          break;
        case 'weather':
          items = await getWeather(query || 'Ciudad de México');
          break;
      }

      setResults(items);

      // Add to history if it's a search query
      if (query.trim()) {
        setSearchHistory(prev => {
          const filtered = prev.filter(h => !(h.query === query && h.category === category));
          return [{ query, category, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
        });
      }
    } catch (err) {
      console.error('[ReadingRoom] Search error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [pubmedFilters]);

  // Auto-search when debounced query, category or pubmed filters change
  useEffect(() => {
    performSearch(debouncedQuery, activeCategory, pubmedFilters);
  }, [debouncedQuery, activeCategory, performSearch, pubmedFilters]);

  // Toggle favorite
  const toggleFavorite = useCallback((itemId: string) => {
    setFavorites(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  }, []);

  // Check if item is favorite
  const isFavorite = useCallback((itemId: string) => {
    return favorites.includes(itemId);
  }, [favorites]);

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  // Remove single history item
  const removeFromHistory = useCallback((query: string, category: ReadingCategory) => {
    setSearchHistory(prev => 
      prev.filter(h => !(h.query === query && h.category === category))
    );
  }, []);

  // Get favorite items (need to search for them)
  const favoriteItems = useMemo(() => {
    return results.filter(item => favorites.includes(item.id));
  }, [results, favorites]);

  return {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    results,
    loading,
    error,
    favorites,
    searchHistory,
    toggleFavorite,
    isFavorite,
    clearHistory,
    removeFromHistory,
    refresh: () => performSearch(debouncedQuery, activeCategory, pubmedFilters),
    categories: Object.entries(CATEGORY_CONFIG).map(([key, config]) => ({
      id: key as ReadingCategory,
      ...config,
    })),
    // PubMed filters
    pubmedFilters,
    setPubmedFilters,
  };
}
