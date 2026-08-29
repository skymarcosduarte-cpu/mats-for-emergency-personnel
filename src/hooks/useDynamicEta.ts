// Dynamic ETA Calculator Hook
// Updates trip ETA in real-time based on GPS position and speed

import { useCallback, useRef, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance } from '@/hooks/useLocation';
import type { GeoPosition } from '@/types';

interface UseDynamicEtaOptions {
  tripId: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  enabled?: boolean;
  // Minimum interval between ETA updates (ms)
  minUpdateIntervalMs?: number;
  // Default average speed in km/h if GPS speed not available
  defaultSpeedKmh?: number;
  // Transit type: only ground trips get automatic ETA recalculation
  transitType?: string | null;
}

interface EtaInfo {
  distanceKm: number;
  estimatedMinutes: number;
  currentSpeedKmh: number | null;
  lastUpdated: Date | null;
}

export function useDynamicEta({
  tripId,
  destinationLat,
  destinationLng,
  enabled = true,
  minUpdateIntervalMs = 60000, // Update ETA at most every 60 seconds
  defaultSpeedKmh = 60, // Default to 60 km/h if no speed available
  transitType = null,
}: UseDynamicEtaOptions) {
  const [etaInfo, setEtaInfo] = useState<EtaInfo | null>(null);
  const [updating, setUpdating] = useState(false);
  const lastUpdateRef = useRef<number>(0);
  const speedHistoryRef = useRef<number[]>([]);

  // Only ground trips may auto-update the stored ETA. For flights/helicopters the
  // ground-speed model produces absurd values (e.g. 1300 km at 60 km/h = +21 h).
  const canAutoUpdateDb = !transitType || transitType === 'ROAD';

  // Calculate average speed from recent measurements
  const getAverageSpeed = useCallback((currentSpeed: number | null): number => {
    if (currentSpeed && currentSpeed > 0) {
      // Add to history (keep last 10 measurements)
      speedHistoryRef.current.push(currentSpeed);
      if (speedHistoryRef.current.length > 10) {
        speedHistoryRef.current.shift();
      }
    }

    // Calculate average from history
    if (speedHistoryRef.current.length > 0) {
      const sum = speedHistoryRef.current.reduce((a, b) => a + b, 0);
      return sum / speedHistoryRef.current.length;
    }

    return defaultSpeedKmh;
  }, [defaultSpeedKmh]);

  // Calculate new ETA based on position
  const calculateNewEta = useCallback((
    currentLat: number,
    currentLng: number,
    currentSpeedMps: number | null
  ): { distanceKm: number; estimatedMinutes: number; speedKmh: number } | null => {
    if (!destinationLat || !destinationLng) return null;

    // Calculate remaining distance
    const distanceKm = calculateDistance(currentLat, currentLng, destinationLat, destinationLng);

    // Convert speed from m/s to km/h
    const currentSpeedKmh = currentSpeedMps ? currentSpeedMps * 3.6 : null;
    
    // Get average speed (uses history if available)
    const avgSpeedKmh = getAverageSpeed(currentSpeedKmh);
    
    // Don't calculate if speed is too low (likely stopped)
    const effectiveSpeed = avgSpeedKmh < 5 ? defaultSpeedKmh : avgSpeedKmh;
    
    // Calculate estimated time in minutes
    const estimatedHours = distanceKm / effectiveSpeed;
    const estimatedMinutes = Math.round(estimatedHours * 60);

    return {
      distanceKm,
      estimatedMinutes,
      speedKmh: effectiveSpeed,
    };
  }, [destinationLat, destinationLng, getAverageSpeed, defaultSpeedKmh]);

  // Update ETA in database
  const updateEtaInDb = useCallback(async (estimatedMinutes: number) => {
    if (!tripId) return false;

    try {
      const newEta = new Date(Date.now() + estimatedMinutes * 60 * 1000);
      
      const { error } = await supabase
        .from('transit_trips')
        .update({ eta: newEta.toISOString() })
        .eq('id', tripId);

      if (error) {
        console.error('[useDynamicEta] Error updating ETA:', error);
        return false;
      }

      console.log('[useDynamicEta] ETA updated to:', newEta.toISOString(), `(${estimatedMinutes} min)`);
      return true;
    } catch (err) {
      console.error('[useDynamicEta] Exception updating ETA:', err);
      return false;
    }
  }, [tripId]);

  // Main function to process position update and recalculate ETA
  const processPositionUpdate = useCallback(async (position: GeoPosition) => {
    if (!enabled || !tripId || !destinationLat || !destinationLng) return;

    const now = Date.now();
    
    // Throttle updates
    if (now - lastUpdateRef.current < minUpdateIntervalMs) {
      return;
    }

    // Calculate new ETA
    const result = calculateNewEta(position.lat, position.lng, position.speed);
    if (!result) return;

    // Only update if we have meaningful data
    if (result.distanceKm < 0.05) {
      // Less than 50m - probably arrived
      console.log('[useDynamicEta] Very close to destination, skipping update');
      return;
    }

    setUpdating(true);
    lastUpdateRef.current = now;

    // Update local state
    setEtaInfo({
      distanceKm: result.distanceKm,
      estimatedMinutes: result.estimatedMinutes,
      currentSpeedKmh: result.speedKmh,
      lastUpdated: new Date(),
    });

    // Update database only for ground trips and only when we have real GPS speed
    // samples; otherwise the user-defined ETA stays authoritative.
    if (canAutoUpdateDb && speedHistoryRef.current.length >= 3) {
      await updateEtaInDb(result.estimatedMinutes);
    }

    setUpdating(false);
  }, [enabled, tripId, destinationLat, destinationLng, minUpdateIntervalMs, calculateNewEta, updateEtaInDb, canAutoUpdateDb]);

  // Force update ETA (for manual trigger)
  const forceUpdateEta = useCallback(async (position: GeoPosition) => {
    if (!tripId || !destinationLat || !destinationLng) return null;

    const result = calculateNewEta(position.lat, position.lng, position.speed);
    if (!result) return null;

    setUpdating(true);

    const success = await updateEtaInDb(result.estimatedMinutes);

    setEtaInfo({
      distanceKm: result.distanceKm,
      estimatedMinutes: result.estimatedMinutes,
      currentSpeedKmh: result.speedKmh,
      lastUpdated: new Date(),
    });

    lastUpdateRef.current = Date.now();
    setUpdating(false);

    return success ? result : null;
  }, [tripId, destinationLat, destinationLng, calculateNewEta, updateEtaInDb]);

  // Clear speed history when trip changes
  useEffect(() => {
    speedHistoryRef.current = [];
    setEtaInfo(null);
    lastUpdateRef.current = 0;
  }, [tripId]);

  return {
    etaInfo,
    updating,
    processPositionUpdate,
    forceUpdateEta,
  };
}

// Format ETA info for display
export function formatEtaInfo(etaInfo: EtaInfo | null): string {
  if (!etaInfo) return '';
  
  const { distanceKm, estimatedMinutes } = etaInfo;
  
  let distanceStr: string;
  if (distanceKm < 1) {
    distanceStr = `${Math.round(distanceKm * 1000)} m`;
  } else {
    distanceStr = `${distanceKm.toFixed(1)} km`;
  }

  let timeStr: string;
  if (estimatedMinutes < 60) {
    timeStr = `${estimatedMinutes} min`;
  } else {
    const hours = Math.floor(estimatedMinutes / 60);
    const mins = estimatedMinutes % 60;
    timeStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return `${distanceStr} · ${timeStr}`;
}
