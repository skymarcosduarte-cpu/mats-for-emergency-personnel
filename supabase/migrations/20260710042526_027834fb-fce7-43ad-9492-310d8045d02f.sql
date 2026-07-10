
-- Drop the previous SECURITY DEFINER view (linter ERROR) and replace with
-- a SECURITY DEFINER function that returns only safe columns.

DROP VIEW IF EXISTS public.community_trips_view;

CREATE OR REPLACE FUNCTION public.get_community_trips()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  transit_type text,
  origin text,
  destination text,
  eta timestamptz,
  status text,
  created_at timestamptz,
  arrived_at timestamptz,
  origin_lat double precision,
  origin_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  vehicle_type text,
  plates text,
  companions text,
  airline text,
  flight_number text,
  departure_airport text,
  arrival_airport text,
  departure_time timestamptz,
  arrival_time timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id, t.user_id, t.transit_type, t.origin, t.destination,
    t.eta, t.status, t.created_at, t.arrived_at,
    t.origin_lat, t.origin_lng, t.destination_lat, t.destination_lng,
    t.vehicle_type, t.plates, t.companions,
    t.airline, t.flight_number,
    t.departure_airport, t.arrival_airport,
    t.departure_time, t.arrival_time
  FROM public.transit_trips t
  WHERE t.status = 'ACTIVE'
     OR (t.status IN ('ARRIVED','CANCELLED')
         AND t.arrived_at > now() - interval '24 hours')
  ORDER BY COALESCE(t.arrived_at, t.created_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.get_community_trips() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_community_trips() TO authenticated;
