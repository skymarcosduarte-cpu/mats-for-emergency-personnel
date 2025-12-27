-- Add image_url column to internal_messages table
ALTER TABLE public.internal_messages
ADD COLUMN image_url text DEFAULT NULL;