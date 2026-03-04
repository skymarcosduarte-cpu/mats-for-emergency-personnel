import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { MapPin, Search, X, Loader2, Navigation, MapPinned, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

interface SelectedLocation {
  name: string;
  lat: number;
  lng: number;
}

interface TripLocationPickerProps {
  label: string;
  placeholder?: string;
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation | null) => void;
  currentPosition?: { lat: number; lng: number } | null;
  markerColor?: 'green' | 'orange';
}

// --- Recent Locations Storage ---
const RECENT_LOCATIONS_KEY = 'mats_recent_trip_locations';
const MAX_RECENT_LOCATIONS = 8;

function getRecentLocations(): SelectedLocation[] {
  try {
    const raw = localStorage.getItem(RECENT_LOCATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentLocation(location: SelectedLocation) {
  try {
    const existing = getRecentLocations();
    // Remove duplicates (same name or very close coords)
    const filtered = existing.filter(loc =>
      loc.name !== location.name &&
      !(Math.abs(loc.lat - location.lat) < 0.001 && Math.abs(loc.lng - location.lng) < 0.001)
    );
    // Add to front
    const updated = [location, ...filtered].slice(0, MAX_RECENT_LOCATIONS);
    localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function clearRecentLocations() {
  try {
    localStorage.removeItem(RECENT_LOCATIONS_KEY);
  } catch {
    // ignore
  }
}

export const TripLocationPicker: React.FC<TripLocationPickerProps> = ({
  label,
  placeholder = 'Buscar ubicación...',
  value,
  onChange,
  currentPosition,
  markerColor = 'orange',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [recentLocations, setRecentLocations] = useState<SelectedLocation[]>([]);
  const [livePosition, setLivePosition] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchingGps, setFetchingGps] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Effective position: use prop if available, otherwise use live GPS
  const effectivePosition = currentPosition || livePosition;

  // When picker opens, load recent locations and request GPS if needed
  useEffect(() => {
    if (!isOpen) return;
    setRecentLocations(getRecentLocations());

    // If no currentPosition prop, request GPS directly
    if (!currentPosition && navigator.geolocation) {
      setFetchingGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLivePosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setFetchingGps(false);
          // Center map on real position
          if (mapInstanceRef.current && !value) {
            mapInstanceRef.current.setView([pos.coords.latitude, pos.coords.longitude], 14, { animate: true });
          }
        },
        () => setFetchingGps(false),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }
  }, [isOpen, currentPosition]);

  // Initialize map when dialog opens
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = effectivePosition 
      ? [effectivePosition.lat, effectivePosition.lng] 
      : [19.4326, -99.1332]; // Mexico City fallback

    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: effectivePosition ? 14 : 6, // Zoom out if no GPS (so user sees they need to search)
        zoomControl: true,
        touchZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      // Click on map to select location
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        await reverseGeocode(lat, lng, map);
      });

      mapInstanceRef.current = map;
      setMapReady(true);

      // If there's already a value, show the marker
      if (value) {
        const icon = createMarkerIcon(markerColor);
        markerRef.current = L.marker([value.lat, value.lng], { icon }).addTo(map);
        map.setView([value.lat, value.lng], 15);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        setMapReady(false);
      }
    };
  }, [isOpen]);

  // When livePosition arrives after map init, re-center if no value selected
  useEffect(() => {
    if (livePosition && mapInstanceRef.current && !value) {
      mapInstanceRef.current.setView([livePosition.lat, livePosition.lng], 14, { animate: true });
    }
  }, [livePosition, value]);

  const createMarkerIcon = (color: 'green' | 'orange') => {
    const bgColor = color === 'green' ? '#22c55e' : '#f59e0b';
    return L.divIcon({
      className: 'custom-location-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: ${bgColor};
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg style="transform: rotate(45deg);" width="14" height="14" viewBox="0 0 24 24" fill="white">
            <circle cx="12" cy="12" r="4"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  };

  // Search locations using Nominatim with viewbox bias
  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setSearchDone(false);
      return;
    }

    setSearching(true);
    setSearchDone(false);
    try {
      // Build URL with viewbox bias if we have position
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=mx&limit=5&addressdetails=1`;
      
      if (effectivePosition) {
        // Add viewbox centered on user (±2 degrees) for better local results
        const vb = `${effectivePosition.lng - 2},${effectivePosition.lat + 2},${effectivePosition.lng + 2},${effectivePosition.lat - 2}`;
        url += `&viewbox=${vb}&bounded=0`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'es',
          'User-Agent': 'MATS-App/1.0',
        },
      });
      
      if (response.ok) {
        let data: LocationResult[] = await response.json();
        
        // If no results with Mexico filter, try without country filter
        if (data.length === 0) {
          let url2 = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
          if (effectivePosition) {
            const vb = `${effectivePosition.lng - 2},${effectivePosition.lat + 2},${effectivePosition.lng + 2},${effectivePosition.lat - 2}`;
            url2 += `&viewbox=${vb}&bounded=0`;
          }
          const response2 = await fetch(url2, {
            headers: {
              'Accept-Language': 'es',
              'User-Agent': 'MATS-App/1.0',
            },
          });
          if (response2.ok) {
            data = await response2.json();
          }
        }
        
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Error searching locations:', error);
    } finally {
      setSearching(false);
      setSearchDone(true);
    }
  }, [effectivePosition]);

  // Reverse geocode coordinates to address
  const reverseGeocode = async (lat: number, lng: number, mapInstance?: L.Map) => {
    const map = mapInstance || mapInstanceRef.current;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es',
            'User-Agent': 'MATS-App/1.0',
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const displayName = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        updateMarkerAndNotify({
          name: simplifyAddress(displayName),
          lat,
          lng,
        }, map);
      } else {
        updateMarkerAndNotify({
          name: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          lat,
          lng,
        }, map);
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      updateMarkerAndNotify({
        name: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        lat,
        lng,
      }, map);
    }
  };

  // Simplify long addresses
  const simplifyAddress = (address: string): string => {
    const parts = address.split(',').slice(0, 3);
    return parts.join(',').trim();
  };

  // Handle search input with debounce
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSearchDone(false);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(query);
    }, 500);
  };

  // Select a location from search results
  const handleSelectResult = (result: LocationResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    const loc: SelectedLocation = {
      name: simplifyAddress(result.display_name),
      lat,
      lng,
    };
    
    updateMarkerAndNotify(loc);
    saveRecentLocation(loc);
    setRecentLocations(getRecentLocations());
    
    setSearchQuery('');
    setSearchResults([]);
    setSearchDone(false);
  };

  // Select a recent location
  const handleSelectRecent = (loc: SelectedLocation) => {
    updateMarkerAndNotify(loc);
    // Move to front of recents
    saveRecentLocation(loc);
    setRecentLocations(getRecentLocations());
  };

  // Update marker and notify parent
  const updateMarkerAndNotify = (location: SelectedLocation, mapInstance?: L.Map) => {
    const map = mapInstance || mapInstanceRef.current;
    if (!map) {
      onChange(location);
      saveRecentLocation(location);
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([location.lat, location.lng]);
    } else {
      const icon = createMarkerIcon(markerColor);
      markerRef.current = L.marker([location.lat, location.lng], { icon }).addTo(map);
    }
    
    map.setView([location.lat, location.lng], 16, { animate: true });
    onChange(location);
    saveRecentLocation(location);
    setRecentLocations(getRecentLocations());
  };

  // Use current location
  const useCurrentLocation = () => {
    if (effectivePosition) {
      reverseGeocode(effectivePosition.lat, effectivePosition.lng);
    }
  };

  // Use search text as manual location with current map center
  const useManualLocation = () => {
    const map = mapInstanceRef.current;
    if (map && manualName.trim()) {
      const center = map.getCenter();
      const loc: SelectedLocation = {
        name: manualName.trim(),
        lat: center.lat,
        lng: center.lng,
      };
      updateMarkerAndNotify(loc);
      setManualMode(false);
      setManualName('');
    }
  };

  // Clear selection
  const clearSelection = () => {
    onChange(null);
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  };

  // Place pin at map center
  const placeMarkerAtCenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = map.getCenter();
    reverseGeocode(center.lat, center.lng, map);
  };

  // Handle clearing recent locations
  const handleClearRecents = () => {
    clearRecentLocations();
    setRecentLocations([]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      
      {/* Selected location display or button to open picker */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className={cn(
            "flex-1 justify-start text-left h-auto py-2 px-3",
            !value && "text-muted-foreground"
          )}
          onClick={() => setIsOpen(true)}
        >
          <MapPin className={cn(
            "w-4 h-4 mr-2 flex-shrink-0",
            markerColor === 'green' ? 'text-safe' : 'text-warning'
          )} />
          <span className="truncate">
            {value ? value.name : placeholder}
          </span>
        </Button>
        
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={clearSelection}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Location picker dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Seleccionar {label}</h3>
              <Button variant="ghost" size="icon" onClick={() => { setIsOpen(false); setManualMode(false); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Search + Recent Locations */}
            <div className="p-4 space-y-2 overflow-y-auto max-h-[40vh]">
              {!manualMode ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Buscar dirección, colonia, ciudad..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10"
                      autoFocus
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Current location button */}
                  {(effectivePosition || fetchingGps) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={useCurrentLocation}
                      disabled={fetchingGps || !effectivePosition}
                    >
                      {fetchingGps ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Navigation className="w-4 h-4 mr-2" />
                      )}
                      {fetchingGps ? 'Obteniendo GPS...' : 'Usar mi ubicación actual'}
                    </Button>
                  )}

                  {/* Search results */}
                  {searchResults.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      {searchResults.map((result) => (
                        <button
                          key={result.place_id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b border-border last:border-b-0"
                          onClick={() => handleSelectResult(result)}
                        >
                          <span className="line-clamp-2">{result.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Recent locations - show when no search active */}
                  {!searchQuery && recentLocations.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Ubicaciones recientes
                        </span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                          onClick={handleClearRecents}
                        >
                          <Trash2 className="w-3 h-3" />
                          Borrar
                        </button>
                      </div>
                      <div className="border border-border rounded-lg overflow-hidden">
                        {recentLocations.map((loc, idx) => (
                          <button
                            key={`${loc.lat}-${loc.lng}-${idx}`}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors border-b border-border last:border-b-0 flex items-center gap-2"
                            onClick={() => handleSelectRecent(loc)}
                          >
                            <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{loc.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No results message */}
                  {searchDone && searchResults.length === 0 && searchQuery.length >= 2 && (
                    <div className="text-center py-3 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        No se encontraron resultados para "{searchQuery}"
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Puedes tocar el mapa para seleccionar la ubicación, o escribir el nombre manualmente:
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setManualName(searchQuery);
                          setManualMode(true);
                        }}
                      >
                        <MapPinned className="w-4 h-4 mr-2" />
                        Escribir nombre manualmente
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                /* Manual name entry mode */
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Escribe el nombre del lugar y luego centra el mapa en la ubicación:
                  </p>
                  <Input
                    type="text"
                    placeholder="Nombre del lugar..."
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setManualMode(false)}
                    >
                      Volver a buscar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      disabled={!manualName.trim()}
                      onClick={useManualLocation}
                    >
                      <MapPinned className="w-4 h-4 mr-2" />
                      Usar centro del mapa
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Map */}
            <div className="flex-1 min-h-[250px] relative">
              <div ref={mapContainerRef} className="absolute inset-0" />
              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {/* Crosshair in center for easier pin placement */}
              {mapReady && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[400]">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <div className="w-[2px] h-6 bg-foreground/30 absolute" />
                    <div className="h-[2px] w-6 bg-foreground/30 absolute" />
                  </div>
                </div>
              )}
              {/* Button to place pin at center */}
              {mapReady && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[500] shadow-md text-xs"
                  onClick={placeMarkerAtCenter}
                >
                  <MapPinned className="w-3 h-3 mr-1" />
                  Seleccionar este punto
                </Button>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { setIsOpen(false); setManualMode(false); }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!value}
                onClick={() => { setIsOpen(false); setManualMode(false); }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
