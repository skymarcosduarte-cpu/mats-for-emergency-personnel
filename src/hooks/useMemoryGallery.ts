// Memory Gallery Hook for COMUNIDAD EX SOS
// Manages the "Galería del Recuerdo" for nostalgic community photos

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MemoryPhoto {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  // Joined
  author_name?: string;
  author_nickname?: string;
}

export function useMemoryGallery() {
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Fetch all photos
  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('memory_gallery')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setPhotos((data || []) as MemoryPhoto[]);
    } catch (err) {
      console.error('[useMemoryGallery] Error fetching photos:', err);
      toast.error('Error al cargar la galería');
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload multiple photos (max 20)
  const uploadPhotos = useCallback(async (files: File[], caption?: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Debes iniciar sesión');
      return false;
    }

    if (files.length > 20) {
      toast.error('Máximo 20 fotos por carga');
      return false;
    }

    setUploading(true);
    let successCount = 0;

    try {
      for (const file of files) {
        // Validate file
        if (!file.type.startsWith('image/')) {
          console.warn('Skipping non-image file:', file.name);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          console.warn('Skipping large file:', file.name);
          continue;
        }

        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('community_images')
          .upload(fileName, file, { upsert: true });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('community_images')
          .getPublicUrl(fileName);

        // Insert into database
        const { error: insertError } = await supabase
          .from('memory_gallery')
          .insert({
            user_id: user.id,
            image_url: publicUrl,
            caption: caption || null,
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(`${successCount} foto${successCount > 1 ? 's' : ''} subida${successCount > 1 ? 's' : ''}`);
        await fetchPhotos();
        return true;
      } else {
        toast.error('No se pudo subir ninguna foto');
        return false;
      }
    } catch (err) {
      console.error('[useMemoryGallery] Error uploading photos:', err);
      toast.error('Error al subir fotos');
      return false;
    } finally {
      setUploading(false);
    }
  }, [fetchPhotos]);

  // Delete a photo
  const deletePhoto = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('memory_gallery')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Foto eliminada');
      await fetchPhotos();
      return true;
    } catch (err) {
      console.error('[useMemoryGallery] Error deleting photo:', err);
      toast.error('Error al eliminar');
      return false;
    }
  }, [fetchPhotos]);

  // Initial fetch + realtime
  useEffect(() => {
    fetchPhotos();

    const channel = supabase
      .channel('memory_gallery_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memory_gallery' },
        () => fetchPhotos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPhotos]);

  return {
    photos,
    loading,
    uploading,
    uploadPhotos,
    deletePhoto,
    refresh: fetchPhotos,
  };
}
