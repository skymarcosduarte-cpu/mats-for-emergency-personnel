-- Fix: Add security_invoker=true to user_locations_with_roles view
-- This ensures the view respects the RLS policies of the querying user, not the view creator

DROP VIEW IF EXISTS public.user_locations_with_roles;

CREATE VIEW public.user_locations_with_roles 
WITH (security_invoker = true) AS
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
        WHEN pp.show_name_on_map IS TRUE THEN pp.nickname
        ELSE NULL::text
    END AS display_name,
    pp.show_name_on_map,
    pp.can_provide_medical_assistance,
    pp.has_first_aid_kit,
    pp.has_ambulance,
    (EXISTS ( SELECT 1
           FROM transit_trips tt
          WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE'::text)) AS is_in_transit,
    ( SELECT tt.destination
           FROM transit_trips tt
          WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE'::text
          ORDER BY tt.created_at DESC
         LIMIT 1) AS transit_destination,
    ( SELECT tt.destination_lat
           FROM transit_trips tt
          WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE'::text
          ORDER BY tt.created_at DESC
         LIMIT 1) AS transit_destination_lat,
    ( SELECT tt.destination_lng
           FROM transit_trips tt
          WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE'::text
          ORDER BY tt.created_at DESC
         LIMIT 1) AS transit_destination_lng,
    ( SELECT tt.origin
           FROM transit_trips tt
          WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE'::text
          ORDER BY tt.created_at DESC
         LIMIT 1) AS transit_origin,
    ( SELECT tt.origin_lat
           FROM transit_trips tt
          WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE'::text
          ORDER BY tt.created_at DESC
         LIMIT 1) AS transit_origin_lat,
    ( SELECT tt.origin_lng
           FROM transit_trips tt
          WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE'::text
          ORDER BY tt.created_at DESC
         LIMIT 1) AS transit_origin_lng,
    ( SELECT tt.eta
           FROM transit_trips tt
          WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE'::text
          ORDER BY tt.created_at DESC
         LIMIT 1) AS transit_eta
FROM user_locations ul
LEFT JOIN user_roles ur ON ul.user_id = ur.user_id
JOIN profiles_public pp ON ul.user_id = pp.user_id
WHERE ul.is_online = true AND pp.share_location = true;

-- Grant access to authenticated users
GRANT SELECT ON public.user_locations_with_roles TO authenticated;