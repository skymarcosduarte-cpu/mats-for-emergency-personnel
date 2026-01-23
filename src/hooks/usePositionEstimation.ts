/**
 * Hook para estimar la posición de un viajero cuando el GPS deja de reportar movimiento.
 * 
 * Cuando el GPS reporta speed=0 o posición estática por más de 2 minutos,
 * calcula una posición estimada basada en:
 * - Velocidad promedio del historial reciente
 * - Dirección hacia el destino
 * - Tiempo transcurrido desde última actualización válida
 */

import { useCallback, useMemo } from 'react';

export interface EstimatedPosition {
  lat: number;
  lng: number;
  isEstimated: boolean;
  estimatedSinceMinutes: number;
  averageSpeedKmh: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  estimationMethod: 'route_interpolation' | 'last_known';
}

export interface PositionHistoryPoint {
  lat: number;
  lng: number;
  speed: number | null;
  recorded_at: string;
}

interface EstimationInput {
  currentLat: number;
  currentLng: number;
  currentSpeed: number | null;
  lastUpdateTime: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  positionHistory?: PositionHistoryPoint[];
}

// Constants
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const MAX_ESTIMATION_TIME_MS = 30 * 60 * 1000; // Max 30 minutes of estimation
const DEFAULT_SPEED_KMH = 60; // Default highway speed
const MIN_SPEED_FOR_ESTIMATION = 20; // Minimum 20 km/h to estimate movement

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate average speed from position history
 * Only considers points from the last 15 minutes with valid speed
 */
function calculateAverageSpeed(history: PositionHistoryPoint[]): number | null {
  if (!history || history.length < 2) return null;
  
  const now = Date.now();
  const fifteenMinutesAgo = now - 15 * 60 * 1000;
  
  // Filter to recent points with valid speed > 0
  const recentPoints = history.filter(p => {
    const pointTime = new Date(p.recorded_at).getTime();
    return pointTime >= fifteenMinutesAgo && p.speed !== null && p.speed > 1;
  });
  
  if (recentPoints.length === 0) return null;
  
  // Calculate average speed in m/s, then convert to km/h
  const avgSpeedMs = recentPoints.reduce((sum, p) => sum + (p.speed || 0), 0) / recentPoints.length;
  const avgSpeedKmh = avgSpeedMs * 3.6;
  
  return avgSpeedKmh >= MIN_SPEED_FOR_ESTIMATION ? avgSpeedKmh : null;
}

/**
 * Interpolate position along route to destination
 */
function interpolatePosition(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  distanceToTravelKm: number
): { lat: number; lng: number } {
  const totalDistanceKm = calculateDistanceKm(startLat, startLng, destLat, destLng);
  
  if (totalDistanceKm <= 0 || distanceToTravelKm <= 0) {
    return { lat: startLat, lng: startLng };
  }
  
  // Calculate progress ratio (capped at 0.95 to avoid overshooting)
  const progressRatio = Math.min(distanceToTravelKm / totalDistanceKm, 0.95);
  
  // Linear interpolation (good enough for short distances)
  const newLat = startLat + (destLat - startLat) * progressRatio;
  const newLng = startLng + (destLng - startLng) * progressRatio;
  
  return { lat: newLat, lng: newLng };
}

/**
 * Main hook for position estimation
 */
export function usePositionEstimation() {
  
  /**
   * Estimate position for a traveler with stale GPS data
   */
  const estimatePosition = useCallback((input: EstimationInput): EstimatedPosition | null => {
    const {
      currentLat,
      currentLng,
      currentSpeed,
      lastUpdateTime,
      destinationLat,
      destinationLng,
      positionHistory,
    } = input;
    
    // Return null if we don't have essential data
    if (!lastUpdateTime || !destinationLat || !destinationLng) {
      return null;
    }
    
    const now = Date.now();
    const lastUpdate = new Date(lastUpdateTime).getTime();
    const timeSinceUpdateMs = now - lastUpdate;
    const timeSinceUpdateMinutes = Math.floor(timeSinceUpdateMs / (1000 * 60));
    
    // If data is fresh (<2 minutes), no estimation needed.
    // NOTE: We intentionally do NOT block estimation just because the last reported speed was high;
    // we estimate based on staleness (time since last update) to avoid "frozen" markers.
    if (timeSinceUpdateMs < STALE_THRESHOLD_MS) {
      return null;
    }
    
    // Don't estimate beyond 30 minutes - too unreliable
    if (timeSinceUpdateMs > MAX_ESTIMATION_TIME_MS) {
      return {
        lat: currentLat,
        lng: currentLng,
        isEstimated: false,
        estimatedSinceMinutes: timeSinceUpdateMinutes,
        averageSpeedKmh: 0,
        confidenceLevel: 'low',
        estimationMethod: 'last_known',
      };
    }
    
    // Calculate average speed from history; fall back to last known speed if available.
    const currentSpeedKmh = currentSpeed !== null ? currentSpeed * 3.6 : null;
    const avgSpeedKmh =
      calculateAverageSpeed(positionHistory || []) ||
      (currentSpeedKmh && currentSpeedKmh >= MIN_SPEED_FOR_ESTIMATION ? currentSpeedKmh : null) ||
      DEFAULT_SPEED_KMH;
    
    // Calculate distance that should have been traveled
    const timeSinceUpdateHours = timeSinceUpdateMs / (1000 * 60 * 60);
    const distanceToTravelKm = avgSpeedKmh * timeSinceUpdateHours;
    
    // Check if we're already near destination
    const distanceToDestination = calculateDistanceKm(currentLat, currentLng, destinationLat, destinationLng);
    
    if (distanceToDestination < 0.5) {
      // Within 500m of destination - don't estimate further
      return null;
    }
    
    // Don't estimate more distance than remaining to destination
    const cappedDistance = Math.min(distanceToTravelKm, distanceToDestination * 0.9);
    
    // Interpolate new position
    const estimatedPos = interpolatePosition(
      currentLat,
      currentLng,
      destinationLat,
      destinationLng,
      cappedDistance
    );
    
    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low' = 'high';
    if (timeSinceUpdateMinutes > 15) {
      confidenceLevel = 'low';
    } else if (timeSinceUpdateMinutes > 5) {
      confidenceLevel = 'medium';
    }
    
    // Lower confidence if using default speed
    if (!positionHistory || positionHistory.length < 3) {
      confidenceLevel = confidenceLevel === 'high' ? 'medium' : 'low';
    }
    
    return {
      lat: estimatedPos.lat,
      lng: estimatedPos.lng,
      isEstimated: true,
      estimatedSinceMinutes: timeSinceUpdateMinutes,
      averageSpeedKmh: Math.round(avgSpeedKmh),
      confidenceLevel,
      estimationMethod: 'route_interpolation',
    };
  }, []);
  
  return {
    estimatePosition,
    calculateAverageSpeed,
    calculateDistanceKm,
  };
}

/**
 * Apply position estimation to an ActiveTrip
 */
export function applyPositionEstimation(
  trip: {
    current_lat?: number | null;
    current_lng?: number | null;
    current_speed?: number | null;
    location_updated_at?: string | null;
    destination_lat?: number | null;
    destination_lng?: number | null;
  },
  positionHistory?: PositionHistoryPoint[]
): EstimatedPosition | null {
  if (!trip.current_lat || !trip.current_lng) {
    return null;
  }

  // Without an update timestamp we can't determine staleness reliably.
  if (!trip.location_updated_at) {
    return null;
  }
  
  const now = Date.now();
  const lastUpdate = trip.location_updated_at ? new Date(trip.location_updated_at).getTime() : 0;
  const timeSinceUpdateMs = now - lastUpdate;
  
  // Fresh data - no estimation needed
  // NOTE: We intentionally do NOT block estimation just because the last reported speed was high.
  // If the GPS hasn't updated in >2 minutes, the marker will look frozen unless we estimate.
  if (timeSinceUpdateMs < STALE_THRESHOLD_MS) {
    return null;
  }
  
  // No destination - can't estimate
  if (!trip.destination_lat || !trip.destination_lng) {
    return null;
  }
  
  const timeSinceUpdateMinutes = Math.floor(timeSinceUpdateMs / (1000 * 60));
  
  // Too old - return last known position with low confidence
  if (timeSinceUpdateMs > MAX_ESTIMATION_TIME_MS) {
    return {
      lat: trip.current_lat,
      lng: trip.current_lng,
      isEstimated: false,
      estimatedSinceMinutes: timeSinceUpdateMinutes,
      averageSpeedKmh: 0,
      confidenceLevel: 'low',
      estimationMethod: 'last_known',
    };
  }
  
  // Calculate average speed; fall back to last known speed if available.
  const currentSpeedKmh = trip.current_speed !== null && trip.current_speed !== undefined
    ? trip.current_speed * 3.6
    : null;
  const avgSpeedKmh =
    calculateAverageSpeed(positionHistory || []) ||
    (currentSpeedKmh && currentSpeedKmh >= MIN_SPEED_FOR_ESTIMATION ? currentSpeedKmh : null) ||
    DEFAULT_SPEED_KMH;
  
  // Calculate estimated travel distance
  const timeSinceUpdateHours = timeSinceUpdateMs / (1000 * 60 * 60);
  const distanceToTravelKm = avgSpeedKmh * timeSinceUpdateHours;
  
  // Check distance to destination
  const distanceToDestination = calculateDistanceKm(
    trip.current_lat,
    trip.current_lng,
    trip.destination_lat,
    trip.destination_lng
  );
  
  if (distanceToDestination < 0.5) {
    return null; // Already at destination
  }
  
  const cappedDistance = Math.min(distanceToTravelKm, distanceToDestination * 0.9);
  
  // Interpolate position
  const estimated = interpolatePosition(
    trip.current_lat,
    trip.current_lng,
    trip.destination_lat,
    trip.destination_lng,
    cappedDistance
  );
  
  // Confidence level
  let confidenceLevel: 'high' | 'medium' | 'low' = 'high';
  if (timeSinceUpdateMinutes > 15) {
    confidenceLevel = 'low';
  } else if (timeSinceUpdateMinutes > 5) {
    confidenceLevel = 'medium';
  }
  if (!positionHistory || positionHistory.length < 3) {
    confidenceLevel = confidenceLevel === 'high' ? 'medium' : 'low';
  }
  
  return {
    lat: estimated.lat,
    lng: estimated.lng,
    isEstimated: true,
    estimatedSinceMinutes: timeSinceUpdateMinutes,
    averageSpeedKmh: Math.round(avgSpeedKmh),
    confidenceLevel,
    estimationMethod: 'route_interpolation',
  };
}
