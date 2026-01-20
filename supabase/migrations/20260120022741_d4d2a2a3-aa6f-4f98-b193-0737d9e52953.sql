-- Add link_url and video_url columns to community_events
ALTER TABLE public.community_events 
ADD COLUMN IF NOT EXISTS link_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS video_url text DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.community_events.link_url IS 'Optional URL link for the event';
COMMENT ON COLUMN public.community_events.video_url IS 'Optional video URL stored in community_images bucket';