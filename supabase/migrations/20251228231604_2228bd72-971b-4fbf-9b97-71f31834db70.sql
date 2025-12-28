-- Add image_url column to community_events table
ALTER TABLE public.community_events 
ADD COLUMN image_url text;

-- Create storage bucket for community event images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('community_images', 'community_images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for community images - anyone can view
CREATE POLICY "Community images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'community_images');

-- Create storage policy - authenticated users can upload
CREATE POLICY "Authenticated users can upload community images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'community_images' AND auth.uid() IS NOT NULL);

-- Create storage policy - users can delete their own uploads
CREATE POLICY "Users can delete their own community images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'community_images' AND auth.uid()::text = (storage.foldername(name))[1]);