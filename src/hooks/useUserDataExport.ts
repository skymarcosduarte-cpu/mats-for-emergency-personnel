// Hook to fetch and export all user personal data (ARCO rights)
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserDataExport {
  exportedAt: string;
  profile: Record<string, unknown> | null;
  role: string | null;
  emergencyContacts: Record<string, unknown>[];
  userLocation: Record<string, unknown> | null;
  helpRequests: Record<string, unknown>[];
  panicEvents: Record<string, unknown>[];
  communityEvents: Record<string, unknown>[];
  roadReports: Record<string, unknown>[];
  statusMessages: Record<string, unknown>[];
  transitTrips: Record<string, unknown>[];
  quakeCheckins: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  internalMessages: Record<string, unknown>[];
  marketplaceListings: Record<string, unknown>[];
}

export function useUserDataExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UserDataExport | null>(null);

  const fetchAllUserData = useCallback(async (): Promise<UserDataExport | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('No hay sesión activa');
        return null;
      }

      const userId = user.id;

      // Fetch all user data in parallel
      const [
        profileResult,
        roleResult,
        contactsResult,
        locationResult,
        helpRequestsResult,
        panicEventsResult,
        communityEventsResult,
        roadReportsResult,
        statusMessagesResult,
        transitTripsResult,
        quakeCheckinsResult,
        notificationsResult,
        messagesResult,
        listingsResult,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        supabase.from('emergency_contacts').select('*').eq('user_id', userId),
        supabase.from('user_locations').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('help_requests').select('*').eq('user_id', userId),
        supabase.from('panic_events').select('*').eq('user_id', userId),
        supabase.from('community_events').select('*').eq('user_id', userId),
        supabase.from('road_reports').select('*').eq('user_id', userId),
        supabase.from('status_messages').select('*').eq('user_id', userId),
        supabase.from('transit_trips').select('*').eq('user_id', userId),
        supabase.from('quake_checkins').select('*').eq('user_id', userId),
        supabase.from('notifications').select('*').eq('user_id', userId),
        supabase.from('internal_messages').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
        supabase.from('marketplace_listings').select('*').eq('user_id', userId),
      ]);

      const exportData: UserDataExport = {
        exportedAt: new Date().toISOString(),
        profile: profileResult.data,
        role: roleResult.data?.role || null,
        emergencyContacts: contactsResult.data || [],
        userLocation: locationResult.data,
        helpRequests: helpRequestsResult.data || [],
        panicEvents: panicEventsResult.data || [],
        communityEvents: communityEventsResult.data || [],
        roadReports: roadReportsResult.data || [],
        statusMessages: statusMessagesResult.data || [],
        transitTrips: transitTripsResult.data || [],
        quakeCheckins: quakeCheckinsResult.data || [],
        notifications: notificationsResult.data || [],
        internalMessages: messagesResult.data || [],
        marketplaceListings: listingsResult.data || [],
      };

      setData(exportData);
      return exportData;
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Error al obtener los datos');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadAsJson = useCallback(async () => {
    const exportData = await fetchAllUserData();
    if (!exportData) return;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mis-datos-comunidad-exsos-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [fetchAllUserData]);

  return {
    loading,
    error,
    data,
    fetchAllUserData,
    downloadAsJson,
  };
}
