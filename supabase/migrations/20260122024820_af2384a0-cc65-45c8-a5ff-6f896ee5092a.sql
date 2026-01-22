-- Drop restrictive SELECT policy and create a permissive one for authenticated users
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;

-- Allow any authenticated user to view emergency stream files
-- This is intentional: emergency clips are meant to be shared with the community
CREATE POLICY "Authenticated users can view emergency streams"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'emergency-streams'
  AND auth.uid() IS NOT NULL
);

-- Keep owner-only policies for INSERT and DELETE (already exist)
-- Users can only upload to their own folder and delete their own files