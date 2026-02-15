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
  photo_date: string | null;
  created_at: string;
  author_nickname: string | null;
  // Aggregated data
  likes_count?: number;
  user_has_liked?: boolean;
  comments_count?: number;
}

export interface PhotoComment {
  id: string;
  photo_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  author_nickname?: string;
}

export function useMemoryGallery() {
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Fetch all photos with likes count
  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Fetch photos
      const { data: photosData, error: photosError } = await supabase
        .from('memory_gallery')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (photosError) throw photosError;

      if (!photosData || photosData.length === 0) {
        setPhotos([]);
        setLoading(false);
        return;
      }

      // Fetch likes, comments, and user likes in parallel
      const photoIds = photosData.map(p => p.id);

      const [likesResult, commentsResult, userLikesResult] = await Promise.all([
        supabase.from('memory_gallery_likes').select('photo_id').in('photo_id', photoIds),
        supabase.from('memory_gallery_comments').select('photo_id').in('photo_id', photoIds),
        userId
          ? supabase.from('memory_gallery_likes').select('photo_id').eq('user_id', userId).in('photo_id', photoIds)
          : Promise.resolve({ data: [] as { photo_id: string }[] }),
      ]);

      const userLikes = ((userLikesResult as any).data || []).map((l: any) => l.photo_id);

      // Count likes and comments per photo
      const likesCount: Record<string, number> = {};
      const commentsCount: Record<string, number> = {};
      
      (likesResult.data || []).forEach(l => {
        likesCount[l.photo_id] = (likesCount[l.photo_id] || 0) + 1;
      });
      
      (commentsResult.data || []).forEach(c => {
        commentsCount[c.photo_id] = (commentsCount[c.photo_id] || 0) + 1;
      });

      // Merge data
      const enrichedPhotos: MemoryPhoto[] = photosData.map(photo => ({
        ...photo,
        likes_count: likesCount[photo.id] || 0,
        user_has_liked: userLikes.includes(photo.id),
        comments_count: commentsCount[photo.id] || 0,
      }));

      setPhotos(enrichedPhotos);
    } catch (err) {
      console.error('[useMemoryGallery] Error fetching photos:', err);
      toast.error('Error al cargar la galería');
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload multiple photos (max 20 per upload, max 100 total per user)
  const uploadPhotos = useCallback(async (
    files: File[], 
    caption?: string,
    photoDate?: string
  ): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Debes iniciar sesión');
      return false;
    }

    if (files.length > 20) {
      toast.error('Máximo 20 fotos por carga');
      return false;
    }

    // Check user's current photo count (max 100 per user)
    const { count: currentCount } = await supabase
      .from('memory_gallery')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const userPhotoCount = currentCount || 0;
    const maxPhotosPerUser = 100;
    const remainingSlots = maxPhotosPerUser - userPhotoCount;

    if (remainingSlots <= 0) {
      toast.error(`Has alcanzado el límite de ${maxPhotosPerUser} fotos`);
      return false;
    }

    if (files.length > remainingSlots) {
      toast.error(`Solo puedes subir ${remainingSlots} foto${remainingSlots !== 1 ? 's' : ''} más (límite: ${maxPhotosPerUser})`);
      return false;
    }

    setUploading(true);
    let successCount = 0;

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 5 * 1024 * 1024) continue;

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('community_images')
          .upload(fileName, file, { upsert: true });

        if (uploadError) continue;

        const { data: { publicUrl } } = supabase.storage
          .from('community_images')
          .getPublicUrl(fileName);

        const { error: insertError } = await supabase
          .from('memory_gallery')
          .insert({
            user_id: user.id,
            image_url: publicUrl,
            caption: caption || null,
            photo_date: photoDate || null,
          });

        if (insertError) continue;
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

  // Toggle like on a photo
  const toggleLike = useCallback(async (photoId: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Debes iniciar sesión');
      return false;
    }

    try {
      // Check if already liked
      const { data: existing } = await supabase
        .from('memory_gallery_likes')
        .select('id')
        .eq('photo_id', photoId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Unlike
        await supabase
          .from('memory_gallery_likes')
          .delete()
          .eq('id', existing.id);
      } else {
        // Like
        await supabase
          .from('memory_gallery_likes')
          .insert({ photo_id: photoId, user_id: user.id });
      }

      // Update local state optimistically
      setPhotos(prev => prev.map(p => {
        if (p.id === photoId) {
          return {
            ...p,
            likes_count: existing ? (p.likes_count || 1) - 1 : (p.likes_count || 0) + 1,
            user_has_liked: !existing,
          };
        }
        return p;
      }));

      return true;
    } catch (err) {
      console.error('[useMemoryGallery] Error toggling like:', err);
      return false;
    }
  }, []);

  // Get comments for a photo
  const getComments = useCallback(async (photoId: string): Promise<PhotoComment[]> => {
    try {
      const { data, error } = await supabase
        .from('memory_gallery_comments')
        .select('*')
        .eq('photo_id', photoId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get author nicknames
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', userIds);

      const nicknameMap: Record<string, string> = {};
      (profiles || []).forEach(p => {
        nicknameMap[p.id] = p.nickname;
      });

      return (data || []).map(c => ({
        ...c,
        author_nickname: nicknameMap[c.user_id] || 'Usuario',
      }));
    } catch (err) {
      console.error('[useMemoryGallery] Error fetching comments:', err);
      return [];
    }
  }, []);

  // Add a comment
  const addComment = useCallback(async (photoId: string, comment: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Debes iniciar sesión');
      return false;
    }

    if (comment.length > 200) {
      toast.error('El comentario es muy largo (máx 200 caracteres)');
      return false;
    }

    try {
      const { error } = await supabase
        .from('memory_gallery_comments')
        .insert({ photo_id: photoId, user_id: user.id, comment });

      if (error) throw error;

      // Update comments count locally
      setPhotos(prev => prev.map(p => {
        if (p.id === photoId) {
          return { ...p, comments_count: (p.comments_count || 0) + 1 };
        }
        return p;
      }));

      return true;
    } catch (err) {
      console.error('[useMemoryGallery] Error adding comment:', err);
      toast.error('Error al comentar');
      return false;
    }
  }, []);

  // Delete a comment
  const deleteComment = useCallback(async (commentId: string, photoId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('memory_gallery_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Update comments count locally
      setPhotos(prev => prev.map(p => {
        if (p.id === photoId) {
          return { ...p, comments_count: Math.max((p.comments_count || 1) - 1, 0) };
        }
        return p;
      }));

      return true;
    } catch (err) {
      console.error('[useMemoryGallery] Error deleting comment:', err);
      return false;
    }
  }, []);

  // Initial fetch + realtime
  useEffect(() => {
    fetchPhotos();

    const channel = supabase
      .channel('memory_gallery_all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memory_gallery' }, () => fetchPhotos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memory_gallery_likes' }, () => fetchPhotos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memory_gallery_comments' }, () => fetchPhotos())
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
    toggleLike,
    getComments,
    addComment,
    deleteComment,
    refresh: fetchPhotos,
  };
}
