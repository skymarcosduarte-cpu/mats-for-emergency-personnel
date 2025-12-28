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
    positionCount: history.length,
  };
}
