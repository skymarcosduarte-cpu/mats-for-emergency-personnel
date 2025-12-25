// Re-export from auto-generated integrations
export { supabase } from '@/integrations/supabase/client';

// Helper function - always configured with Lovable Cloud
export function isSupabaseConfigured(): boolean {
  return true;
}

// Storage bucket name
export const REPORTS_MEDIA_BUCKET = 'reports_media';
