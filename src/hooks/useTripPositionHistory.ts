import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PositionRecord {
  id: string;
  trip_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
}

interface UseTripPositionHistoryOptions {
  tripId: string | null;
  userId: string | null;
  minDistanceMeters?: number; // Minimum distance to record a new position
  minIntervalMs?: number; // Minimum time between recordings
}

export function useTripPositionHistory({
  tripId,
  userId,
  minDistanceMeters = 50, // Default: record if moved more than 50m
  minIntervalMs = 10000, // Default: minimum 10 seconds between recordings
}: UseTripPositionHistoryOptions) {
  const [history, setHistory] = useState<PositionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastRecordedPosition = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const { toast } = useToast();

  // Calculate distance between two points using Haversine formula
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Fetch position history for a trip
  const fetchHistory = useCallback(async (targetTripId?: string) => {
    const id = targetTripId || tripId;
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trip_position_history')
        .select('*')
        .eq('trip_id', id)
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('[useTripPositionHistory] Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  // Record a new position
  const recordPosition = useCallback(async (
    lat: number,
    lng: number,
    accuracy?: number | null,
    speed?: number | null,
    heading?: number | null
  ): Promise<boolean> => {
    if (!tripId || !userId) {
      console.log('[useTripPositionHistory] Cannot record: missing tripId or userId');
      return false;
    }

    const now = Date.now();

    // Check minimum interval
    if (lastRecordedPosition.current) {
      const timeSinceLastRecord = now - lastRecordedPosition.current.timestamp;
      if (timeSinceLastRecord < minIntervalMs) {
        console.log(`[useTripPositionHistory] Skipping: only ${timeSinceLastRecord}ms since last record`);
        return false;
      }

      // Check minimum distance
      const distance = calculateDistance(
        lastRecordedPosition.current.lat,
        lastRecordedPosition.current.lng,
        lat,
        lng
      );
      if (distance < minDistanceMeters) {
        console.log(`[useTripPositionHistory] Skipping: only moved ${distance.toFixed(1)}m`);
        return false;
      }
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('trip_position_history')
        .insert({
          trip_id: tripId,
          user_id: userId,
          lat,
          lng,
          accuracy,
          speed,
          heading,
        })
        .select()
        .single();

      if (error) throw error;

      lastRecordedPosition.current = { lat, lng, timestamp: now };
      setHistory(prev => [...prev, data]);
      console.log(`[useTripPositionHistory] Recorded position at ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      return true;
    } catch (error) {
      console.error('[useTripPositionHistory] Error recording position:', error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [tripId, userId, minDistanceMeters, minIntervalMs, calculateDistance]);

  // Clear history for a trip
  const clearHistory = useCallback(async (targetTripId?: string) => {
    const id = targetTripId || tripId;
    if (!id || !userId) return;

    try {
      const { error } = await supabase
        .from('trip_position_history')
        .delete()
        .eq('trip_id', id)
        .eq('user_id', userId);

      if (error) throw error;
      setHistory([]);
      lastRecordedPosition.current = null;
    } catch (error) {
      console.error('[useTripPositionHistory] Error clearing history:', error);
      toast({
        title: "Error",
        description: "No se pudo borrar el historial de posiciones",
        variant: "destructive",
      });
    }
  }, [tripId, userId, toast]);

  // Get route coordinates for map display
  const getRouteCoordinates = useCallback((): [number, number][] => {
    return history.map(pos => [pos.lat, pos.lng]);
  }, [history]);

  /**
   * Get separated real and estimated route coordinates
   * Real positions have speed > 0 or were recorded within 2 minutes of each other
   * Estimated positions are interpolated when GPS was stale
   */
  const getRouteWithEstimation = useCallback((
    destinationLat?: number,
    destinationLng?: number
  ): {
    realRoute: [number, number][];
    estimatedRoute: [number, number][];
    lastRealPosition: { lat: number; lng: number } | null;
  } => {
    if (history.length === 0) {
      return { realRoute: [], estimatedRoute: [], lastRealPosition: null };
    }

    const realRoute: [number, number][] = [];
    const estimatedRoute: [number, number][] = [];
    let lastRealPos: { lat: number; lng: number } | null = null;
    let inEstimationMode = false;
    let lastRecordedTime: Date | null = null;

    for (let i = 0; i < history.length; i++) {
      const pos = history[i];
      const currentTime = new Date(pos.recorded_at);
      const hasSpeed = pos.speed !== null && pos.speed > 1; // > 1 m/s (~3.6 km/h)
      
      // Check time gap from previous position
      let timeGapMinutes = 0;
      if (lastRecordedTime) {
        timeGapMinutes = (currentTime.getTime() - lastRecordedTime.getTime()) / (1000 * 60);
      }
      
      // If there's a large time gap (> 2 min) without movement, treat subsequent positions as estimated
      if (timeGapMinutes > 2 && !hasSpeed) {
        if (!inEstimationMode && realRoute.length > 0) {
          // Mark the transition point
          lastRealPos = { lat: realRoute[realRoute.length - 1][0], lng: realRoute[realRoute.length - 1][1] };
          inEstimationMode = true;
        }
      }
      
      // If we have speed again, switch back to real mode
      if (hasSpeed && inEstimationMode) {
        inEstimationMode = false;
      }
      
      if (inEstimationMode) {
        estimatedRoute.push([pos.lat, pos.lng]);
      } else {
        realRoute.push([pos.lat, pos.lng]);
      }
      
      lastRecordedTime = currentTime;
    }

    // If last position had no speed and we have destination, add interpolated point
    if (destinationLat && destinationLng && history.length > 0) {
      const lastPos = history[history.length - 1];
      const lastPosTime = new Date(lastPos.recorded_at);
      const now = new Date();
      const minutesSinceLastPos = (now.getTime() - lastPosTime.getTime()) / (1000 * 60);
      
      // If last position is stale (> 2 min) and no speed, add estimated current position
      if (minutesSinceLastPos > 2 && (lastPos.speed === null || lastPos.speed <= 1)) {
        if (!lastRealPos && realRoute.length > 0) {
          lastRealPos = { lat: realRoute[realRoute.length - 1][0], lng: realRoute[realRoute.length - 1][1] };
        }
        
        // Calculate average speed from recent history
        const recentWithSpeed = history.filter(p => p.speed !== null && p.speed > 1).slice(-10);
        const avgSpeedMs = recentWithSpeed.length > 0 
          ? recentWithSpeed.reduce((sum, p) => sum + (p.speed || 0), 0) / recentWithSpeed.length
          : 16.67; // Default ~60 km/h
        
        const avgSpeedKmh = avgSpeedMs * 3.6;
        const hoursSinceLastPos = minutesSinceLastPos / 60;
        const estimatedDistanceKm = avgSpeedKmh * hoursSinceLastPos;
        
        // Simple linear interpolation toward destination
        const totalDistanceKm = calculateDistance(lastPos.lat, lastPos.lng, destinationLat, destinationLng);
        if (totalDistanceKm > 0.5 && estimatedDistanceKm < totalDistanceKm) {
          const progress = Math.min(estimatedDistanceKm / totalDistanceKm, 0.9);
          const estLat = lastPos.lat + (destinationLat - lastPos.lat) * progress;
          const estLng = lastPos.lng + (destinationLng - lastPos.lng) * progress;
          estimatedRoute.push([estLat, estLng]);
        }
      }
    }

    return { realRoute, estimatedRoute, lastRealPosition: lastRealPos };
  }, [history]);

  // Fetch history when tripId changes
  useEffect(() => {
    if (tripId) {
      fetchHistory();
    } else {
      setHistory([]);
      lastRecordedPosition.current = null;
    }
  }, [tripId, fetchHistory]);

  return {
    history,
    loading,
    saving,
    recordPosition,
    fetchHistory,
    clearHistory,
    getRouteCoordinates,
    getRouteWithEstimation,
    positionCount: history.length,
  };
}

// Helper function for distance calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
