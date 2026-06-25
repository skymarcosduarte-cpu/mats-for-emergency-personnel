
-- 1) emergency_streams: owner or rescatista only
DROP POLICY IF EXISTS "Authenticated users can view active streams" ON public.emergency_streams;
CREATE POLICY "Owners and rescatistas can view streams"
ON public.emergency_streams FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_rescatista(auth.uid()));

-- 2) emergency_stream_clips: owner or rescatista only
DROP POLICY IF EXISTS "Authenticated users can view clips" ON public.emergency_stream_clips;
CREATE POLICY "Owners and rescatistas can view clips"
ON public.emergency_stream_clips FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_rescatista(auth.uid()));

-- 3) storage: emergency-streams bucket - owner folder or rescatista
DROP POLICY IF EXISTS "Authenticated users can view emergency streams" ON storage.objects;
CREATE POLICY "Owners and rescatistas can view emergency stream files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'emergency-streams'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.is_rescatista(auth.uid())
  )
);

-- 4) storage: reports_media bucket - owner folder or rescatista
DROP POLICY IF EXISTS "Authenticated users can view reports media" ON storage.objects;
CREATE POLICY "Owners and rescatistas can view reports media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports_media'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.is_rescatista(auth.uid())
  )
);

-- 5) storage: job_cvs bucket - owner folder only (admins use service role)
DROP POLICY IF EXISTS "Authenticated users can view job CVs" ON storage.objects;
CREATE POLICY "Users can view only their own CVs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'job_cvs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 6) transit_trips: remove anon share_token row exposure; expose safe fields via RPC
DROP POLICY IF EXISTS "Anyone can view trips by share_token" ON public.transit_trips;

CREATE OR REPLACE FUNCTION public.get_shared_trip(_share_token uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  transit_type text,
  origin text,
  destination text,
  origin_lat double precision,
  origin_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  eta timestamptz,
  status text,
  plates text,
  vehicle_type text,
  airline text,
  flight_number text,
  departure_airport text,
  arrival_airport text,
  departure_time timestamptz,
  arrival_time timestamptz,
  created_at timestamptz,
  arrived_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.user_id, t.transit_type, t.origin, t.destination,
         t.origin_lat, t.origin_lng, t.destination_lat, t.destination_lng,
         t.eta, t.status, t.plates, t.vehicle_type, t.airline, t.flight_number,
         t.departure_airport, t.arrival_airport, t.departure_time, t.arrival_time,
         t.created_at, t.arrived_at
  FROM public.transit_trips t
  WHERE t.share_token = _share_token AND t.status = 'ACTIVE';
$$;

REVOKE ALL ON FUNCTION public.get_shared_trip(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_trip(uuid) TO anon, authenticated;
