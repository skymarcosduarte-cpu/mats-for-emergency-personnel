// Supabase Client Configuration for COMUNIDAD EX SOS

import { createClient } from '@supabase/supabase-js';
import type { 
  Profile, 
  UserLocation, 
  PanicEvent, 
  StatusMessage, 
  TransitTrip, 
  RoadReport, 
  QuakeCheckin, 
  HelpRequest, 
  ReportMedia, 
  Invite, 
  AppState, 
  AppRelease 
} from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Backend features will be unavailable.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Database Types for Supabase queries
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      user_locations: {
        Row: UserLocation;
        Insert: UserLocation;
        Update: Partial<UserLocation>;
      };
      panic_events: {
        Row: PanicEvent;
        Insert: Omit<PanicEvent, 'id' | 'created_at'>;
        Update: Partial<Omit<PanicEvent, 'id' | 'created_at'>>;
      };
      status_messages: {
        Row: StatusMessage;
        Insert: Omit<StatusMessage, 'id' | 'created_at'>;
        Update: Partial<Omit<StatusMessage, 'id' | 'created_at'>>;
      };
      transit_trips: {
        Row: TransitTrip;
        Insert: Omit<TransitTrip, 'id' | 'created_at'>;
        Update: Partial<Omit<TransitTrip, 'id' | 'created_at'>>;
      };
      road_reports: {
        Row: RoadReport;
        Insert: Omit<RoadReport, 'id' | 'created_at'>;
        Update: Partial<Omit<RoadReport, 'id' | 'created_at'>>;
      };
      quake_checkins: {
        Row: QuakeCheckin;
        Insert: Omit<QuakeCheckin, 'id' | 'created_at'>;
        Update: Partial<Omit<QuakeCheckin, 'id' | 'created_at'>>;
      };
      help_requests: {
        Row: HelpRequest;
        Insert: Omit<HelpRequest, 'id' | 'created_at'>;
        Update: Partial<Omit<HelpRequest, 'id' | 'created_at'>>;
      };
      report_media: {
        Row: ReportMedia;
        Insert: Omit<ReportMedia, 'id' | 'created_at'>;
        Update: Partial<Omit<ReportMedia, 'id' | 'created_at'>>;
      };
      invites: {
        Row: Invite;
        Insert: Omit<Invite, 'id' | 'created_at' | 'used_count'>;
        Update: Partial<Omit<Invite, 'id' | 'created_at'>>;
      };
      app_state: {
        Row: AppState;
        Insert: Omit<AppState, 'id' | 'updated_at'>;
        Update: Partial<Omit<AppState, 'id'>>;
      };
      app_releases: {
        Row: AppRelease;
        Insert: Omit<AppRelease, 'id'>;
        Update: Partial<Omit<AppRelease, 'id'>>;
      };
    };
  };
};

// Helper function to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co');
}

// Storage bucket name
export const REPORTS_MEDIA_BUCKET = 'reports_media';

// Helper for signed URLs
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  
  const { data, error } = await supabase.storage
    .from(REPORTS_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);
    
  if (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
  
  return data.signedUrl;
}

// Helper to upload media
export async function uploadMedia(
  file: File | Blob,
  folder: string,
  fileName: string
): Promise<{ path: string; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { path: '', error: new Error('Supabase not configured') };
  }
  
  const path = `${folder}/${fileName}`;
  
  const { error } = await supabase.storage
    .from(REPORTS_MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    
  if (error) {
    return { path: '', error: new Error(error.message) };
  }
  
  return { path, error: null };
}
