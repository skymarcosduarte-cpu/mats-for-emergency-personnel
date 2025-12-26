// Interactive map picker for selecting a location using Leaflet
import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, X, Check, Crosshair, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface LocationPickerMapProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLat?: number;
  initialLng?: number;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// Default center (Mexico City)
const DEFAULT_CENTER: [number, number] = [19.4326, -99.1332];
const DEFAULT_ZOOM = 13;

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  isOpen,
  onClose,
  onLocationSelect,
  initialLat,
  initialLng,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const [selectedLat, setSelectedLat] = useState<number | null>(initialLat ?? null);
  const [selectedLng, setSelectedLng] = useState<number | null>(initialLng ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [addressLabel, setAddressLabel] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Create marker icon
  const createMarkerIcon = () => {
    return L.divIcon({
      html: `
        <div class="relative">
          <div class="w-8 h-8 bg-panic rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-panic rotate-45"></div>
        </div>
      `,
      className: 'custom-marker-icon',
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    });
  };

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapRef.current) return;

    const center: [number, number] = initialLat && initialLng 
      ? [initialLat, initialLng] 
      : DEFAULT_CENTER;

    mapRef.current = L.map(mapContainerRef.current, {
      center,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapRef.current);

    // Add zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

    // Add initial marker if coordinates provided
    if (initialLat && initialLng) {
      markerRef.current = L.marker([initialLat, initialLng], {
        icon: createMarkerIcon(),
      }).addTo(mapRef.current);
      setSelectedLat(initialLat);
      setSelectedLng(initialLng);
    }

    // Click handler to place marker
    mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Remove existing marker
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Add new marker
      markerRef.current = L.marker([lat, lng], {
        icon: createMarkerIcon(),
      }).addTo(mapRef.current!);

      setSelectedLat(lat);
      setSelectedLng(lng);
      
      // Reverse geocode to get address
      reverseGeocode(lat, lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, initialLat, initialLng]);

  // Reverse geocode to get address from coordinates
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`
      );
      const data = await response.json();
      if (data.display_name) {
        setAddressLabel(data.display_name);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  // Autocomplete search with debounce
  const fetchAutocomplete = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=es&countrycodes=mx`,
        {
          headers: {
            'User-Agent': 'MATS-App/1.0',
          },
        }
      );
      
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      
      const data: SearchResult[] = await response.json();
      setSearchResults(data);
      setShowResults(data.length > 0);
    } catch (error) {
      console.error('[LocationPicker] Autocomplete error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Set new debounce (300ms delay)
    debounceRef.current = setTimeout(() => {
      fetchAutocomplete(value);
    }, 300);
  };

  // Select a result from autocomplete
  const selectResult = (result: SearchResult) => {
    if (!mapRef.current) return;

    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // Move map to location
    mapRef.current.setView([lat, lng], 16);

    // Update marker
    if (markerRef.current) {
      markerRef.current.remove();
    }
    markerRef.current = L.marker([lat, lng], {
      icon: createMarkerIcon(),
    }).addTo(mapRef.current);

    setSelectedLat(lat);
    setSelectedLng(lng);
    setAddressLabel(result.display_name);
    setSearchQuery(result.display_name.split(',')[0]); // Short name in input
    setShowResults(false);
    setSearchResults([]);
  };

  // Handle search button click
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Ingresa una dirección para buscar');
      return;
    }
    
    if (searchResults.length > 0) {
      // Select first result
      selectResult(searchResults[0]);
    } else {
      // Trigger new search
      await fetchAutocomplete(searchQuery);
    }
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Center on user's current location
  const handleCenterOnMe = () => {
    if (!mapRef.current) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          mapRef.current?.setView([latitude, longitude], 16);
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('No se pudo obtener tu ubicación');
        }
      );
    }
  };

  // Confirm selection
  const handleConfirm = () => {
    if (selectedLat !== null && selectedLng !== null) {
      onLocationSelect(selectedLat, selectedLng, addressLabel || undefined);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[50000] bg-background">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-[50010] bg-card/95 backdrop-blur-sm border-b border-border p-3 safe-area-inset-top">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-panic" />
            Seleccionar ubicación
          </h2>
        </div>

        {/* Search bar with autocomplete */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                } else if (e.key === 'Escape') {
                  setShowResults(false);
                }
              }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="Buscar dirección..."
              className="pr-10"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>

            {/* Autocomplete dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-[50020] max-h-60 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.place_id}
                    onClick={() => selectResult(result)}
                    className="w-full px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0 flex items-start gap-2"
                  >
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground line-clamp-2">
                      {result.display_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCenterOnMe}
            title="Mi ubicación"
          >
            <Crosshair className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Click overlay to close autocomplete */}
      {showResults && (
        <div 
          className="absolute inset-0 z-[50005]" 
          onClick={() => setShowResults(false)}
        />
      )}

      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Selected location info & confirm button */}
      <footer className="absolute bottom-0 left-0 right-0 z-[50010] bg-card/95 backdrop-blur-sm border-t border-border p-4 safe-area-inset-bottom">
        {selectedLat !== null && selectedLng !== null ? (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Ubicación seleccionada:</p>
              {addressLabel && (
                <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">
                  {addressLabel}
                </p>
              )}
              <p className="text-xs text-muted-foreground font-mono">
                {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
              </p>
            </div>
            <Button
              onClick={handleConfirm}
              className="w-full h-12 bg-panic hover:bg-panic/90 text-white font-semibold"
            >
              <Check className="w-5 h-5 mr-2" />
              Confirmar ubicación
            </Button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              Toca el mapa para seleccionar una ubicación
            </p>
          </div>
        )}
      </footer>
    </div>
  );
};

export default LocationPickerMap;
