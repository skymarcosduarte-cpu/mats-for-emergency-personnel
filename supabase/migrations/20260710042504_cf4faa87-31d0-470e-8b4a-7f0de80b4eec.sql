
-- Restore community visibility of transit trips (active + recent completed)
-- through a safe view that excludes sensitive columns
-- (boarding_pass_url, vehicle_photo_url, share_token).

CREATE OR REPLACE VIEW public.community_trips_view
WITH (security_invoker = off) AS
SELECT
  id,
  user_id,
  transit_type,
  origin,
  destination,
  eta,
  status,
  created_at,
  arrived_at,
  origin_lat,
  origin_lng,
  destination_lat,
  destination_lng,
  vehicle_type,
  plates,
  companions,
  airline,
  flight_number,
  departure_airport,
  arrival_airport,
  departure_time,
  arrival_time
FROM public.transit_trips
WHERE status = 'ACTIVE'
   OR (status IN ('ARRIVED','CANCELLED') AND arrived_at > now() - interval '24 hours');

GRANT SELECT ON public.community_trips_view TO authenticated;
