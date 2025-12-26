-- Add column to track who is responding to a help request
ALTER TABLE public.help_requests 
ADD COLUMN responding_by uuid REFERENCES auth.users(id),
ADD COLUMN responding_started_at timestamptz;

-- Create index for efficient lookups
CREATE INDEX idx_help_requests_responding ON public.help_requests(responding_by) WHERE responding_by IS NOT NULL;

-- Add audio_url column for voice notes
ALTER TABLE public.help_requests
ADD COLUMN audio_url text,
ADD COLUMN audio_duration_ms integer;