-- SECURITY: Make reports_media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'reports_media';

-- Remove any overly permissive storage policies
DROP POLICY IF EXISTS "Anyone can view reports media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can download reports media" ON storage.objects;

-- Create proper RLS policies for reports_media bucket
-- Allow authenticated users to view media
CREATE POLICY "Authenticated users can view reports media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reports_media');

-- Allow users to upload their own media
CREATE POLICY "Authenticated users can upload to reports media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reports_media' AND auth.uid() IS NOT NULL);

-- Allow users to delete their own media (path starts with their user id)
CREATE POLICY "Users can delete their own reports media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reports_media' AND (storage.foldername(name))[1] = auth.uid()::text);