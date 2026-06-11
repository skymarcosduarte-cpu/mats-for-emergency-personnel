
-- 1) Add ADMIN to app_role enum (separate from rescatista)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ADMIN';

-- 2) Restrict user_roles: prevent self-escalation
DROP POLICY IF EXISTS "Users can update their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own role on signup" ON public.user_roles;

-- Allow self-insert only of the default FAMILIAR role (signup flow)
CREATE POLICY "Users can self-assign default familiar role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'FAMILIAR');

-- 3) Restrict broadly-public SELECT policies to authenticated role only
DROP POLICY IF EXISTS "Authenticated users can view online locations" ON public.user_locations;
CREATE POLICY "Authenticated users can view online locations"
ON public.user_locations
FOR SELECT
TO authenticated
USING (is_online = true);

DROP POLICY IF EXISTS "Authenticated users can view active trips" ON public.transit_trips;
CREATE POLICY "Authenticated users can view active trips"
ON public.transit_trips
FOR SELECT
TO authenticated
USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "Authenticated users can view position history for active trips" ON public.trip_position_history;
CREATE POLICY "Authenticated users can view position history for active trips"
ON public.trip_position_history
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.transit_trips t
  WHERE t.id = trip_position_history.trip_id AND t.status = 'ACTIVE'
));

DROP POLICY IF EXISTS "Users can view all active streams" ON public.emergency_streams;
CREATE POLICY "Authenticated users can view active streams"
ON public.emergency_streams
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can view clave100 checkins" ON public.clave100_checkins;
CREATE POLICY "Authenticated users can view clave100 checkins"
ON public.clave100_checkins
FOR SELECT
TO authenticated
USING (true);
