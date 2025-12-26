-- Create a view that joins user_locations with user_roles
CREATE OR REPLACE VIEW public.user_locations_with_roles AS
SELECT 
  ul.user_id,
  ul.lat,
  ul.lng,
  ul.accuracy,
  ul.heading,
  ul.speed,
  ul.is_online,
  ul.updated_at,
  COALESCE(ur.role, 'FAMILIAR') as role
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id;

-- Enable RLS on the view (views inherit from base tables, but we need to grant access)
-- Grant select to authenticated users for the view
GRANT SELECT ON public.user_locations_with_roles TO authenticated;

-- Create RLS policy for the view (only online users visible)
DROP POLICY IF EXISTS "Authenticated users can view online locations with roles" ON public.user_locations;

-- The view will inherit the RLS from user_locations table