// Hook to fetch media files attached to reports (help_requests, quake_checkins, road_reports)

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReportMedia {
  id: string;
  report_id: string;
  report_type: string;
  media_type: 'image' | 'audio';
  storage_path: string;
  mime_type: string;
  duration_ms?: number | null;
  created_at: string;
  publicUrl?: string;
}

interface UseReportMediaOptions {
  reportId: string | null;
  reportType: 'help_request' | 'quake_checkin' | 'road_report';
}

export function useReportMedia({ reportId, reportType }: UseReportMediaOptions) {
  const [media, setMedia] = useState<ReportMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) {
      setMedia([]);
      return;
    }

    const fetchMedia = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('report_media')
          .select('*')
          .eq('report_id', reportId)
          .eq('report_type', reportType)
          .order('created_at', { ascending: true });

        if (fetchError) {
          console.error('[useReportMedia] Error fetching media:', fetchError);
          setError(fetchError.message);
          setMedia([]);
          return;
        }

        // Generate public URLs for each media item
        const mediaWithUrls = await Promise.all(
          (data || []).map(async (item) => {
            const { data: urlData } = supabase.storage
              .from('reports_media')
              .getPublicUrl(item.storage_path);

            return {
              ...item,
              media_type: item.media_type as 'image' | 'audio',
              publicUrl: urlData?.publicUrl || undefined,
            };
          })
        );

        setMedia(mediaWithUrls);
      } catch (err) {
        console.error('[useReportMedia] Unexpected error:', err);
        setError('Error al cargar archivos adjuntos');
        setMedia([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [reportId, reportType]);

  const images = media.filter(m => m.media_type === 'image');
  const audios = media.filter(m => m.media_type === 'audio');

  return {
    media,
    images,
    audios,
    loading,
    error,
    hasMedia: media.length > 0,
    hasImages: images.length > 0,
    hasAudios: audios.length > 0,
  };
}
