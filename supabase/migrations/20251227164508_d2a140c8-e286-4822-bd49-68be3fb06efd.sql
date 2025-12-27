-- Enable REPLICA IDENTITY FULL for user_locations table
-- This ensures realtime subscriptions receive complete row data on UPDATE events
ALTER TABLE public.user_locations REPLICA IDENTITY FULL;