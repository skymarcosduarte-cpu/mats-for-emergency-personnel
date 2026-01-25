-- Allow authenticated users to view recently concluded community trips
-- This fixes: concluded trips (ARRIVED/CANCELLED) not appearing in community history due to RLS.

CREATE POLICY "Authenticated users can view recent concluded trips"
ON public.transit_trips
FOR SELECT
TO authenticated
USING (
  status IN ('ARRIVED', 'CANCELLED')
  AND arrived_at IS NOT NULL
  AND arrived_at >= (now() - interval '24 hours')
);
