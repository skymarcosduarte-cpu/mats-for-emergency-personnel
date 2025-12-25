// Realtime Hook for COMUNIDAD EX SOS - Simplified version

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { UserLocation, HelpRequest, RoadReport, AppState } from '@/types';

// Hook for user locations
export function useUserLocations() {
  const [locations, setLocations] = useState<UserLocation[]>([]);

  const fetchLocations = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('user_locations')
      .select('*')
      .eq('is_online', true);

    if (!error && data) {
      setLocations(data as UserLocation[]);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 10000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  return { locations, refetch: fetchLocations };
}

// Hook for help requests
export function useHelpRequests() {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [urgentHelp, setUrgentHelp] = useState<HelpRequest | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('help_requests')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setRequests(data as HelpRequest[]);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const dismissUrgentHelp = useCallback(() => setUrgentHelp(null), []);

  return { requests, urgentHelp, dismissUrgentHelp, refetch: fetchRequests };
}

// Hook for app state
export function useAppState() {
  const [appState, setAppState] = useState<AppState | null>(null);

  const fetchAppState = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('app_state')
      .select('*')
      .single();

    if (!error && data) {
      setAppState(data as AppState);
    }
  }, []);

  useEffect(() => {
    fetchAppState();
  }, [fetchAppState]);

  return { appState, disasterMode: appState?.disaster_mode ?? false, refetch: fetchAppState };
}

// Hook for road reports
export function useRoadReports() {
  const [reports, setReports] = useState<RoadReport[]>([]);

  const fetchReports = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('road_reports')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setReports(data as RoadReport[]);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 15000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  return { reports, refetch: fetchReports };
}
