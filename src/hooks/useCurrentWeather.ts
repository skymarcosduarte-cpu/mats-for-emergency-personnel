// Hook to fetch current weather based on user's GPS coordinates using Open-Meteo API + OWM
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  description: string;
  icon: string;
  locationName: string;
  // OWM additional data
  owmTemperature?: number;
  owmFeelsLike?: number;
  owmHumidity?: number;
  owmPressure?: number;
  owmWindSpeed?: number;
  owmWindDeg?: number;
  owmDescription?: string;
  owmIcon?: string;
  owmClouds?: number;
  owmVisibility?: number;
}

// WMO Weather interpretation codes to description and icon
const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: 'Despejado', icon: '☀️' },
  1: { description: 'Mayormente despejado', icon: '🌤️' },
  2: { description: 'Parcialmente nublado', icon: '⛅' },
  3: { description: 'Nublado', icon: '☁️' },
  45: { description: 'Neblina', icon: '🌫️' },
  48: { description: 'Niebla', icon: '🌫️' },
  51: { description: 'Llovizna ligera', icon: '🌦️' },
  53: { description: 'Llovizna moderada', icon: '🌦️' },
  55: { description: 'Llovizna densa', icon: '🌧️' },
  56: { description: 'Llovizna helada', icon: '🌨️' },
  57: { description: 'Llovizna helada densa', icon: '🌨️' },
  61: { description: 'Lluvia ligera', icon: '🌧️' },
  63: { description: 'Lluvia moderada', icon: '🌧️' },
  65: { description: 'Lluvia fuerte', icon: '🌧️' },
  66: { description: 'Lluvia helada', icon: '🌨️' },
  67: { description: 'Lluvia helada fuerte', icon: '🌨️' },
  71: { description: 'Nieve ligera', icon: '🌨️' },
  73: { description: 'Nieve moderada', icon: '❄️' },
  75: { description: 'Nieve fuerte', icon: '❄️' },
  77: { description: 'Granizo', icon: '🌨️' },
  80: { description: 'Chubascos ligeros', icon: '🌦️' },
  81: { description: 'Chubascos moderados', icon: '🌧️' },
  82: { description: 'Chubascos fuertes', icon: '🌧️' },
  85: { description: 'Nevadas ligeras', icon: '🌨️' },
  86: { description: 'Nevadas fuertes', icon: '❄️' },
  95: { description: 'Tormenta', icon: '⛈️' },
  96: { description: 'Tormenta con granizo', icon: '⛈️' },
  99: { description: 'Tormenta con granizo fuerte', icon: '⛈️' },
};

function getWeatherInfo(code: number): { description: string; icon: string } {
  return WEATHER_CODES[code] || { description: 'Desconocido', icon: '🌡️' };
}

export function useCurrentWeather(lat: number | null, lng: number | null) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    if (lat === null || lng === null) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch weather from Open-Meteo (no API key required)
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`
      );
      
      if (!weatherResponse.ok) {
        throw new Error('Error al obtener clima');
      }
      
      const weatherData = await weatherResponse.json();
      
      // Reverse geocode to get location name using Nominatim (more reliable)
      let locationName = '';
      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&accept-language=es`,
          { headers: { 'User-Agent': 'MATS-App/1.0' } }
        );
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData.address) {
            // Try to get the most specific locality name
            const addr = geoData.address;
            const locality = addr.suburb || addr.neighbourhood || addr.borough || 
                           addr.city_district || addr.district || addr.town || 
                           addr.village || addr.city || addr.municipality || '';
            const region = addr.state || addr.county || '';
            
            if (locality && region && locality !== region) {
              locationName = `${locality}, ${region}`;
            } else {
              locationName = locality || region || geoData.display_name?.split(',')[0] || '';
            }
          }
        }
      } catch {
        // Silent fallback - will use empty string
        console.warn('[useCurrentWeather] Reverse geocoding failed');
      }

      const weatherCode = weatherData.current?.weather_code ?? 0;
      const { description, icon } = getWeatherInfo(weatherCode);

      // Fetch OWM additional data via edge function
      let owmExtras: Partial<WeatherData> = {};
      try {
        const { data: owm, error: owmError } = await supabase.functions.invoke('fetch-owm-weather', {
          body: { lat, lon: lng },
        });

        if (!owmError && owm && !owm.error) {
          owmExtras = {
            owmTemperature: owm.main?.temp,
            owmFeelsLike: owm.main?.feels_like,
            owmHumidity: owm.main?.humidity,
            owmPressure: owm.main?.pressure,
            owmWindSpeed: owm.wind?.speed,
            owmWindDeg: owm.wind?.deg,
            owmDescription: owm.weather?.[0]?.description,
            owmIcon: owm.weather?.[0]?.icon,
            owmClouds: owm.clouds?.all,
            owmVisibility: owm.visibility,
          };
          console.log('[useCurrentWeather] OWM data fetched:', owm.name);
        } else {
          console.warn('[useCurrentWeather] OWM error:', owmError || owm?.error);
        }
      } catch (owmErr) {
        console.warn('[useCurrentWeather] OWM fetch failed:', owmErr);
      }

      setWeather({
        temperature: Math.round(weatherData.current?.temperature_2m ?? 0),
        weatherCode,
        description,
        icon,
        locationName: locationName || 'Obteniendo ubicación...',
        ...owmExtras,
      });
    } catch (err) {
      console.error('[useCurrentWeather] Error:', err);
      setError('No se pudo obtener el clima');
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  // Fetch on mount and when position changes
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Refresh every 10 minutes
  useEffect(() => {
    if (lat === null || lng === null) return;
    
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [lat, lng, fetchWeather]);

  return { weather, loading, error, refresh: fetchWeather };
}
