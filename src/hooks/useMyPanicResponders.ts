// Hook to listen for responders to user's own panic alerts
// Shows push notifications when someone starts responding

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

interface PanicResponderEvent {
  id: string;
  panic_id: string;
  user_id: string;
  started_at: string;
  arrived_at: string | null;
  lat: number | null;
  lng: number | null;
  transport_mode: string | null;
}

export interface ActivePanicResponderInfo {
  id: string;
  panic_id: string;
  user_id: string;
  nickname: string;
  lat: number | null;
  lng: number | null;
  started_at: string;
  arrived_at: string | null;
  transport_mode: string | null;
  // Alert location
  alert_lat: number;
  alert_lng: number;
  // Calculated fields
  distance_km: number;
  eta_minutes: number | null;
}

export interface NewResponderAlert {
  nickname: string;
  transport_mode: string | null;
  eta_minutes: number | null;
  distance_km: number;
}

export function useMyPanicResponders() {
  const { user } = useAuth();
  const notifiedResponderIds = useRef<Set<string>>(new Set());
  const notifiedArrivalIds = useRef<Set<string>>(new Set());
  const [respondersToMyPanics, setRespondersToMyPanics] = useState<ActivePanicResponderInfo[]>([]);
  const panicLocationsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  
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

  // Calculate ETA based on distance
  const calculateEta = useCallback((distanceKm: number, speedMps: number | null): number | null => {
    if (!speedMps || speedMps <= 0) {
      const defaultSpeedKmh = 30;
      return (distanceKm / defaultSpeedKmh) * 60;
    }
    const speedKmh = speedMps * 3.6;
    if (speedKmh < 1) return null;
    return (distanceKm / speedKmh) * 60;
  }, []);

  // Fetch responder's speed
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

  // Fetch responder's profile
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

  // Fetch panic location
  const fetchPanicLocation = useCallback(async (panicId: string): Promise<{ lat: number; lng: number } | null> => {
    const cached = panicLocationsRef.current.get(panicId);
    if (cached) return cached;

    try {
      const { data } = await supabase
        .from('panic_events')
        .select('lat, lng')
        .eq('id', panicId)
        .maybeSingle();
      
      if (data) {
        panicLocationsRef.current.set(panicId, { lat: data.lat, lng: data.lng });
        return { lat: data.lat, lng: data.lng };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Notify when someone starts responding to my panic
  const notifyResponderStarted = useCallback(async (responder: PanicResponderEvent) => {
    if (notifiedResponderIds.current.has(responder.id)) return;
    notifiedResponderIds.current.add(responder.id);

    console.log('[useMyPanicResponders] Responder started:', responder);

    const [nickname, panicLocation, speed, profileData] = await Promise.all([
      fetchResponderProfile(responder.user_id),
      fetchPanicLocation(responder.panic_id),
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
    const distanceKm = responder.lat && responder.lng && panicLocation
      ? calculateDistance(responder.lat, responder.lng, panicLocation.lat, panicLocation.lng)
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

    // Show browser notification
    showBrowserNotification(
      '🚨 ¡Ayuda en camino!',
      notificationBody,
      `panic-responder-started-${responder.id}`
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
    const alertLat = panicLocation?.lat ?? 0;
    const alertLng = panicLocation?.lng ?? 0;
    const distance_km = responder.lat && responder.lng
      ? calculateDistance(responder.lat, responder.lng, alertLat, alertLng)
      : 0;
    const eta_minutes = calculateEta(distance_km, speed);

    setRespondersToMyPanics(prev => {
      const exists = prev.find(r => r.id === responder.id);
      if (exists) return prev;
      return [...prev, {
        ...responder,
        nickname,
        alert_lat: alertLat,
        alert_lng: alertLng,
        distance_km,
        eta_minutes,
      }];
    });
  }, [vibrate, showBrowserNotification, fetchResponderProfile, fetchPanicLocation, fetchResponderSpeed, calculateDistance, calculateEta]);

  // Notify when responder arrives
  const notifyResponderArrived = useCallback(async (responder: PanicResponderEvent) => {
    if (notifiedArrivalIds.current.has(responder.id)) return;
    notifiedArrivalIds.current.add(responder.id);

    console.log('[useMyPanicResponders] Responder arrived:', responder);

    const nickname = await fetchResponderProfile(responder.user_id);

    vibrate([150, 75, 150, 75, 300]);

    try {
      playPositiveAlert();
    } catch {
      // Ignore sound errors
    }

    showBrowserNotification(
      '✅ ¡El rescatista llegó!',
      `${nickname} ha llegado a tu ubicación`,
      `panic-responder-arrived-${responder.id}`
    );

    if (document.visibilityState === 'visible') {
      toast.success('✅ ¡El rescatista llegó!', {
        description: `${nickname} ha llegado a tu ubicación`,
        duration: 10000,
      });
    }

    setRespondersToMyPanics(prev => 
      prev.map(r => r.id === responder.id 
        ? { ...r, arrived_at: responder.arrived_at, nickname, distance_km: 0, eta_minutes: 0 } 
        : r
      )
    );
  }, [vibrate, showBrowserNotification, fetchResponderProfile]);

  // Update responder location
  const updateResponderLocation = useCallback(async (responder: PanicResponderEvent) => {
    const speed = await fetchResponderSpeed(responder.user_id);

    setRespondersToMyPanics(prev => 
      prev.map(r => {
        if (r.id !== responder.id) return r;
        
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
        };
      })
    );
  }, [fetchResponderSpeed, calculateDistance, calculateEta]);

  // Fetch existing responders on mount
  const fetchExistingResponders = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: myPanics } = await supabase
        .from('panic_events')
        .select('id, lat, lng')
        .eq('user_id', user.id)
        .eq('resolved', false);

      if (!myPanics || myPanics.length === 0) {
        setRespondersToMyPanics([]);
        return;
      }

      myPanics.forEach(panic => {
        panicLocationsRef.current.set(panic.id, { lat: panic.lat, lng: panic.lng });
      });

      const panicIds = myPanics.map(p => p.id);

      const { data: responders } = await supabase
        .from('panic_event_responders')
        .select('id, panic_id, user_id, lat, lng, started_at, arrived_at, transport_mode')
        .in('panic_id', panicIds);

      if (!responders || responders.length === 0) {
        setRespondersToMyPanics([]);
        return;
      }

      const respondersWithProfiles = await Promise.all(
        responders
          .filter(r => r.user_id !== user.id)
          .map(async (r) => {
            const [nickname, speed] = await Promise.all([
              fetchResponderProfile(r.user_id),
              fetchResponderSpeed(r.user_id),
            ]);
            
            const panicLoc = panicLocationsRef.current.get(r.panic_id);
            const alertLat = panicLoc?.lat ?? 0;
            const alertLng = panicLoc?.lng ?? 0;
            
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
            };
          })
      );

      setRespondersToMyPanics(respondersWithProfiles);
    } catch (error) {
      console.error('[useMyPanicResponders] Error fetching responders:', error);
    }
  }, [user?.id, fetchResponderProfile, fetchResponderSpeed, calculateDistance, calculateEta]);

  // Fetch on mount
  useEffect(() => {
    fetchExistingResponders();
  }, [fetchExistingResponders]);

  // Subscribe to panic responder changes
  useEffect(() => {
    if (!user?.id) return;

    console.log('[useMyPanicResponders] Setting up subscription for user:', user.id);

    const channel = supabase
      .channel(`my-panic-responders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'panic_event_responders',
        },
        async (payload) => {
          const responder = payload.new as PanicResponderEvent;
          console.log('[useMyPanicResponders] New responder event:', responder);

          // Check if this responder is for one of user's panics
          const { data: panic } = await supabase
            .from('panic_events')
            .select('user_id')
            .eq('id', responder.panic_id)
            .maybeSingle();

          if (panic?.user_id === user.id && responder.user_id !== user.id) {
            await notifyResponderStarted(responder);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'panic_event_responders',
        },
        async (payload) => {
          const responder = payload.new as PanicResponderEvent;
          const oldResponder = payload.old as PanicResponderEvent;

          const { data: panic } = await supabase
            .from('panic_events')
            .select('user_id')
            .eq('id', responder.panic_id)
            .maybeSingle();

          if (panic?.user_id !== user.id || responder.user_id === user.id) return;

          if (responder.arrived_at && !oldResponder.arrived_at) {
            console.log('[useMyPanicResponders] Responder arrived:', responder);
            await notifyResponderArrived(responder);
          } else if (responder.lat !== oldResponder.lat || responder.lng !== oldResponder.lng) {
            console.log('[useMyPanicResponders] Responder location updated:', responder);
            updateResponderLocation(responder);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'panic_event_responders',
        },
        (payload) => {
          const deleted = payload.old as PanicResponderEvent;
          console.log('[useMyPanicResponders] Responder removed:', deleted);
          setRespondersToMyPanics(prev => prev.filter(r => r.id !== deleted.id));
        }
      )
      .subscribe((status) => {
        console.log('[useMyPanicResponders] Subscription status:', status);
      });

    return () => {
      console.log('[useMyPanicResponders] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, notifyResponderStarted, notifyResponderArrived, updateResponderLocation]);

  return { 
    respondersToMyPanics,
    newResponderAlert,
    dismissNewResponderAlert,
  };
}
