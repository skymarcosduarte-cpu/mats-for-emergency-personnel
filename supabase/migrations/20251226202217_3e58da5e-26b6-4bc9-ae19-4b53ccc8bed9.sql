-- Drop and recreate the view with SECURITY INVOKER (default, but explicit)
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
  COALESCE(ur.role, 'FAMILIAR'::app_role) as role
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
WHERE ul.is_online = true;

-- Grant select to authenticated users
GRANT SELECT ON public.user_locations_with_roles TO authenticated;