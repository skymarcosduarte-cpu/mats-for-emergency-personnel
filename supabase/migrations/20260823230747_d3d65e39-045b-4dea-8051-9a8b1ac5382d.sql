ALTER TABLE public.status_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.status_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;