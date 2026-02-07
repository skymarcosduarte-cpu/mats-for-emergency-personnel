// Realtime Hook for COMUNIDAD EX SOS

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance } from '@/hooks/useLocation';
import { playSubtleAlert, playUrgentAlert, playPositiveAlert } from '@/lib/alertSound';
import { areHelpSoundsEnabled } from '@/hooks/useAlertSettings';
import { toast } from 'sonner';
import { getCachedUserLocations, cacheUserLocations } from '@/lib/offlineDataCache';

interface UserLocation {
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  is_online: boolean;
  updated_at: string;
  role: 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR';
  display_name: string | null;
  show_name_on_map: boolean | null;
  can_provide_medical_assistance: boolean | null;
  has_first_aid_kit: boolean | null;
  has_ambulance: boolean | null;
  has_rescue_unit: boolean | null;
  has_k9_unit: boolean | null;
  specialties: string[] | null;
  is_in_transit: boolean;
  transit_destination: string | null;
  transit_destination_lat: number | null;
  transit_destination_lng: number | null;
  transit_origin: string | null;
  transit_origin_lat: number | null;
  transit_origin_lng: number | null;
  transit_eta: string | null;
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
  creator_name?: string | null; // Name of creator if show_name_on_map is enabled
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
  const [initialLoaded, setInitialLoaded] = useState(false);
  const lastFetchRef = useRef<number>(0);
  const DEBOUNCE_MS = 500; // Debounce rapid updates

  // Load from cache immediately on mount
  useEffect(() => {
    const loadCached = async () => {
      try {
        const cached = await getCachedUserLocations<UserLocation>();
        if (cached.isCached && cached.data.length > 0) {
          console.log('[useUserLocations] Loaded from cache:', cached.data.length);
          setLocations(cached.data);
        }
      } catch (e) {
        console.error('[useUserLocations] Cache load error:', e);
      }
    };
    loadCached();
  }, []);

  const fetchLocations = useCallback(async (isBackground = false) => {
    // Debounce rapid fetches
    const now = Date.now();
    if (now - lastFetchRef.current < DEBOUNCE_MS) {
      return;
    }
    lastFetchRef.current = now;

    // Use the view that joins locations with roles
    const { data, error } = await supabase
      .from('user_locations_with_roles')
      .select('*');

    if (!error && data) {
      console.log('[useUserLocations] Fetched locations with roles:', data.length);
      setLocations(data as UserLocation[]);
      setInitialLoaded(true);
      // Cache for instant load next time
      cacheUserLocations(data as UserLocation[]);
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
      // Also listen to transit_trips changes to update is_in_transit status
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transit_trips' },
        (payload) => {
          console.log('[useUserLocations] transit_trips changed - refetching');
          fetchLocations();
        }
      )
      // Listen to profiles changes for share_location updates
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('[useUserLocations] profiles changed - refetching');
          fetchLocations();
        }
      )
      // Listen to profiles_public for new users becoming visible
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles_public' },
        (payload) => {
          console.log('[useUserLocations] profiles_public changed - refetching for new user');
          fetchLocations();
        }
      )
      // Listen to user_roles for new user registrations
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_roles' },
        (payload) => {
          console.log('[useUserLocations] New user role created - refetching');
          fetchLocations();
        }
      )
      .subscribe((status) => {
        console.log('[useUserLocations] Subscription status:', status);
        // If subscription failed, try to reconnect
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[useUserLocations] Subscription error, will rely on polling');
        }
      });

    // Fallback polling every 10 seconds for faster location updates
    // Reduced from 30s to 10s for more responsive map updates
    const pollInterval = setInterval(() => {
      console.log('[useUserLocations] Polling for location updates...');
      fetchLocations();
    }, 10000);

    return () => {
      console.log('[useUserLocations] Cleaning up subscription');
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [fetchLocations]);

  return { locations, refetch: fetchLocations, initialLoaded };
}

// Hook for help requests with distance-based alert sounds
// Also includes panic_events mapped to HelpRequest format for unified display
export function useHelpRequests(userPosition?: { lat: number; lng: number } | null) {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [resolvedRequests, setResolvedRequests] = useState<HelpRequest[]>([]);
  const [urgentHelp, setUrgentHelp] = useState<HelpRequest | null>(null);
  const alertedRequestsRef = useRef<Set<string>>(new Set());

  const NEARBY_THRESHOLD_KM = 30 * 1.60934; // 30 miles in km

  const fetchRequests = useCallback(async () => {
    // Fetch active help_requests
    const { data: helpData, error: helpError } = await supabase
      .from('help_requests')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch active panic_events and map them to HelpRequest format
    const { data: panicData, error: panicError } = await supabase
      .from('panic_events')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);

    // Collect all unique user_ids to fetch their public profiles
    const allUserIds = [
      ...(helpData || []).map((h: any) => h.user_id),
      ...(panicData || []).map((p: any) => p.user_id),
    ].filter(Boolean);
    const uniqueUserIds = [...new Set(allUserIds)];

    // Fetch public profiles for users who have show_name_on_map enabled
    let userNamesMap: Record<string, string> = {};
    if (uniqueUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles_public')
        .select('user_id, nickname, show_name_on_map')
        .in('user_id', uniqueUserIds);
      
      if (profilesData) {
        profilesData.forEach((profile: any) => {
          if (profile.show_name_on_map && profile.nickname) {
            userNamesMap[profile.user_id] = profile.nickname;
          }
        });
      }
    }

    // Map panic_events to HelpRequest format for unified display
    const mappedPanicEvents: HelpRequest[] = (panicData || []).map((pe: any) => ({
      id: pe.id,
      user_id: pe.user_id,
      kind: pe.panic_type, // Map panic_type to kind
      quake_event_id: null,
      lat: pe.lat,
      lng: pe.lng,
      message: pe.message,
      resolved: pe.resolved || false,
      created_at: pe.created_at,
      resolved_at: pe.resolved_at,
      resolved_by: pe.resolved_by,
      responding_by: pe.responding_by,
      responding_started_at: pe.responding_started_at,
      audio_url: pe.audio_url,
      audio_duration_ms: pe.audio_duration_ms,
      arrived_at: pe.arrived_at,
      creator_name: userNamesMap[pe.user_id] || null,
    }));

    // Map help_requests with creator names
    const mappedHelpRequests: HelpRequest[] = (helpData || []).map((hr: any) => ({
      ...hr,
      creator_name: userNamesMap[hr.user_id] || null,
    }));

    // Combine both sources and sort by created_at
    const allRequests = [...mappedHelpRequests, ...mappedPanicEvents]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    if (!helpError && !panicError) {
      setRequests(allRequests as HelpRequest[]);
    }

    // Fetch recently resolved requests from both tables (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: resolvedHelpData } = await supabase
      .from('help_requests')
      .select('*')
      .eq('resolved', true)
      .gte('resolved_at', yesterday.toISOString())
      .order('resolved_at', { ascending: false })
      .limit(20);

    const { data: resolvedPanicData } = await supabase
      .from('panic_events')
      .select('*')
      .eq('resolved', true)
      .gte('resolved_at', yesterday.toISOString())
      .order('resolved_at', { ascending: false })
      .limit(20);

    // Collect resolved user_ids for names
    const resolvedUserIds = [
      ...(resolvedHelpData || []).map((h: any) => h.user_id),
      ...(resolvedPanicData || []).map((p: any) => p.user_id),
    ].filter(Boolean);
    const uniqueResolvedUserIds = [...new Set(resolvedUserIds)].filter(id => !userNamesMap[id]);

    // Fetch names for resolved requests if not already cached
    if (uniqueResolvedUserIds.length > 0) {
      const { data: resolvedProfilesData } = await supabase
        .from('profiles_public')
        .select('user_id, nickname, show_name_on_map')
        .in('user_id', uniqueResolvedUserIds);
      
      if (resolvedProfilesData) {
        resolvedProfilesData.forEach((profile: any) => {
          if (profile.show_name_on_map && profile.nickname) {
            userNamesMap[profile.user_id] = profile.nickname;
          }
        });
      }
    }

    // Map resolved panic_events
    const mappedResolvedPanic: HelpRequest[] = (resolvedPanicData || []).map((pe: any) => ({
      id: pe.id,
      user_id: pe.user_id,
      kind: pe.panic_type,
      quake_event_id: null,
      lat: pe.lat,
      lng: pe.lng,
      message: pe.message,
      resolved: pe.resolved || false,
      created_at: pe.created_at,
      resolved_at: pe.resolved_at,
      resolved_by: pe.resolved_by,
      responding_by: pe.responding_by,
      responding_started_at: pe.responding_started_at,
      audio_url: pe.audio_url,
      audio_duration_ms: pe.audio_duration_ms,
      arrived_at: pe.arrived_at,
      creator_name: userNamesMap[pe.user_id] || null,
    }));

    // Map resolved help_requests with names
    const mappedResolvedHelp: HelpRequest[] = (resolvedHelpData || []).map((hr: any) => ({
      ...hr,
      creator_name: userNamesMap[hr.user_id] || null,
    }));

    const allResolved = [...mappedResolvedHelp, ...mappedResolvedPanic]
      .sort((a, b) => new Date(b.resolved_at || b.created_at).getTime() - new Date(a.resolved_at || a.created_at).getTime())
      .slice(0, 20);

    setResolvedRequests(allResolved as HelpRequest[]);
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

  // Resolve (eliminate) a help request or panic event
  // Tries help_requests first, if no rows affected, tries panic_events
  const resolveRequest = useCallback(async (requestId: string, resolverId?: string) => {
    // Try to update in help_requests first
    const { data: helpData, error: helpError } = await supabase
      .from('help_requests')
      .update({ 
        resolved: true, 
        resolved_at: new Date().toISOString(),
        resolved_by: resolverId || null
      })
      .eq('id', requestId)
      .select('id');

    // If help_requests didn't match (no data returned), try panic_events
    if ((!helpData || helpData.length === 0) && !helpError) {
      const { error: panicError } = await supabase
        .from('panic_events')
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString(),
          resolved_by: resolverId || null
        })
        .eq('id', requestId);

      if (panicError) {
        console.error('Error resolving panic event:', panicError);
        return false;
      }
    } else if (helpError) {
      console.error('Error resolving help request:', helpError);
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
        (payload) => {
          const updated = payload.new as HelpRequest;
          console.log('[useHelpRequests] UPDATE received:', updated.id, 'resolved:', updated.resolved);
          if (updated.resolved) {
            // Immediately remove from active requests when resolved
            setRequests(prev => prev.filter(r => r.id !== updated.id));
            // Show success toast with green check
            const kindLabels: Record<string, string> = {
              'medical': 'Ayuda Médica',
              'supplies': 'Suministros',
              'transport': 'Transporte',
              'shelter': 'Refugio',
              'other': 'Ayuda General',
            };
            const label = kindLabels[updated.kind] || 'Solicitud de ayuda';
            toast.success(`✅ ${label} resuelta`, {
              description: 'La alerta ha sido atendida exitosamente',
              duration: 4000,
            });
            // Haptic feedback - success vibration pattern
            if ('vibrate' in navigator) {
              navigator.vibrate([100, 50, 100]);
            }
            // Play positive sound
            playPositiveAlert();
            
            // Notify nearby users about resolution via push
            try {
              supabase.functions.invoke('notify-alert-resolved', {
                body: {
                  alertId: updated.id,
                  alertType: 'help_request',
                  alertKind: updated.kind,
                  lat: updated.lat,
                  lng: updated.lng,
                  resolvedByUserId: updated.resolved_by,
                  creatorUserId: updated.user_id,
                }
              }).then(res => {
                console.log('[useHelpRequests] Notified nearby users about resolution:', res.data);
              }).catch(err => {
                console.error('[useHelpRequests] Error notifying resolution:', err);
              });
            } catch (e) {
              console.error('[useHelpRequests] Error calling notify-alert-resolved:', e);
            }
          } else {
            // Update the request in place
            setRequests(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
          }
        }
      )
      // Also listen to panic_events for unified display
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'panic_events' },
        (payload) => {
          const pe = payload.new as any;
          // Map panic_event to HelpRequest format
          const mappedRequest: HelpRequest = {
            id: pe.id,
            user_id: pe.user_id,
            kind: pe.panic_type,
            quake_event_id: null,
            lat: pe.lat,
            lng: pe.lng,
            message: pe.message,
            resolved: pe.resolved || false,
            created_at: pe.created_at,
            resolved_at: pe.resolved_at,
            resolved_by: pe.resolved_by,
            responding_by: pe.responding_by,
            responding_started_at: pe.responding_started_at,
            audio_url: pe.audio_url,
            audio_duration_ms: pe.audio_duration_ms,
            arrived_at: pe.arrived_at,
          };
          setRequests(prev => [mappedRequest, ...prev].slice(0, 50));
          
          // Play distance-based alert sound
          playHelpAlert(mappedRequest);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'panic_events' },
        (payload) => {
          const pe = payload.new as any;
          console.log('[useHelpRequests] panic UPDATE received:', pe.id, 'resolved:', pe.resolved);
          if (pe.resolved) {
            // Immediately remove from active requests when resolved
            setRequests(prev => prev.filter(r => r.id !== pe.id));
          } else {
            // Update the request in place with mapped format
            const mappedRequest: HelpRequest = {
              id: pe.id,
              user_id: pe.user_id,
              kind: pe.panic_type,
              quake_event_id: null,
              lat: pe.lat,
              lng: pe.lng,
              message: pe.message,
              resolved: pe.resolved || false,
              created_at: pe.created_at,
              resolved_at: pe.resolved_at,
              resolved_by: pe.resolved_by,
              responding_by: pe.responding_by,
              responding_started_at: pe.responding_started_at,
              audio_url: pe.audio_url,
              audio_duration_ms: pe.audio_duration_ms,
              arrived_at: pe.arrived_at,
            };
            setRequests(prev => prev.map(r => r.id === pe.id ? mappedRequest : r));
          }
        }
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
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'road_reports' },
        (payload) => {
          console.log('[useRoadReports] DELETE:', payload.old);
          const deleted = payload.old as RoadReport;
          setReports(prev => prev.filter(r => r.id !== deleted.id));
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
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
  audio_url: string | null;
  audio_duration_ms: number | null;
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

  // Resolve (mark as resolved) a panic event - used by rescatistas
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

  // Delete a panic event completely - used by the alert owner
  const deleteEvent = useCallback(async (eventId: string) => {
    console.log('[usePanicEvents] Attempting to DELETE event:', eventId);
    
    // First delete any associated responders
    await supabase
      .from('panic_event_responders')
      .delete()
      .eq('panic_id', eventId);
    
    const { error } = await supabase
      .from('panic_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('[usePanicEvents] Error deleting panic event:', error);
      return false;
    }

    console.log('[usePanicEvents] Successfully deleted event:', eventId);
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
        { event: 'INSERT', schema: 'public', table: 'panic_events' },
        (payload) => {
          const newEvent = payload.new as PanicEvent;
          if (!newEvent.resolved) {
            setEvents(prev => [newEvent, ...prev].slice(0, 50));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'panic_events' },
        (payload) => {
          const updated = payload.new as PanicEvent;
          console.log('[usePanicEvents] UPDATE received:', updated.id, 'resolved:', updated.resolved);
          if (updated.resolved) {
            // Immediately remove from state when resolved
            setEvents(prev => prev.filter(e => e.id !== updated.id));
            // Show success toast with green check
            const panicLabels: Record<string, string> = {
              'AMBULANCIA_PROPIA': 'Ambulancia',
              'AMBULANCIA_TERCERO': 'Ambulancia Tercero',
              'PATRULLA': 'Patrulla',
              'MECANICO': 'Mecánico',
              'PROTECCION_CIVIL': 'Protección Civil',
            };
            const label = panicLabels[updated.panic_type] || 'Alerta SOS';
            toast.success(`✅ ${label} resuelta`, {
              description: 'La emergencia ha sido atendida exitosamente',
              duration: 4000,
            });
            // Haptic feedback - success vibration pattern
            if ('vibrate' in navigator) {
              navigator.vibrate([100, 50, 100]);
            }
            // Play positive sound
            playPositiveAlert();
            
            // Notify nearby users about resolution via push
            try {
              supabase.functions.invoke('notify-alert-resolved', {
                body: {
                  alertId: updated.id,
                  alertType: 'panic',
                  alertKind: updated.panic_type,
                  lat: updated.lat,
                  lng: updated.lng,
                  resolvedByUserId: updated.resolved_by,
                  creatorUserId: updated.user_id,
                }
              }).then(res => {
                console.log('[usePanicEvents] Notified nearby users about resolution:', res.data);
              }).catch(err => {
                console.error('[usePanicEvents] Error notifying resolution:', err);
              });
            } catch (e) {
              console.error('[usePanicEvents] Error calling notify-alert-resolved:', e);
            }
          } else {
            // Update the event in place
            setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'panic_events' },
        (payload) => {
          const deleted = payload.old as { id: string };
          setEvents(prev => prev.filter(e => e.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  return { events, resolveEvent, deleteEvent, refetch: fetchEvents };
}

// Hook for tracking responders - gets location of users who are responding to help requests AND panic events
interface ActiveResponder {
  request_id: string;
  responder_id: string;
  responder_name: string;
  responder_lat: number;
  responder_lng: number;
  emergency_lat: number;
  emergency_lng: number;
  responding_started_at: string;
  speed: number | null; // m/s
  distance_km: number;
  eta_minutes: number | null;
  arrived_at: string | null;
  transport_mode: string | null;
  estimated_eta_minutes: number | null; // From the database
}

export function useActiveResponders() {
  const [responders, setResponders] = useState<ActiveResponder[]>([]);
  const arrivedNotifiedRef = useRef<Set<string>>(new Set()); // Track which arrivals we've notified
  const fetchResponders = useCallback(async () => {
    const activeRespondersList: ActiveResponder[] = [];

    // ====== HELP REQUESTS RESPONDERS ======
    const { data: helpRespondersData } = await supabase
      .from('help_request_responders')
      .select('request_id, user_id, lat, lng, started_at, arrived_at, updated_at, transport_mode, estimated_eta_minutes');

    const { data: helpData } = await supabase
      .from('help_requests')
      .select('id, lat, lng, responding_by, responding_started_at')
      .eq('resolved', false);

    // Collect all responder IDs to fetch their names
    const allResponderIds: string[] = [];

    if (helpData) {
      // Process responders from the help_request_responders table
      if (helpRespondersData && helpRespondersData.length > 0) {
        const activeRequestIds = helpData.map(h => h.id);
        const activeResponders = helpRespondersData.filter(r => activeRequestIds.includes(r.request_id));
        allResponderIds.push(...activeResponders.map(r => r.user_id));
      }
      // Legacy responders
      const legacyIds = helpData.filter(h => h.responding_by).map(h => h.responding_by!);
      allResponderIds.push(...legacyIds);
    }

    // ====== PANIC EVENTS RESPONDERS ======
    const { data: panicRespondersData } = await supabase
      .from('panic_event_responders')
      .select('panic_id, user_id, lat, lng, started_at, arrived_at, updated_at, transport_mode, estimated_eta_minutes');

    const { data: panicData } = await supabase
      .from('panic_events')
      .select('id, lat, lng, responding_by, responding_started_at')
      .eq('resolved', false);

    if (panicData && panicRespondersData) {
      const activePanicIds = panicData.map(p => p.id);
      const activePanicResponders = panicRespondersData.filter(r => activePanicIds.includes(r.panic_id));
      allResponderIds.push(...activePanicResponders.map(r => r.user_id));
      // Legacy responders
      const legacyPanicIds = panicData.filter(p => p.responding_by).map(p => p.responding_by!);
      allResponderIds.push(...legacyPanicIds);
    }

    // Fetch names for all responders
    const uniqueResponderIds = [...new Set(allResponderIds.filter(Boolean))];
    let responderNames: Record<string, string> = {};
    
    if (uniqueResponderIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles_public')
        .select('user_id, nickname')
        .in('user_id', uniqueResponderIds);
      
      if (profilesData) {
        profilesData.forEach(p => {
          responderNames[p.user_id] = p.nickname || 'Rescatista';
        });
      }
    }

    // Now process help request responders with names
    if (helpData) {
      if (helpRespondersData && helpRespondersData.length > 0) {
        const activeRequestIds = helpData.map(h => h.id);
        const activeResponders = helpRespondersData.filter(r => activeRequestIds.includes(r.request_id));
        const responderIds = activeResponders.map(r => r.user_id);

        if (responderIds.length > 0) {
          const { data: locData } = await supabase
            .from('user_locations')
            .select('user_id, lat, lng, speed')
            .in('user_id', responderIds);

          for (const responder of activeResponders) {
            const helpRequest = helpData.find(h => h.id === responder.request_id);
            if (!helpRequest) continue;

            const loc = locData?.find(l => l.user_id === responder.user_id);
            const responderLat = responder.lat || loc?.lat;
            const responderLng = responder.lng || loc?.lng;

            if (responderLat == null || responderLng == null) continue;

            const distanceKm = calculateDistance(responderLat, responderLng, helpRequest.lat, helpRequest.lng);
            const speedKmh = loc?.speed ? (loc.speed * 3.6) : 30;
            const etaMinutes = speedKmh > 0 ? (distanceKm / speedKmh) * 60 : null;

            activeRespondersList.push({
              request_id: responder.request_id,
              responder_id: responder.user_id,
              responder_name: responderNames[responder.user_id] || 'Rescatista',
              responder_lat: responderLat,
              responder_lng: responderLng,
              emergency_lat: helpRequest.lat,
              emergency_lng: helpRequest.lng,
              responding_started_at: responder.started_at,
              speed: loc?.speed || null,
              distance_km: distanceKm,
              eta_minutes: etaMinutes,
              arrived_at: responder.arrived_at,
              transport_mode: responder.transport_mode || null,
              estimated_eta_minutes: (responder as any).estimated_eta_minutes || null,
            });
          }
        }
      }

      // Fallback: legacy responding_by field
      const legacyResponders = helpData.filter(h => 
        h.responding_by && !activeRespondersList.some(ar => ar.request_id === h.id && ar.responder_id === h.responding_by)
      );

      if (legacyResponders.length > 0) {
        const legacyIds = legacyResponders.map(h => h.responding_by).filter(Boolean) as string[];
        const { data: legacyLocData } = await supabase
          .from('user_locations')
          .select('user_id, lat, lng, speed')
          .in('user_id', legacyIds);

        for (const h of legacyResponders) {
          const loc = legacyLocData?.find(l => l.user_id === h.responding_by);
          if (!loc) continue;

          const distanceKm = calculateDistance(loc.lat, loc.lng, h.lat, h.lng);
          const speedKmh = loc.speed ? (loc.speed * 3.6) : 30;
          const etaMinutes = speedKmh > 0 ? (distanceKm / speedKmh) * 60 : null;

          activeRespondersList.push({
            request_id: h.id,
            responder_id: h.responding_by!,
            responder_name: responderNames[h.responding_by!] || 'Rescatista',
            responder_lat: loc.lat,
            responder_lng: loc.lng,
            emergency_lat: h.lat,
            emergency_lng: h.lng,
            responding_started_at: h.responding_started_at!,
            speed: loc.speed,
            distance_km: distanceKm,
            eta_minutes: etaMinutes,
            arrived_at: null,
            transport_mode: null,
            estimated_eta_minutes: null,
          });
        }
      }
    }

    // ====== PANIC EVENTS RESPONDERS ======
    // Use the already fetched data from earlier
    if (panicData && panicRespondersData && panicRespondersData.length > 0) {
      const activePanicIds = panicData.map(p => p.id);
      const activePanicResponders = panicRespondersData.filter(r => activePanicIds.includes(r.panic_id));
      const panicResponderIds = activePanicResponders.map(r => r.user_id);

      if (panicResponderIds.length > 0) {
        const { data: panicLocData } = await supabase
          .from('user_locations')
          .select('user_id, lat, lng, speed')
          .in('user_id', panicResponderIds);

        for (const responder of activePanicResponders) {
          const panicEvent = panicData.find(p => p.id === responder.panic_id);
          if (!panicEvent) continue;

          const loc = panicLocData?.find(l => l.user_id === responder.user_id);
          const responderLat = responder.lat || loc?.lat;
          const responderLng = responder.lng || loc?.lng;

          if (responderLat == null || responderLng == null) continue;

          const distanceKm = calculateDistance(responderLat, responderLng, panicEvent.lat, panicEvent.lng);
          const speedKmh = loc?.speed ? (loc.speed * 3.6) : 30;
          const etaMinutes = speedKmh > 0 ? (distanceKm / speedKmh) * 60 : null;

          activeRespondersList.push({
            request_id: responder.panic_id,
            responder_id: responder.user_id,
            responder_name: responderNames[responder.user_id] || 'Rescatista',
            responder_lat: responderLat,
            responder_lng: responderLng,
            emergency_lat: panicEvent.lat,
            emergency_lng: panicEvent.lng,
            responding_started_at: responder.started_at,
            speed: loc?.speed || null,
            distance_km: distanceKm,
            eta_minutes: etaMinutes,
            arrived_at: responder.arrived_at,
            transport_mode: responder.transport_mode || null,
            estimated_eta_minutes: (responder as any).estimated_eta_minutes || null,
          });
        }
      }
    }

    // Fallback: legacy panic responding_by
    if (panicData) {
      const legacyPanicResponders = panicData.filter(p => 
        p.responding_by && !activeRespondersList.some(ar => ar.request_id === p.id && ar.responder_id === p.responding_by)
      );

      if (legacyPanicResponders.length > 0) {
        const legacyPanicIds = legacyPanicResponders.map(p => p.responding_by).filter(Boolean) as string[];
        const { data: legacyPanicLocData } = await supabase
          .from('user_locations')
          .select('user_id, lat, lng, speed')
          .in('user_id', legacyPanicIds);

        for (const p of legacyPanicResponders) {
          const loc = legacyPanicLocData?.find(l => l.user_id === p.responding_by);
          if (!loc) continue;

          const distanceKm = calculateDistance(loc.lat, loc.lng, p.lat, p.lng);
          const speedKmh = loc.speed ? (loc.speed * 3.6) : 30;
          const etaMinutes = speedKmh > 0 ? (distanceKm / speedKmh) * 60 : null;

          activeRespondersList.push({
            request_id: p.id,
            responder_id: p.responding_by!,
            responder_name: responderNames[p.responding_by!] || 'Rescatista',
            responder_lat: loc.lat,
            responder_lng: loc.lng,
            emergency_lat: p.lat,
            emergency_lng: p.lng,
            responding_started_at: p.responding_started_at!,
            speed: loc.speed,
            distance_km: distanceKm,
            eta_minutes: etaMinutes,
            arrived_at: null,
            transport_mode: null,
            estimated_eta_minutes: null,
          });
        }
      }
    }

    // Check for newly arrived responders and notify
    activeRespondersList.forEach(responder => {
      if (responder.arrived_at) {
        const arrivalKey = `${responder.request_id}-${responder.responder_id}`;
        if (!arrivedNotifiedRef.current.has(arrivalKey)) {
          arrivedNotifiedRef.current.add(arrivalKey);
          
          // Play positive sound for arrival
          if (areHelpSoundsEnabled()) {
            try {
              playPositiveAlert();
            } catch {
              // Ignore sound errors
            }
          }
          
          // Show global toast notification
          toast.success('✅ Rescatista llegó a la emergencia', {
            description: `${responder.responder_name} ha llegado a la ubicación`,
            duration: 8000,
          });
        }
      }
    });

    setResponders(activeRespondersList);
  }, []);

  useEffect(() => {
    fetchResponders();

    // Subscribe to help request updates
    const helpChannel = supabase
      .channel('responders_help_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'help_requests' }, () => fetchResponders())
      .subscribe();

    // Subscribe to user location updates
    const locationChannel = supabase
      .channel('responders_location_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_locations' }, () => fetchResponders())
      .subscribe();

    // Subscribe to help_request_responders table
    const helpRespondersChannel = supabase
      .channel('help_request_responders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'help_request_responders' }, () => fetchResponders())
      .subscribe();

    // Subscribe to panic_events updates
    const panicChannel = supabase
      .channel('responders_panic_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'panic_events' }, () => fetchResponders())
      .subscribe();

    // Subscribe to panic_event_responders table
    const panicRespondersChannel = supabase
      .channel('panic_event_responders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'panic_event_responders' }, () => fetchResponders())
      .subscribe();

    // Refresh every 5 seconds for smoother updates
    const interval = setInterval(fetchResponders, 5000);

    return () => {
      supabase.removeChannel(helpChannel);
      supabase.removeChannel(locationChannel);
      supabase.removeChannel(helpRespondersChannel);
      supabase.removeChannel(panicChannel);
      supabase.removeChannel(panicRespondersChannel);
      clearInterval(interval);
    };
  }, [fetchResponders]);

  return { responders, refetch: fetchResponders };
}
