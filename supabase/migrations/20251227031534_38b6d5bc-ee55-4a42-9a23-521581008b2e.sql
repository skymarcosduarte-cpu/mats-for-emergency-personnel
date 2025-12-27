-- Recreate views so that opted-in shared location data is visible to other authenticated users
-- IMPORTANT: These views only expose non-PII fields and filter strictly to users who opted in.

DROP VIEW IF EXISTS public.user_locations_with_roles;
DROP VIEW IF EXISTS public.medical_providers;

-- Users who opted in to share location
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
    WHEN p.show_name_on_map IS TRUE THEN COALESCE(p.nickname, split_part(p.full_name, ' ', 1))
    ELSE NULL
  END AS display_name,
  p.show_name_on_map,
  p.can_provide_medical_assistance,
  p.has_first_aid_kit,
  p.has_ambulance,
  EXISTS (
    SELECT 1
    FROM public.transit_trips tt
    WHERE tt.user_id = ul.user_id
      AND tt.status = 'ACTIVE'
  ) AS is_in_transit,
  (
    SELECT tt.destination
    FROM public.transit_trips tt
    WHERE tt.user_id = ul.user_id
      AND tt.status = 'ACTIVE'
    ORDER BY tt.created_at DESC
    LIMIT 1
  ) AS transit_destination,
  (
    SELECT tt.destination_lat
    FROM public.transit_trips tt
    WHERE tt.user_id = ul.user_id
      AND tt.status = 'ACTIVE'
    ORDER BY tt.created_at DESC
    LIMIT 1
  ) AS transit_destination_lat,
  (
    SELECT tt.destination_lng
    FROM public.transit_trips tt
    WHERE tt.user_id = ul.user_id
      AND tt.status = 'ACTIVE'
    ORDER BY tt.created_at DESC
    LIMIT 1
  ) AS transit_destination_lng
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
JOIN public.profiles p ON ul.user_id = p.id
WHERE ul.is_online = true
  AND p.share_location = true;

-- Public listing of medical providers (voluntary responders)
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
  AND p.share_location = true
  AND p.can_provide_medical_assistance = true;

-- Ensure authenticated clients can read these views
GRANT SELECT ON public.user_locations_with_roles TO authenticated;
GRANT SELECT ON public.medical_providers TO authenticated;