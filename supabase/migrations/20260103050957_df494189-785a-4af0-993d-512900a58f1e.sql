-- Fix 1: profiles_public - Require authentication for viewing
DROP POLICY IF EXISTS "Authenticated users can view public profiles" ON public.profiles_public;

CREATE POLICY "Authenticated users can view public profiles"
ON public.profiles_public
FOR SELECT
TO authenticated
USING (share_location = true);

-- Fix 2: admin_users_view - Restrict to admins only
-- First, recreate the view with security_invoker to respect RLS
DROP VIEW IF EXISTS public.admin_users_view;

CREATE VIEW public.admin_users_view
WITH (security_invoker = true)
AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.nickname,
  p.phone,
  p.invite_code_used,
  p.created_at as registered_at,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id;

-- Grant access only to authenticated users (RLS on profiles will filter)
GRANT SELECT ON public.admin_users_view TO authenticated;

-- Fix 3: medical_providers - Recreate with security_invoker
DROP VIEW IF EXISTS public.medical_providers;

CREATE VIEW public.medical_providers
WITH (security_invoker = true)
AS
SELECT 
  ul.user_id,
  ul.lat,
  ul.lng,
  ul.is_online,
  ul.updated_at,
  pp.can_provide_medical_assistance,
  pp.has_first_aid_kit,
  pp.has_ambulance
FROM public.user_locations ul
JOIN public.profiles_public pp ON ul.user_id = pp.user_id
WHERE pp.can_provide_medical_assistance = true
  AND ul.is_online = true
  AND pp.share_location = true;

GRANT SELECT ON public.medical_providers TO authenticated;

-- Fix 4: user_locations_with_roles - Recreate with security_invoker
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
  ur.role,
  pp.nickname as display_name,
  pp.show_name_on_map,
  pp.specialties,
  pp.can_provide_medical_assistance,
  pp.has_first_aid_kit,
  pp.has_ambulance,
  pp.has_rescue_unit,
  pp.has_k9_unit,
  CASE WHEN tt.id IS NOT NULL AND tt.status = 'ACTIVE' THEN true ELSE false END as is_in_transit,
  tt.origin as transit_origin,
  tt.destination as transit_destination,
  tt.eta as transit_eta,
  tt.origin_lat as transit_origin_lat,
  tt.origin_lng as transit_origin_lng,
  tt.destination_lat as transit_destination_lat,
  tt.destination_lng as transit_destination_lng
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
LEFT JOIN public.profiles_public pp ON ul.user_id = pp.user_id
LEFT JOIN public.transit_trips tt ON ul.user_id = tt.user_id AND tt.status = 'ACTIVE'
WHERE ul.is_online = true
  AND pp.share_location = true;

GRANT SELECT ON public.user_locations_with_roles TO authenticated;