// Realtime Hook for COMUNIDAD EX SOS

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserLocation {
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  is_online: boolean;
  updated_at: string;
}

interface HelpRequest {
  id: string;
  user_id: string;
  kind: string;
  quake_event_id: string | null;
  lat: number;
  lng: number;
  message: string | null;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

interface RoadReport {
  id: string;
  user_id: string;
  trip_id: string | null;
  category: string;
  severity: number;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  is_active: boolean;
  created_at: string;
  resolved_at: string | null;
}

interface AppState {
  id: string;
  disaster_mode: boolean;
  disaster_started_at: string | null;
  updated_at: string;
}

// Hook for user locations
export function useUserLocations() {
  const [locations, setLocations] = useState<UserLocation[]>([]);

  const fetchLocations = useCallback(async () => {
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

    const channel = supabase
      .channel('user_locations_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_locations' },
        () => fetchLocations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLocations]);

  return { locations, refetch: fetchLocations };
}

// Hook for help requests
export function useHelpRequests() {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [urgentHelp, setUrgentHelp] = useState<HelpRequest | null>(null);

  const fetchRequests = useCallback(async () => {
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

    const channel = supabase
      .channel('help_requests_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'help_requests' },
        (payload) => {
          const newRequest = payload.new as HelpRequest;
          setRequests(prev => [newRequest, ...prev].slice(0, 50));
          
          if (newRequest.kind === 'SISMO_AYUDA_14') {
            setUrgentHelp(newRequest);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'help_requests' },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests]);

  const dismissUrgentHelp = useCallback(() => setUrgentHelp(null), []);

  return { requests, urgentHelp, dismissUrgentHelp, refetch: fetchRequests };
}

// Hook for app state
export function useAppState() {
  const [appState, setAppState] = useState<AppState | null>(null);

  const fetchAppState = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_state')
      .select('*')
      .maybeSingle();

    if (!error && data) {
      setAppState(data as AppState);
    }
  }, []);

  useEffect(() => {
    fetchAppState();

    const channel = supabase
      .channel('app_state_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_state' },
        (payload) => setAppState(payload.new as AppState)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAppState]);

  return { appState, disasterMode: appState?.disaster_mode ?? false, refetch: fetchAppState };
}

// Hook for road reports
export function useRoadReports() {
  const [reports, setReports] = useState<RoadReport[]>([]);

  const fetchReports = useCallback(async () => {
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

    const channel = supabase
      .channel('road_reports_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'road_reports' },
        () => fetchReports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReports]);

  return { reports, refetch: fetchReports };
}

// Hook for medical providers
interface MedicalProvider {
  user_id: string;
  lat: number;
  lng: number;
  is_online: boolean;
  updated_at: string;
  can_provide_medical_assistance: boolean;
  has_first_aid_kit: boolean;
}

export function useMedicalProviders() {
  const [providers, setProviders] = useState<MedicalProvider[]>([]);

  const fetchProviders = useCallback(async () => {
    const { data, error } = await supabase
      .from('medical_providers')
      .select('*');

    if (!error && data) {
      setProviders(data as MedicalProvider[]);
    }
  }, []);

  useEffect(() => {
    fetchProviders();

    // Subscribe to changes in user_locations (underlying table)
    const channel = supabase
      .channel('medical_providers_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_locations' },
        () => fetchProviders()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchProviders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProviders]);

  return { providers, refetch: fetchProviders };
}
