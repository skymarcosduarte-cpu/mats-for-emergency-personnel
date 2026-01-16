import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Car, Plane, Clock, MapPin, Navigation, Loader2, AlertCircle, Route, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TripRouteMap from '@/components/TripRouteMap';
import MapErrorBoundary from '@/components/MapErrorBoundary';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, differenceInMinutes, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import MatsLogo from '@/components/MatsLogo';

interface SharedTrip {
  id: string;
  origin: string;
  destination: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  eta: string;
  transit_type: string;
  status: string;
  plates: string | null;
  vehicle_type: string | null;
  airline: string | null;
  flight_number: string | null;
  created_at: string;
}

interface UserLocation {
  lat: number;
  lng: number;
  updated_at: string;
  speed: number | null;
}

export default function SharedTripPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [routeHistory, setRouteHistory] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hide the native splash screen on mount (for public pages)
  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && (window as any).hideNativeSplash) {
      (window as any).hideNativeSplash();
    }
  }, []);

  // Fetch trip data
  const fetchTrip = useCallback(async () => {
    if (!shareToken) {
      setError('Link inválido');
      setLoading(false);
      return;
    }

    try {
      // Fetch trip by share_token
      const { data: tripData, error: tripError } = await supabase
        .from('transit_trips')
        .select('*')
        .eq('share_token', shareToken)
        .eq('status', 'ACTIVE')
        .single();

      if (tripError || !tripData) {
        setError('Viaje no encontrado o ya finalizó');
        setLoading(false);
        return;
      }

      setTrip(tripData);

      // Fetch user location
      const { data: locationData } = await supabase
        .from('user_locations')
        .select('lat, lng, updated_at, speed')
        .eq('user_id', tripData.user_id)
        .eq('is_online', true)
        .single();

      if (locationData) {
        setLocation(locationData);
      }

      // Fetch route history
      const { data: historyData } = await supabase
        .from('trip_position_history')
        .select('lat, lng')
        .eq('trip_id', tripData.id)
        .order('recorded_at', { ascending: true });

      if (historyData) {
        setRouteHistory(historyData.map(p => [p.lat, p.lng]));
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching shared trip:', err);
      setError('Error al cargar el viaje');
      setLoading(false);
    }
  }, [shareToken]);

  // Initial fetch
  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!trip) return;

    const interval = setInterval(fetchTrip, 30000);
    return () => clearInterval(interval);
  }, [trip, fetchTrip]);

  // Format ETA
  const formatEta = (eta: string) => {
    const etaDate = new Date(eta);
    const now = new Date();
    
    if (isPast(etaDate)) {
      return { text: 'Llegando...', isLate: true };
    }
    
    const minutesRemaining = differenceInMinutes(etaDate, now);
    
    if (minutesRemaining < 60) {
      return { text: `${minutesRemaining} min`, isLate: false };
    } else {
      const hours = Math.floor(minutesRemaining / 60);
      const mins = minutesRemaining % 60;
      return { text: `${hours}h ${mins > 0 ? `${mins}m` : ''}`, isLate: false };
    }
  };

  // Calculate remaining distance
  const calculateRemainingDistance = () => {
    if (!location || !trip?.destination_lat || !trip?.destination_lng) return null;
    
    const R = 6371; // Earth radius in km
    const dLat = (trip.destination_lat - location.lat) * Math.PI / 180;
    const dLon = (trip.destination_lng - location.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(location.lat * Math.PI / 180) * Math.cos(trip.destination_lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const remainingKm = calculateRemainingDistance();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando viaje...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Viaje no disponible</h2>
            <p className="text-muted-foreground mb-6">
              {error || 'El viaje que buscas no existe o ya ha finalizado.'}
            </p>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ir a M.A.T.S.
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const etaInfo = formatEta(trip.eta);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-3">
          <MatsLogo className="w-10 h-10" />
          <div>
            <h1 className="font-bold">M.A.T.S.</h1>
            <p className="text-xs opacity-80">Seguimiento de Viaje</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4 pb-8">
        {/* Trip Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-2xl">
            {trip.transit_type === 'FLIGHT' ? '✈️' : '🚗'}
          </div>
          <div>
            <h2 className="text-lg font-semibold">Viaje en curso</h2>
            <p className="text-sm text-muted-foreground">
              {trip.origin} → {trip.destination}
            </p>
          </div>
        </div>

        {/* Map */}
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <MapErrorBoundary
              context={{
                source: 'SharedTripPage',
                tripId: trip.id,
                origin: { lat: trip.origin_lat, lng: trip.origin_lng },
                destination: { lat: trip.destination_lat, lng: trip.destination_lng },
                hasLocation: !!location,
                routePoints: routeHistory.length,
              }}
              tripData={{
                originLat: trip.origin_lat,
                originLng: trip.origin_lng,
                destinationLat: trip.destination_lat,
                destinationLng: trip.destination_lng,
                currentLat: location?.lat,
                currentLng: location?.lng,
              }}
            >
              <TripRouteMap
                routeCoordinates={routeHistory}
                originCoords={
                  trip.origin_lat !== null && trip.origin_lng !== null
                    ? { lat: trip.origin_lat, lng: trip.origin_lng }
                    : null
                }
                destinationCoords={
                  trip.destination_lat !== null && trip.destination_lng !== null
                    ? { lat: trip.destination_lat, lng: trip.destination_lng }
                    : null
                }
                currentPosition={location ? { lat: location.lat, lng: location.lng } : null}
                originName={trip.origin}
                destinationName={trip.destination}
                height="300px"
              />
            </MapErrorBoundary>
          </CardContent>
        </Card>

        {/* Trip Info Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* ETA */}
          <Card>
            <CardContent className="p-3 flex flex-col items-center justify-center">
              <Clock className="w-6 h-6 text-amber-500 mb-1" />
              <span className="text-xs text-muted-foreground">ETA</span>
              <Badge 
                variant={etaInfo.isLate ? "destructive" : "secondary"}
                className={cn(
                  "mt-1",
                  !etaInfo.isLate && "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                )}
              >
                {etaInfo.text}
              </Badge>
            </CardContent>
          </Card>

          {/* Distance */}
          <Card>
            <CardContent className="p-3 flex flex-col items-center justify-center">
              <MapPin className="w-6 h-6 text-primary mb-1" />
              <span className="text-xs text-muted-foreground">Distancia</span>
              <span className="font-semibold text-sm mt-1">
                {remainingKm !== null ? `${remainingKm.toFixed(1)} km` : '--'}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Trip Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              Detalles del viaje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Route */}
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-safe" />
              <span className="text-muted-foreground">Origen:</span>
              <span className="font-medium">{trip.origin}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span className="text-muted-foreground">Destino:</span>
              <span className="font-medium">{trip.destination}</span>
            </div>

            {/* Flight info */}
            {trip.transit_type === 'FLIGHT' && trip.flight_number && (
              <div className="flex items-center gap-2 text-sm pt-2 border-t">
                <Plane className="w-4 h-4 text-blue-500" />
                <span className="text-muted-foreground">Vuelo:</span>
                <span className="font-medium">{trip.airline} {trip.flight_number}</span>
              </div>
            )}

            {/* Vehicle info */}
            {trip.transit_type === 'ROAD' && trip.plates && (
              <div className="flex items-center gap-2 text-sm pt-2 border-t">
                <Car className="w-4 h-4 text-amber-500" />
                <span className="text-muted-foreground">Placas:</span>
                <span className="font-medium">{trip.plates}</span>
              </div>
            )}

            {/* Last update */}
            {location && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                <span className="w-2 h-2 bg-safe rounded-full animate-pulse" />
                Última actualización: {formatDistanceToNow(new Date(location.updated_at), { addSuffix: true, locale: es })}
              </div>
            )}

            {/* Route history badge */}
            {routeHistory.length > 0 && (
              <div className="pt-2">
                <Badge variant="outline" className="text-xs">
                  <Route className="w-3 h-3 mr-1" />
                  {routeHistory.length} puntos de ruta registrados
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* No location warning */}
        {!location && (
          <Card className="bg-warning/10 border-warning/30">
            <CardContent className="p-4 text-center">
              <Navigation className="w-8 h-8 mx-auto mb-2 text-warning" />
              <p className="text-sm font-medium">Ubicación no disponible</p>
              <p className="text-xs text-muted-foreground mt-1">
                El viajero no está compartiendo su ubicación en este momento
              </p>
            </CardContent>
          </Card>
        )}

        {/* Powered by */}
        <div className="text-center pt-4">
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Seguimiento de viaje con <span className="font-semibold">M.A.T.S.</span>
          </Link>
        </div>
      </main>
    </div>
  );
}