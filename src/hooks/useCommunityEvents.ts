// Community Events Hook for COMUNIDAD EX SOS
// Manages community message board for birthdays, health notices, etc.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CommunityEventType = 
  | 'BIRTHDAY' 
  | 'EVENT'
  | 'ANNIVERSARY'
  | 'DECEASE'
  | 'VISIT'
  | 'CELEBRATION'
  | 'RECOMMENDATION'
  | 'NEWS'
  | 'OTHER';

export interface CommunityEvent {
  id: string;
  user_id: string;
  event_type: CommunityEventType;
  title: string;
  message: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  link_url: string | null;
  video_url: string | null;
  target_user_id: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined from profiles
  author_name?: string;
  author_nickname?: string;
}

export interface NearbyBirthday {
  user_id: string;
  full_name: string;
  nickname: string;
  birthday: string;
  day_label: 'yesterday' | 'today' | 'tomorrow';
}

export function useCommunityEvents() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [birthdays, setBirthdays] = useState<NearbyBirthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all active events
  const fetchEvents = useCallback(async () => {
    console.log('[useCommunityEvents] Starting fetchEvents...');
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('community_events')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        console.error('[useCommunityEvents] Supabase error:', fetchError);
        throw fetchError;
      }
      
      console.log('[useCommunityEvents] Fetched', data?.length || 0, 'events');
      setEvents((data || []) as CommunityEvent[]);
      setError(null);
    } catch (err) {
      console.error('[useCommunityEvents] Error fetching community events:', err);
      setError('Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch nearby birthdays (yesterday, today, tomorrow)
  const fetchBirthdays = useCallback(async () => {
    console.log('[useCommunityEvents] Fetching birthdays...');
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_nearby_birthdays');

      if (fetchError) {
        console.error('[useCommunityEvents] Birthday fetch error:', fetchError);
        throw fetchError;
      }
      
      console.log('[useCommunityEvents] Fetched', data?.length || 0, 'birthdays');
      setBirthdays((data || []) as NearbyBirthday[]);
    } catch (err) {
      console.error('[useCommunityEvents] Error fetching birthdays:', err);
    }
  }, []);

  // Upload image to storage
  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('community_images')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('community_images')
      .getPublicUrl(fileName);

    return publicUrl;
  }, []);

  // Upload video to storage (max 10MB)
  const uploadVideo = useCallback(async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate video size (10MB max)
    const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_VIDEO_SIZE) {
      throw new Error('El video debe ser menor a 10MB');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/video_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('community_images')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('community_images')
      .getPublicUrl(fileName);

    return publicUrl;
  }, []);

  // Create a new event
  const createEvent = useCallback(async (event: {
    event_type: CommunityEventType;
    title: string;
    message?: string;
    image_url?: string;
    image_urls?: string[];
    link_url?: string;
    video_url?: string;
    target_user_id?: string;
    expires_at?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error: createError } = await supabase
      .from('community_events')
      .insert({
        user_id: user.id,
        event_type: event.event_type,
        title: event.title,
        message: event.message || null,
        image_url: event.image_url || null,
        image_urls: event.image_urls || null,
        link_url: event.link_url || null,
        video_url: event.video_url || null,
        target_user_id: event.target_user_id || null,
        expires_at: event.expires_at || null,
      })
      .select()
      .single();

    if (createError) throw createError;
    
    await fetchEvents();
    return data;
  }, [fetchEvents]);

  // Update an event
  const updateEvent = useCallback(async (id: string, updates: Partial<{
    title: string;
    message: string;
    is_active: boolean;
  }>) => {
    const { error: updateError } = await supabase
      .from('community_events')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;
    
    await fetchEvents();
  }, [fetchEvents]);

  // Delete an event
  const deleteEvent = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('community_events')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    
    await fetchEvents();
  }, [fetchEvents]);

  // Get event type label
  const getEventTypeLabel = (type: CommunityEventType) => {
    const labels: Record<CommunityEventType, string> = {
      'BIRTHDAY': '🎂 Cumpleaños',
      'EVENT': '📅 Evento',
      'ANNIVERSARY': '💍 Aniversario',
      'DECEASE': '🕯️ Deceso',
      'VISIT': '👋 Visita',
      'CELEBRATION': '🎉 Hoy se Celebra',
      'RECOMMENDATION': '💡 Recomendación',
      'NEWS': '📰 Noticia Relevante',
      'OTHER': '📝 Otro',
    };
    return labels[type] || type;
  };

  // Get event type color
  const getEventTypeColor = (type: CommunityEventType) => {
    const colors: Record<CommunityEventType, string> = {
      'BIRTHDAY': 'bg-primary/10 text-primary border-primary/30',
      'EVENT': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
      'ANNIVERSARY': 'bg-pink-500/10 text-pink-500 border-pink-500/30',
      'DECEASE': 'bg-muted text-muted-foreground border-muted',
      'VISIT': 'bg-safe/10 text-safe border-safe/30',
      'CELEBRATION': 'bg-amber-500/10 text-amber-500 border-amber-500/30',
      'RECOMMENDATION': 'bg-purple-500/10 text-purple-500 border-purple-500/30',
      'NEWS': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30',
      'OTHER': 'bg-accent/10 text-accent-foreground border-accent/30',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  // Initial fetch
  useEffect(() => {
    fetchEvents();
    fetchBirthdays();

    // Set up realtime subscription
    const channel = supabase
      .channel('community_events_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_events' },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents, fetchBirthdays]);

  return {
    events,
    birthdays,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    uploadImage,
    uploadVideo,
    refresh: fetchEvents,
    getEventTypeLabel,
    getEventTypeColor,
  };
}
