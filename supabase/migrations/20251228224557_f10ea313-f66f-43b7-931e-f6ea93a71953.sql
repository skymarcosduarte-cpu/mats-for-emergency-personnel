-- Allow authenticated users to view position history for active trips (community visibility)
CREATE POLICY "Authenticated users can view position history for active trips"
ON public.trip_position_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.transit_trips t
    WHERE t.id = trip_position_history.trip_id
    AND t.status = 'ACTIVE'
  )
);