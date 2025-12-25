-- Create the reports_media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports_media', 'reports_media', true);

-- Allow authenticated users to upload files to reports_media
CREATE POLICY "Authenticated users can upload media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reports_media');

-- Allow anyone to view media (public bucket)
CREATE POLICY "Anyone can view reports media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'reports_media');

-- Allow users to delete their own uploads (based on folder structure user_id/...)
CREATE POLICY "Users can delete their own media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'reports_media' AND auth.uid()::text = (storage.foldername(name))[1]);