-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can view online locations" ON public.user_locations;
DROP POLICY IF EXISTS "Users can insert their own location" ON public.user_locations;
DROP POLICY IF EXISTS "Users can update their own location" ON public.user_locations;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Authenticated users can view online locations"
  ON public.user_locations FOR SELECT
  USING (is_online = true);

CREATE POLICY "Users can insert their own location"
  ON public.user_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own location"
  ON public.user_locations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);