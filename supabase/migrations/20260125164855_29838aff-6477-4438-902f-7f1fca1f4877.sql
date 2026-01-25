-- Fix linter: RLS enabled but no policies on skyalert_cache
-- Keep this cache table inaccessible from the client.
CREATE POLICY "No direct access to skyalert_cache"
ON public.skyalert_cache
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Fix linter: extension installed in public schema
-- pg_net doesn't support ALTER EXTENSION ... SET SCHEMA, so we recreate it in extensions.
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
