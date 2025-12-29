// Hook to listen for responders to user's own alerts
// Shows push notifications when a rescatista starts responding
// Also tracks responder location for real-time map display with route and ETA

import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { playPositiveAlert } from '@/lib/alertSound';

// Transport mode labels for notifications
const TRANSPORT_LABELS: Record<string, string> = {
  walking: '🚶 Caminando',
  bicycle: '🚴 Bicicleta',
  motorcycle: '🏍️ Moto',
  car: '🚗 Automóvil',
  public_transport: '🚌 Transporte Público',
  ambulance: '🚑 Ambulancia',
};

interface ResponderEvent {
  id: string;
  request_id: string;
  user_id: string;
  started_at: string;
  arrived_at: string | null;
  lat: number | null;
  lng: number | null;
  transport_mode: string | null;
}

interface ResponderWithProfile extends ResponderEvent {
  nickname?: string;
}

export interface ActiveResponderInfo {
  id: string;
  request_id: string;
  user_id: string;
  nickname: string;
  lat: number | null;
  lng: number | null;
  started_at: string;
  arrived_at: string | null;
  transport_mode: string | null;
  // Alert/emergency location
  alert_lat: number;
  alert_lng: number;
  // Calculated ETA fields
  distance_km: number;
  eta_minutes: number | null;
  speed: number | null; // m/s from user_locations
}

export interface NewResponderAlert {
  nickname: string;
  transport_mode: string | null;
  eta_minutes: number | null;
  distance_km: number;
}

export function useMyAlertResponders() {
  const { user } = useAuth();
  const notifiedResponderIds = useRef<Set<string>>(new Set());
  const notifiedArrivalIds = useRef<Set<string>>(new Set());
  const [respondersToMyAlerts, setRespondersToMyAlerts] = useState<ActiveResponderInfo[]>([]);
  // Cache of alert locations by request_id
  const alertLocationsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  
  // State for showing the visual overlay when a new responder starts
  const [newResponderAlert, setNewResponderAlert] = useState<NewResponderAlert | null>(null);

  const dismissNewResponderAlert = useCallback(() => {
    setNewResponderAlert(null);
  }, []);

  // Vibrate helper
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore errors
      }
    }
  }, []);

  // Calculate distance using Haversine formula
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Calculate ETA based on distance and speed
  const calculateEta = useCallback((distanceKm: number, speedMps: number | null): number | null => {
    if (!speedMps || speedMps <= 0) {
      // Default to 30 km/h walking/slow vehicle speed if unknown
      const defaultSpeedKmh = 30;
      return (distanceKm / defaultSpeedKmh) * 60; // minutes
    }
    const speedKmh = speedMps * 3.6;
    if (speedKmh < 1) return null;
    return (distanceKm / speedKmh) * 60; // minutes
  }, []);

  // Fetch responder's speed from user_locations
  const fetchResponderSpeed = useCallback(async (userId: string): Promise<number | null> => {
    try {
      const { data } = await supabase
        .from('user_locations')
        .select('speed')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.speed ?? null;
    } catch {
      return null;
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((
    title: string,
    body: string,
    tag: string
  ) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag,
          requireInteraction: true,
          silent: false,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return true;
      } catch (error) {
        console.error('Browser notification error:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Fetch responder's profile to get their nickname
  const fetchResponderProfile = useCallback(async (userId: string): Promise<string> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', userId)
        .maybeSingle();
      
      return data?.nickname || 'Un rescatista';
    } catch {
      return 'Un rescatista';
    }
  }, []);

  // Fetch alert location by request_id
  const fetchAlertLocation = useCallback(async (requestId: string): Promise<{ lat: number; lng: number } | null> => {
    // Check cache first
    const cached = alertLocationsRef.current.get(requestId);
    if (cached) return cached;

    try {
      const { data } = await supabase
        .from('help_requests')
        .select('lat, lng')
        .eq('id', requestId)
        .maybeSingle();
      
      if (data) {
        alertLocationsRef.current.set(requestId, { lat: data.lat, lng: data.lng });
        return { lat: data.lat, lng: data.lng };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Notify when a rescatista starts responding
  const notifyResponderStarted = useCallback(async (responder: ResponderEvent) => {
    // Prevent duplicate notifications
    if (notifiedResponderIds.current.has(responder.id)) return;
    notifiedResponderIds.current.add(responder.id);

    console.log('[useMyAlertResponders] Responder started:', responder);

    // Fetch responder's nickname, credentials, and alert location in parallel
    const [nickname, alertLocation, speed, profileData] = await Promise.all([
      fetchResponderProfile(responder.user_id),
      fetchAlertLocation(responder.request_id),
      fetchResponderSpeed(responder.user_id),
      supabase
        .from('profiles')
        .select('can_provide_medical_assistance, has_ambulance, has_first_aid_kit, has_rescue_unit')
        .eq('id', responder.user_id)
        .maybeSingle()
        .then(r => r.data),
    ]);

    // Build credentials badges
    const credentials: string[] = [];
    if (profileData?.can_provide_medical_assistance) credentials.push('👨‍⚕️');
    if (profileData?.has_ambulance) credentials.push('🚑');
    if (profileData?.has_rescue_unit) credentials.push('🚒');
    if (profileData?.has_first_aid_kit) credentials.push('🩹');
    const credentialsBadge = credentials.length > 0 ? ` ${credentials.join('')}` : '';

    // Calculate distance and ETA
    const distanceKm = responder.lat && responder.lng && alertLocation
      ? calculateDistance(responder.lat, responder.lng, alertLocation.lat, alertLocation.lng)
      : 0;
    
    const eta = calculateEta(distanceKm, speed);

    // Vibrate positively
    vibrate([100, 50, 100, 50, 200]);

    // Play positive sound
    try {
      playPositiveAlert();
    } catch {
      // Ignore sound errors
    }

    // Build notification message with transport mode, ETA, and credentials
    const transportLabel = responder.transport_mode ? TRANSPORT_LABELS[responder.transport_mode] : null;
    const etaText = eta ? ` • ETA: ~${Math.round(eta)} min` : '';
    const distanceText = distanceKm > 0 ? ` (${distanceKm.toFixed(1)} km)` : '';
    
    const notificationBody = transportLabel 
      ? `${nickname}${credentialsBadge} viene ${transportLabel}${distanceText}${etaText}`
      : `${nickname}${credentialsBadge} está respondiendo${distanceText}${etaText}`;

    // Show browser notification with detailed info
    showBrowserNotification(
      '🚨 ¡Ayuda en camino!',
      notificationBody,
      `responder-started-${responder.id}`
    );

    // Show toast with detailed info if app is visible
    if (document.visibilityState === 'visible') {
      toast.success(`${nickname}${credentialsBadge} viene en camino`, {
        description: `${transportLabel || 'En camino'}${distanceText}${etaText}`,
        duration: 8000,
      });
      
      // Set the new responder alert for the visual overlay
      setNewResponderAlert({
        nickname: `${nickname}${credentialsBadge}`,
        transport_mode: responder.transport_mode,
        eta_minutes: eta,
        distance_km: distanceKm,
      });
    }

    // Calculate distance and ETA
    const alertLat = alertLocation?.lat ?? 0;
    const alertLng = alertLocation?.lng ?? 0;
    const distance_km = responder.lat && responder.lng
      ? calculateDistance(responder.lat, responder.lng, alertLat, alertLng)
      : 0;
    const eta_minutes = calculateEta(distance_km, speed);

    // Add to tracked responders
    setRespondersToMyAlerts(prev => {
      const exists = prev.find(r => r.id === responder.id);
      if (exists) return prev;
      return [...prev, {
        ...responder,
        nickname,
        alert_lat: alertLat,
        alert_lng: alertLng,
        distance_km,
        eta_minutes,
        speed,
      }];
    });
  }, [vibrate, showBrowserNotification, fetchResponderProfile, fetchAlertLocation, fetchResponderSpeed, calculateDistance, calculateEta]);

  // Notify when a rescatista arrives
  const notifyResponderArrived = useCallback(async (responder: ResponderEvent) => {
    // Prevent duplicate notifications
    if (notifiedArrivalIds.current.has(responder.id)) return;
    notifiedArrivalIds.current.add(responder.id);

    console.log('[useMyAlertResponders] Responder arrived:', responder);

    // Fetch responder's nickname
    const nickname = await fetchResponderProfile(responder.user_id);

    // Strong positive vibration
    vibrate([150, 75, 150, 75, 300]);

    // Play positive sound
    try {
      playPositiveAlert();
    } catch {
      // Ignore sound errors
    }

    // Show browser notification with name
    showBrowserNotification(
      '✅ ¡El rescatista llegó!',
      `${nickname} ha llegado a tu ubicación`,
      `responder-arrived-${responder.id}`
    );

    // Show toast if app is visible
    if (document.visibilityState === 'visible') {
      toast.success('✅ ¡El rescatista llegó!', {
        description: `${nickname} ha llegado a tu ubicación`,
        duration: 10000,
      });
    }

    // Update responder status (distance is 0 on arrival)
    setRespondersToMyAlerts(prev => 
      prev.map(r => r.id === responder.id 
        ? { ...r, arrived_at: responder.arrived_at, nickname, distance_km: 0, eta_minutes: 0 } 
        : r
      )
    );
  }, [vibrate, showBrowserNotification, fetchResponderProfile]);

  // Update responder location in real-time with recalculated distance and ETA
  const updateResponderLocation = useCallback(async (responder: ResponderEvent) => {
    // Get speed for ETA calculation
    const speed = await fetchResponderSpeed(responder.user_id);

    setRespondersToMyAlerts(prev => 
      prev.map(r => {
        if (r.id !== responder.id) return r;
        
        // Recalculate distance and ETA with new location
        const distance_km = responder.lat && responder.lng
          ? calculateDistance(responder.lat, responder.lng, r.alert_lat, r.alert_lng)
          : r.distance_km;
        const eta_minutes = calculateEta(distance_km, speed);

        return { 
          ...r, 
          lat: responder.lat, 
          lng: responder.lng,
          distance_km,
          eta_minutes,
          speed,
        };
      })
    );
  }, [fetchResponderSpeed, calculateDistance, calculateEta]);

  // Fetch existing responders on mount
  const fetchExistingResponders = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get user's active help requests with their locations
      const { data: myRequests } = await supabase
        .from('help_requests')
        .select('id, lat, lng')
        .eq('user_id', user.id)
        .eq('resolved', false);

      if (!myRequests || myRequests.length === 0) {
        setRespondersToMyAlerts([]);
        return;
      }

      // Cache alert locations
      myRequests.forEach(req => {
        alertLocationsRef.current.set(req.id, { lat: req.lat, lng: req.lng });
      });

      const requestIds = myRequests.map(r => r.id);

      // Get all responders for these requests
      const { data: responders } = await supabase
        .from('help_request_responders')
        .select('id, request_id, user_id, lat, lng, started_at, arrived_at, transport_mode')
        .in('request_id', requestIds);

      if (!responders || responders.length === 0) {
        setRespondersToMyAlerts([]);
        return;
      }

      // Fetch nicknames and speeds for all responders
      const respondersWithProfiles = await Promise.all(
        responders
          .filter(r => r.user_id !== user.id)
          .map(async (r) => {
            const [nickname, speed] = await Promise.all([
              fetchResponderProfile(r.user_id),
              fetchResponderSpeed(r.user_id),
            ]);
            
            // Get alert location
            const alertLoc = alertLocationsRef.current.get(r.request_id);
            const alertLat = alertLoc?.lat ?? 0;
            const alertLng = alertLoc?.lng ?? 0;
            
            // Calculate distance and ETA
            const distance_km = r.lat && r.lng
              ? calculateDistance(r.lat, r.lng, alertLat, alertLng)
              : 0;
            const eta_minutes = calculateEta(distance_km, speed);

            return { 
              ...r, 
              nickname,
              alert_lat: alertLat,
              alert_lng: alertLng,
              distance_km,
              eta_minutes,
              speed,
            };
          })
      );

      setRespondersToMyAlerts(respondersWithProfiles);
    } catch (error) {
      console.error('[useMyAlertResponders] Error fetching responders:', error);
    }
  }, [user?.id, fetchResponderProfile, fetchResponderSpeed, calculateDistance, calculateEta]);

  // Fetch on mount
  useEffect(() => {
    fetchExistingResponders();
  }, [fetchExistingResponders]);

  // Subscribe to responders on user's alerts
  useEffect(() => {
    if (!user?.id) return;

    console.log('[useMyAlertResponders] Setting up subscription for user:', user.id);

    // Subscribe to responder changes
    const channel = supabase
      .channel(`my-alert-responders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'help_request_responders',
        },
        async (payload) => {
          const responder = payload.new as ResponderEvent;
          console.log('[useMyAlertResponders] New responder event:', responder);

          // Check if this responder is for one of user's requests
          const { data: request } = await supabase
            .from('help_requests')
            .select('user_id')
            .eq('id', responder.request_id)
            .maybeSingle();

          if (request?.user_id === user.id && responder.user_id !== user.id) {
            await notifyResponderStarted(responder);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'help_request_responders',
        },
        async (payload) => {
          const responder = payload.new as ResponderEvent;
          const oldResponder = payload.old as ResponderEvent;

          // Check if this responder is for one of user's requests
          const { data: request } = await supabase
            .from('help_requests')
            .select('user_id')
            .eq('id', responder.request_id)
            .maybeSingle();

          if (request?.user_id !== user.id || responder.user_id === user.id) return;

          // Check if arrived_at was just set (responder arrived)
          if (responder.arrived_at && !oldResponder.arrived_at) {
            console.log('[useMyAlertResponders] Responder arrived:', responder);
            await notifyResponderArrived(responder);
          } 
          // Otherwise, update location if it changed
          else if (responder.lat !== oldResponder.lat || responder.lng !== oldResponder.lng) {
            console.log('[useMyAlertResponders] Responder location updated:', responder);
            updateResponderLocation(responder);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'help_request_responders',
        },
        (payload) => {
          const deleted = payload.old as ResponderEvent;
          console.log('[useMyAlertResponders] Responder removed:', deleted);
          setRespondersToMyAlerts(prev => prev.filter(r => r.id !== deleted.id));
        }
      )
      .subscribe((status) => {
        console.log('[useMyAlertResponders] Subscription status:', status);
      });

    return () => {
      console.log('[useMyAlertResponders] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, notifyResponderStarted, notifyResponderArrived, updateResponderLocation]);

  return { 
    respondersToMyAlerts,
    newResponderAlert,
    dismissNewResponderAlert,
  };
}
