// Hook for Job Board functionality
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface JobPost {
  id: string;
  user_id: string;
  full_name: string;
  title: string;
  experience: string | null;
  position_sought: string;
  cv_url: string | null;
  cv_filename: string | null;
  linkedin_url: string | null;
  is_offering_job: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateJobPostData {
  full_name: string;
  title: string;
  experience?: string;
  position_sought: string;
  linkedin_url?: string;
  is_offering_job: boolean;
}

export function useJobBoard() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [myPost, setMyPost] = useState<JobPost | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_board')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Type cast the data since the types haven't regenerated yet
      const typedData = (data || []) as unknown as JobPost[];
      setPosts(typedData);

      // Find current user's post
      if (user) {
        const userPost = typedData.find(p => p.user_id === user.id);
        setMyPost(userPost || null);
      }
    } catch (err) {
      console.error('Error fetching job posts:', err);
      toast.error('Error al cargar las publicaciones');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('job_board_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_board',
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  const uploadCV = async (file: File): Promise<{ url: string; filename: string }> => {
    if (!user) throw new Error('No autenticado');

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(fileExt || '')) {
      throw new Error('Solo se permiten archivos PDF, DOC o DOCX');
    }

    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('job_cvs')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    // Bucket is private; store the storage path. Signed URLs are generated on demand.
    return { url: fileName, filename: file.name };
  };

  const createPost = async (data: CreateJobPostData, cvFile?: File) => {
    if (!user) throw new Error('No autenticado');

    let cvUrl: string | null = null;
    let cvFilename: string | null = null;

    if (cvFile) {
      const { url, filename } = await uploadCV(cvFile);
      cvUrl = url;
      cvFilename = filename;
    }

    const { error } = await supabase.from('job_board').insert({
      user_id: user.id,
      full_name: data.full_name,
      title: data.title,
      experience: data.experience || null,
      position_sought: data.position_sought,
      linkedin_url: data.linkedin_url || null,
      is_offering_job: data.is_offering_job,
      cv_url: cvUrl,
      cv_filename: cvFilename,
    });

    if (error) throw error;

    await fetchPosts();
    toast.success('Publicación creada');
  };

  const updatePost = async (postId: string, data: Partial<CreateJobPostData>, cvFile?: File) => {
    if (!user) throw new Error('No autenticado');

    let cvUrl: string | undefined;
    let cvFilename: string | undefined;

    if (cvFile) {
      const { url, filename } = await uploadCV(cvFile);
      cvUrl = url;
      cvFilename = filename;
    }

    const updateData: Record<string, unknown> = { ...data };
    if (cvUrl) {
      updateData.cv_url = cvUrl;
      updateData.cv_filename = cvFilename;
    }

    const { error } = await supabase
      .from('job_board')
      .update(updateData as never)
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) throw error;

    await fetchPosts();
    toast.success('Publicación actualizada');
  };

  const deletePost = async (postId: string) => {
    if (!user) throw new Error('No autenticado');

    const { error } = await supabase
      .from('job_board')
      .delete()
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) throw error;

    await fetchPosts();
    toast.success('Publicación eliminada');
  };

  const toggleActive = async (postId: string, isActive: boolean) => {
    if (!user) throw new Error('No autenticado');

    const { error } = await supabase
      .from('job_board')
      .update({ is_active: isActive })
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) throw error;

    await fetchPosts();
  };

  return {
    posts,
    loading,
    myPost,
    createPost,
    updatePost,
    deletePost,
    toggleActive,
    refresh: fetchPosts,
  };
}
