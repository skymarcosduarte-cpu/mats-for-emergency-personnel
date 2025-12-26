-- Add audio support columns to panic_events
ALTER TABLE public.panic_events
ADD COLUMN IF NOT EXISTS audio_url text,
ADD COLUMN IF NOT EXISTS audio_duration_ms integer;