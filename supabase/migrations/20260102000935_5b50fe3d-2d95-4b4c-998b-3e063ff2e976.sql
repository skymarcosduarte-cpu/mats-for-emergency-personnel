-- Add image_urls array column to community_events for multiple images
ALTER TABLE public.community_events 
ADD COLUMN image_urls text[] DEFAULT NULL;

-- Migrate existing single image_url to the new array column
UPDATE public.community_events 
SET image_urls = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND image_urls IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.community_events.image_urls IS 'Array of image URLs for the event';