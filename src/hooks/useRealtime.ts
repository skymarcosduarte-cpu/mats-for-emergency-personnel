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
  role: 'RESCATISTA' | 'FAMILIAR';
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
  arrived_at: string | null;
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

// Hook for user locations with real-time updates (includes role info)
export function useUserLocations() {
  const [locations, setLocations] = useState<UserLocation[]>([]);

  const fetchLocations = useCallback(async () => {
    // Use the view that joins locations with roles
    const { data, error } = await supabase
      .from('user_locations_with_roles')
      .select('*');

    if (!error && data) {
      console.log('[useUserLocations] Fetched locations with roles:', data.length);
      setLocations(data as UserLocation[]);
    } else if (error) {
      console.error('[useUserLocations] Error fetching locations:', error);
    }
  }, []);

  useEffect(() => {
    fetchLocations();

    console.log('[useUserLocations] Setting up realtime subscription...');
    const channel = supabase
      .channel('user_locations_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_locations' },
        (payload) => {
          console.log('[useUserLocations] INSERT:', payload.new);
          fetchLocations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_locations' },
        (payload) => {
          console.log('[useUserLocations] UPDATE - refetching for role info');
          // Refetch to get role info from view
          fetchLocations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'user_locations' },
        (payload) => {
          console.log('[useUserLocations] DELETE:', payload.old);
          fetchLocations();
        }
      )
      .subscribe((status) => {
        console.log('[useUserLocations] Subscription status:', status);
      });

    return () => {
      console.log('[useUserLocations] Cleaning up subscription');
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

// Hook for road reports with improved real-time sync
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
      console.log('[useRoadReports] Fetched reports:', data.length);
      setReports(data as RoadReport[]);
    } else if (error) {
      console.error('[useRoadReports] Error fetching reports:', error);
    }
  }, []);

  useEffect(() => {
    fetchReports();

    console.log('[useRoadReports] Setting up realtime subscription...');
    const channel = supabase
      .channel('road_reports_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'road_reports' },
        (payload) => {
          console.log('[useRoadReports] INSERT:', payload.new);
          const newReport = payload.new as RoadReport;
          if (newReport.is_active) {
            setReports(prev => [newReport, ...prev].slice(0, 100));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'road_reports' },
        (payload) => {
          console.log('[useRoadReports] UPDATE:', payload.new);
          const updated = payload.new as RoadReport;
          setReports(prev => {
            if (!updated.is_active) {
              return prev.filter(r => r.id !== updated.id);
            }
            const exists = prev.find(r => r.id === updated.id);
            if (exists) {
              return prev.map(r => r.id === updated.id ? updated : r);
            }
            return [updated, ...prev].slice(0, 100);
          });
        }
      )
      .subscribe((status) => {
        console.log('[useRoadReports] Subscription status:', status);
      });

    return () => {
      console.log('[useRoadReports] Cleaning up subscription');
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
  speed: number | null; // m/s
  distance_km: number;
  eta_minutes: number | null;
  arrived_at: string | null;
}

export function useActiveResponders() {
  const [responders, setResponders] = useState<ActiveResponder[]>([]);

  const fetchResponders = useCallback(async () => {
    // First, try to get responders from the new table
    const { data: respondersData } = await supabase
      .from('help_request_responders')
      .select('request_id, user_id, lat, lng, started_at, arrived_at, updated_at');

    // Get help request details for active (unresolved) requests
    const { data: helpData, error: helpError } = await supabase
      .from('help_requests')
      .select('id, lat, lng, responding_by, responding_started_at')
      .eq('resolved', false);

    if (helpError || !helpData) return;

    const activeRespondersList: ActiveResponder[] = [];

    // Process responders from the new table
    if (respondersData && respondersData.length > 0) {
      // Get active request IDs
      const activeRequestIds = helpData.map(h => h.id);
      
      // Filter responders to only those for active requests
      const activeResponders = respondersData.filter(r => 
        activeRequestIds.includes(r.request_id)
      );

      // Get responder user IDs for location lookup
      const responderIds = activeResponders.map(r => r.user_id);

      if (responderIds.length > 0) {
        const { data: locData } = await supabase
          .from('user_locations')
          .select('user_id, lat, lng, speed')
          .in('user_id', responderIds);

        for (const responder of activeResponders) {
          const helpRequest = helpData.find(h => h.id === responder.request_id);
          if (!helpRequest) continue;

          // Use responder table location first, fallback to user_locations
          const loc = locData?.find(l => l.user_id === responder.user_id);
          const responderLat = responder.lat || loc?.lat;
          const responderLng = responder.lng || loc?.lng;

          if (responderLat == null || responderLng == null) continue;

          const distanceKm = calculateDistance(
            responderLat,
            responderLng,
            helpRequest.lat,
            helpRequest.lng
          );

          const speedKmh = loc?.speed ? (loc.speed * 3.6) : 30;
          const etaMinutes = speedKmh > 0 ? (distanceKm / speedKmh) * 60 : null;

          activeRespondersList.push({
            request_id: responder.request_id,
            responder_id: responder.user_id,
            responder_lat: responderLat,
            responder_lng: responderLng,
            emergency_lat: helpRequest.lat,
            emergency_lng: helpRequest.lng,
            responding_started_at: responder.started_at,
            speed: loc?.speed || null,
            distance_km: distanceKm,
            eta_minutes: etaMinutes,
            arrived_at: responder.arrived_at,
          });
        }
      }
    }

    // Fallback: Also check legacy responding_by field for backward compatibility
    const legacyResponders = helpData.filter(h => 
      h.responding_by && 
      !activeRespondersList.some(ar => ar.request_id === h.id && ar.responder_id === h.responding_by)
    );

    if (legacyResponders.length > 0) {
      const legacyIds = legacyResponders.map(h => h.responding_by).filter(Boolean) as string[];
      
      const { data: locData } = await supabase
        .from('user_locations')
        .select('user_id, lat, lng, speed')
        .in('user_id', legacyIds);

      for (const h of legacyResponders) {
        const loc = locData?.find(l => l.user_id === h.responding_by);
        if (!loc) continue;

        const distanceKm = calculateDistance(loc.lat, loc.lng, h.lat, h.lng);
        const speedKmh = loc.speed ? (loc.speed * 3.6) : 30;
        const etaMinutes = speedKmh > 0 ? (distanceKm / speedKmh) * 60 : null;

        activeRespondersList.push({
          request_id: h.id,
          responder_id: h.responding_by!,
          responder_lat: loc.lat,
          responder_lng: loc.lng,
          emergency_lat: h.lat,
          emergency_lng: h.lng,
          responding_started_at: h.responding_started_at!,
          speed: loc.speed,
          distance_km: distanceKm,
          eta_minutes: etaMinutes,
          arrived_at: null,
        });
      }
    }

    setResponders(activeRespondersList);
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

    // Subscribe to the new responders table
    const respondersChannel = supabase
      .channel('help_request_responders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'help_request_responders' },
        () => fetchResponders()
      )
      .subscribe();

    // Refresh every 5 seconds for smoother updates
    const interval = setInterval(fetchResponders, 5000);

    return () => {
      supabase.removeChannel(helpChannel);
      supabase.removeChannel(locationChannel);
      supabase.removeChannel(respondersChannel);
      clearInterval(interval);
    };
  }, [fetchResponders]);

  return { responders, refetch: fetchResponders };
}
