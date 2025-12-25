-- Enable RLS on notifications table (was missing)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Move postgis extension to extensions schema (best practice)
DROP EXTENSION IF EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;