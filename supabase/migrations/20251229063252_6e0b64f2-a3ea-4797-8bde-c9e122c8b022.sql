-- Add column to track tutorial disclaimer acceptance
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tutorial_disclaimer_accepted_at timestamp with time zone DEFAULT NULL;