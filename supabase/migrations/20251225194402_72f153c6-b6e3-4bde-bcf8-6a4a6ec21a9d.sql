-- Update function to use extensions schema for PostGIS
CREATE OR REPLACE FUNCTION public.get_users_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 5000
)
RETURNS TABLE(user_id UUID, distance_meters DOUBLE PRECISION)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT 
    ul.user_id,
    extensions.ST_Distance(
      extensions.ST_SetSRID(extensions.ST_MakePoint(center_lng, center_lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(ul.lng, ul.lat), 4326)::geography
    ) as distance_meters
  FROM public.user_locations ul
  WHERE ul.is_online = true
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(center_lng, center_lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(ul.lng, ul.lat), 4326)::geography,
      radius_meters
    )
$$;