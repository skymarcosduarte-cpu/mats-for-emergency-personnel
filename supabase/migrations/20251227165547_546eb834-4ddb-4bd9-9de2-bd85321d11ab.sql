-- Enable REPLICA IDENTITY FULL for proper realtime subscriptions
-- This ensures all row data is captured during INSERT/UPDATE/DELETE events

ALTER TABLE public.panic_events REPLICA IDENTITY FULL;
ALTER TABLE public.help_requests REPLICA IDENTITY FULL;
ALTER TABLE public.panic_event_responders REPLICA IDENTITY FULL;
ALTER TABLE public.help_request_responders REPLICA IDENTITY FULL;
ALTER TABLE public.user_locations REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication if not already added
-- This enables realtime updates for these tables

DO $$ 
BEGIN
  -- Check and add panic_events
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'panic_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.panic_events;
  END IF;

  -- Check and add help_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'help_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.help_requests;
  END IF;

  -- Check and add panic_event_responders
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'panic_event_responders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.panic_event_responders;
  END IF;

  -- Check and add help_request_responders
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'help_request_responders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.help_request_responders;
  END IF;

  -- Check and add user_locations
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;
  END IF;
END $$;