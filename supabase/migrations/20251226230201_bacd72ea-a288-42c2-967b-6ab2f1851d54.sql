-- Drop and recreate the view to include medical fields
DROP VIEW IF EXISTS public.user_locations_with_roles;

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
  ur.role,
  CASE 
    WHEN p.show_name_on_map = true THEN p.nickname
    ELSE NULL
  END as display_name,
  p.show_name_on_map,
  p.can_provide_medical_assistance,
  p.has_first_aid_kit,
  EXISTS (
    SELECT 1 FROM public.transit_trips tt 
    WHERE tt.user_id = ul.user_id 
    AND tt.status = 'ACTIVE'
  ) as is_in_transit,
  (
    SELECT tt.destination FROM public.transit_trips tt 
    WHERE tt.user_id = ul.user_id 
    AND tt.status = 'ACTIVE'
    LIMIT 1
  ) as transit_destination,
  (
    SELECT tt.destination_lat FROM public.transit_trips tt 
    WHERE tt.user_id = ul.user_id 
    AND tt.status = 'ACTIVE'
    LIMIT 1
  ) as transit_destination_lat,
  (
    SELECT tt.destination_lng FROM public.transit_trips tt 
    WHERE tt.user_id = ul.user_id 
    AND tt.status = 'ACTIVE'
    LIMIT 1
  ) as transit_destination_lng
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ur.user_id = ul.user_id
LEFT JOIN public.profiles p ON p.id = ul.user_id
WHERE ul.is_online = true;