// Realtime Hook for COMUNIDAD EX SOS

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance } from '@/hooks/useLocation';
import { playSubtleAlert, playUrgentAlert } from '@/lib/alertSound';
import { areHelpSoundsEnabled } from '@/hooks/useAlertSettings';

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
  resolved_by: string | null;
  responding_by: string | null;
  responding_started_at: string | null;
  audio_url: string | null;
  audio_duration_ms: number | null;
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
  verification_count: number;
  verified_by: string[];
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

// Hook for help requests with distance-based alert sounds
export function useHelpRequests(userPosition?: { lat: number; lng: number } | null) {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [resolvedRequests, setResolvedRequests] = useState<HelpRequest[]>([]);
  const [urgentHelp, setUrgentHelp] = useState<HelpRequest | null>(null);
  const alertedRequestsRef = useRef<Set<string>>(new Set());

  const NEARBY_THRESHOLD_KM = 30 * 1.60934; // 30 miles in km

  const fetchRequests = useCallback(async () => {
    // Fetch active requests
    const { data, error } = await supabase
      .from('help_requests')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setRequests(data as HelpRequest[]);
    }

    // Fetch recently resolved requests (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: resolvedData, error: resolvedError } = await supabase
      .from('help_requests')
      .select('*')
      .eq('resolved', true)
      .gte('resolved_at', yesterday.toISOString())
      .order('resolved_at', { ascending: false })
      .limit(20);

    if (!resolvedError && resolvedData) {
      setResolvedRequests(resolvedData as HelpRequest[]);
    }
  }, []);

  // Play alert sound based on distance
  const playHelpAlert = useCallback((request: HelpRequest) => {
    // Check if sounds are enabled
    if (!areHelpSoundsEnabled()) return;
    
    // Skip if already alerted for this request
    if (alertedRequestsRef.current.has(request.id)) return;
    alertedRequestsRef.current.add(request.id);
    alertedRequestsRef.current.add(request.id);

    if (!userPosition) {
      // No position available, play subtle sound
      playSubtleAlert();
      return;
    }

    const distanceKm = calculateDistance(
      userPosition.lat,
      userPosition.lng,
      request.lat,
      request.lng
    );

    if (distanceKm <= NEARBY_THRESHOLD_KM) {
      // Nearby - play urgent sound
      playUrgentAlert();
    } else {
      // Distant - play subtle sound
      playSubtleAlert();
    }
  }, [userPosition]);

  // Resolve (eliminate) a help request
  const resolveRequest = useCallback(async (requestId: string, resolverId?: string) => {
    const { error } = await supabase
      .from('help_requests')
      .update({ 
        resolved: true, 
        resolved_at: new Date().toISOString(),
        resolved_by: resolverId || null
      })
      .eq('id', requestId);

    if (error) {
      console.error('Error resolving help request:', error);
      return false;
    }

    // Update local state
    setRequests(prev => prev.filter(r => r.id !== requestId));
    return true;
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
          
          // Play distance-based alert sound
          playHelpAlert(newRequest);
          
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
  }, [fetchRequests, playHelpAlert]);

  const dismissUrgentHelp = useCallback(() => setUrgentHelp(null), []);

  return { requests, resolvedRequests, urgentHelp, dismissUrgentHelp, resolveRequest, refetch: fetchRequests };
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

// Hook for panic events
interface PanicEvent {
  id: string;
  user_id: string;
  panic_type: string;
  lat: number;
  lng: number;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export function usePanicEvents() {
  const [events, setEvents] = useState<PanicEvent[]>([]);

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('panic_events')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setEvents(data as PanicEvent[]);
    }
  }, []);

  // Resolve (eliminate) a panic event
  const resolveEvent = useCallback(async (eventId: string) => {
    const { error } = await supabase
      .from('panic_events')
      .update({ 
        resolved: true, 
        resolved_at: new Date().toISOString() 
      })
      .eq('id', eventId);

    if (error) {
      console.error('Error resolving panic event:', error);
      return false;
    }

    // Update local state
    setEvents(prev => prev.filter(e => e.id !== eventId));
    return true;
  }, []);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('panic_events_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'panic_events' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  return { events, resolveEvent, refetch: fetchEvents };
}

// Hook for tracking responders - gets location of users who are responding to help requests
interface ActiveResponder {
  request_id: string;
  responder_id: string;
  responder_lat: number;
  responder_lng: number;
  emergency_lat: number;
  emergency_lng: number;
  responding_started_at: string;
}

export function useActiveResponders() {
  const [responders, setResponders] = useState<ActiveResponder[]>([]);

  const fetchResponders = useCallback(async () => {
    // Get all help requests with active responders
    const { data: helpData, error: helpError } = await supabase
      .from('help_requests')
      .select('id, lat, lng, responding_by, responding_started_at')
      .eq('resolved', false)
      .not('responding_by', 'is', null);

    if (helpError || !helpData) return;

    // Get locations for all responders
    const responderIds = helpData.map(h => h.responding_by).filter(Boolean) as string[];
    if (responderIds.length === 0) {
      setResponders([]);
      return;
    }

    const { data: locData, error: locError } = await supabase
      .from('user_locations')
      .select('user_id, lat, lng')
      .in('user_id', responderIds);

    if (locError || !locData) return;

    // Combine data
    const activeResponders: ActiveResponder[] = helpData
      .filter(h => h.responding_by)
      .map(h => {
        const loc = locData.find(l => l.user_id === h.responding_by);
        if (!loc) return null;
        return {
          request_id: h.id,
          responder_id: h.responding_by!,
          responder_lat: loc.lat,
          responder_lng: loc.lng,
          emergency_lat: h.lat,
          emergency_lng: h.lng,
          responding_started_at: h.responding_started_at!,
        };
      })
      .filter(Boolean) as ActiveResponder[];

    setResponders(activeResponders);
  }, []);

  useEffect(() => {
    fetchResponders();

    // Subscribe to help request updates (new responders)
    const helpChannel = supabase
      .channel('responders_help_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'help_requests' },
        () => fetchResponders()
      )
      .subscribe();

    // Subscribe to user location updates (responder movement)
    const locationChannel = supabase
      .channel('responders_location_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_locations' },
        () => fetchResponders()
      )
      .subscribe();

    // Refresh every 5 seconds for smoother updates
    const interval = setInterval(fetchResponders, 5000);

    return () => {
      supabase.removeChannel(helpChannel);
      supabase.removeChannel(locationChannel);
      clearInterval(interval);
    };
  }, [fetchResponders]);

  return { responders, refetch: fetchResponders };
}
