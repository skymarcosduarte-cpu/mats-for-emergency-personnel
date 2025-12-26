-- Add privacy setting to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS show_name_on_map boolean NOT NULL DEFAULT true;

-- Update the view to include name and privacy setting
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
  p.show_name_on_map
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
LEFT JOIN public.profiles p ON ul.user_id = p.id
WHERE ul.is_online = true;

-- Grant access
GRANT SELECT ON public.user_locations_with_roles TO authenticated;