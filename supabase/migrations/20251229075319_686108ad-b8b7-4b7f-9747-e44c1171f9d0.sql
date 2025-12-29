-- Drop and recreate the user_locations_with_roles view to include has_k9_unit
DROP VIEW IF EXISTS public.user_locations_with_roles;

CREATE VIEW public.user_locations_with_roles AS
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
  CASE WHEN pp.show_name_on_map THEN pp.nickname ELSE NULL END as display_name,
  pp.show_name_on_map,
  pp.can_provide_medical_assistance,
  pp.has_first_aid_kit,
  pp.has_ambulance,
  pp.has_rescue_unit,
  pp.has_k9_unit,
  pp.specialties,
  -- Transit info
  CASE WHEN tt.status = 'ACTIVE' AND tt.eta > now() THEN true ELSE false END as is_in_transit,
  tt.destination as transit_destination,
  tt.destination_lat as transit_destination_lat,
  tt.destination_lng as transit_destination_lng,
  tt.origin as transit_origin,
  tt.origin_lat as transit_origin_lat,
  tt.origin_lng as transit_origin_lng,
  tt.eta as transit_eta
FROM public.user_locations ul
INNER JOIN public.profiles_public pp ON ul.user_id = pp.user_id
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
LEFT JOIN public.transit_trips tt ON ul.user_id = tt.user_id AND tt.status = 'ACTIVE' AND tt.eta > now()
WHERE pp.share_location = true;