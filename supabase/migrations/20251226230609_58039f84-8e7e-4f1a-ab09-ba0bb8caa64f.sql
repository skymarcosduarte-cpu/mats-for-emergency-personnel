-- Add has_ambulance field to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_ambulance boolean DEFAULT false;

-- Update the user_locations_with_roles view to include has_ambulance
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
  CASE 
    WHEN p.show_name_on_map THEN p.nickname
    ELSE NULL
  END as display_name,
  p.show_name_on_map,
  p.can_provide_medical_assistance,
  p.has_first_aid_kit,
  p.has_ambulance,
  CASE 
    WHEN tt.id IS NOT NULL AND tt.status = 'ACTIVE' THEN true
    ELSE false
  END as is_in_transit,
  tt.destination as transit_destination,
  tt.destination_lat as transit_destination_lat,
  tt.destination_lng as transit_destination_lng
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
LEFT JOIN public.profiles p ON ul.user_id = p.id
LEFT JOIN public.transit_trips tt ON ul.user_id = tt.user_id AND tt.status = 'ACTIVE'
WHERE ul.is_online = true;

-- Update medical_providers view to include ambulance
DROP VIEW IF EXISTS public.medical_providers;

CREATE VIEW public.medical_providers AS
SELECT 
  ul.user_id,
  ul.lat,
  ul.lng,
  ul.is_online,
  ul.updated_at,
  p.can_provide_medical_assistance,
  p.has_first_aid_kit,
  p.has_ambulance
FROM public.user_locations ul
JOIN public.profiles p ON ul.user_id = p.id
WHERE ul.is_online = true
  AND (p.can_provide_medical_assistance = true 
       OR p.has_first_aid_kit = true 
       OR p.has_ambulance = true);