-- Add arrived_at column to help_requests to track when responder arrives
ALTER TABLE public.help_requests 
ADD COLUMN arrived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.help_requests.arrived_at IS 'Timestamp when the responder arrived at the emergency location';