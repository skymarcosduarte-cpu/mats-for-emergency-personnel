-- Add transport_mode column to help_request_responders
ALTER TABLE public.help_request_responders 
ADD COLUMN transport_mode text;

-- Add transport_mode column to panic_event_responders
ALTER TABLE public.panic_event_responders 
ADD COLUMN transport_mode text;

-- Add estimated_eta column to help_request_responders (minutes)
ALTER TABLE public.help_request_responders 
ADD COLUMN estimated_eta_minutes integer;

-- Add estimated_eta column to panic_event_responders (minutes)
ALTER TABLE public.panic_event_responders 
ADD COLUMN estimated_eta_minutes integer;