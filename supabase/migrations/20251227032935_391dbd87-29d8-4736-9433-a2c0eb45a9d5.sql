-- Enable REPLICA IDENTITY FULL for internal_messages to ensure realtime updates work correctly
ALTER TABLE public.internal_messages REPLICA IDENTITY FULL;