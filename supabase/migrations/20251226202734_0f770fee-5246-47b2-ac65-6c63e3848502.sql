-- Update the view to include active transit status
DROP VIEW IF EXISTS public.user_locations_with_roles;

CREATE VIEW public.user_locations_with_roles 
WITH (security_invoker = true)
AS
SELECT 
  ul.user_id,
  ul.lat,
  ul.lng,
  ul.accuracy,
  ul.heading,
  ul.speed,
  ul.is_online,
  ul.updated_at,
  COALESCE(ur.role, 'FAMILIAR'::app_role) as role,
  CASE 
    WHEN p.show_name_on_map = true THEN COALESCE(p.nickname, p.full_name)
    ELSE NULL
  END as display_name,
  p.show_name_on_map,
  -- Check if user has an active land transit trip
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.transit_trips tt 
      WHERE tt.user_id = ul.user_id 
        AND tt.status = 'ACTIVE' 
        AND tt.transit_type = 'ROAD'
    ) THEN true
    ELSE false
  END as is_in_transit,
  -- Get transit destination if in transit
  (
    SELECT tt.destination 
    FROM public.transit_trips tt 
    WHERE tt.user_id = ul.user_id 
      AND tt.status = 'ACTIVE' 
      AND tt.transit_type = 'ROAD'
    ORDER BY tt.created_at DESC
    LIMIT 1
  ) as transit_destination
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
LEFT JOIN public.profiles p ON ul.user_id = p.id
WHERE ul.is_online = true;

-- Grant access
GRANT SELECT ON public.user_locations_with_roles TO authenticated;