-- Fix Security Definer views by recreating them with SECURITY INVOKER
-- This ensures RLS policies of the querying user are enforced

-- Drop and recreate medical_providers view with SECURITY INVOKER
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
WHERE ul.is_online = true 
  AND pp.share_location = true 
  AND pp.can_provide_medical_assistance = true;

-- Drop and recreate user_locations_with_roles view with SECURITY INVOKER
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
  CASE
    WHEN pp.show_name_on_map THEN pp.nickname
    ELSE NULL::text
  END AS display_name,
  pp.show_name_on_map,
  pp.can_provide_medical_assistance,
  pp.has_first_aid_kit,
  pp.has_ambulance,
  pp.has_rescue_unit,
  pp.has_k9_unit,
  pp.specialties,
  CASE
    WHEN tt.status = 'ACTIVE'::text AND tt.eta > now() THEN true
    ELSE false
  END AS is_in_transit,
  tt.destination AS transit_destination,
  tt.destination_lat AS transit_destination_lat,
  tt.destination_lng AS transit_destination_lng,
  tt.origin AS transit_origin,
  tt.origin_lat AS transit_origin_lat,
  tt.origin_lng AS transit_origin_lng,
  tt.eta AS transit_eta
FROM public.user_locations ul
JOIN public.profiles_public pp ON ul.user_id = pp.user_id
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
LEFT JOIN public.transit_trips tt ON ul.user_id = tt.user_id 
  AND tt.status = 'ACTIVE'::text 
  AND tt.eta > now()
WHERE pp.share_location = true;

-- Grant SELECT on views to authenticated users
GRANT SELECT ON public.medical_providers TO authenticated;
GRANT SELECT ON public.user_locations_with_roles TO authenticated;