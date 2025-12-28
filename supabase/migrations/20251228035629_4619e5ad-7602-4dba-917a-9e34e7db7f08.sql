-- Allow the community to see ACTIVE trips so they can be rendered on the map/routes
ALTER TABLE public.transit_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active trips" ON public.transit_trips;
CREATE POLICY "Authenticated users can view active trips"
ON public.transit_trips
FOR SELECT
USING (status = 'ACTIVE');
