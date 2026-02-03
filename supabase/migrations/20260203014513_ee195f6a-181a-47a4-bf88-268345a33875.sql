-- Add LinkedIn URL field to job board
ALTER TABLE public.job_board 
ADD COLUMN linkedin_url TEXT;