-- Add voice message support to internal_messages
ALTER TABLE public.internal_messages 
ADD COLUMN audio_url TEXT DEFAULT NULL,
ADD COLUMN audio_duration_ms INTEGER DEFAULT NULL;