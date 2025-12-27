-- Drop and recreate views with SECURITY INVOKER (default, but explicit)
-- This ensures the views use the permissions of the querying user, not the creator

DROP VIEW IF EXISTS public.user_locations_with_roles;
DROP VIEW IF EXISTS public.medical_providers;

-- Recreate user_locations_with_roles with security invoker
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
        WHEN p.show_name_on_map AND p.share_location THEN 
            COALESCE(p.nickname, split_part(p.full_name, ' ', 1))
        ELSE NULL 
    END as display_name,
    p.show_name_on_map,
    p.can_provide_medical_assistance,
    p.has_first_aid_kit,
    p.has_ambulance,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM transit_trips tt 
            WHERE tt.user_id = ul.user_id 
            AND tt.status = 'ACTIVE'
        ) THEN true
        ELSE false
    END as is_in_transit,
    (
        SELECT destination FROM transit_trips tt 
        WHERE tt.user_id = ul.user_id 
        AND tt.status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 1
    ) as transit_destination,
    (
        SELECT destination_lat FROM transit_trips tt 
        WHERE tt.user_id = ul.user_id 
        AND tt.status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 1
    ) as transit_destination_lat,
    (
        SELECT destination_lng FROM transit_trips tt 
        WHERE tt.user_id = ul.user_id 
        AND tt.status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 1
    ) as transit_destination_lng
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
LEFT JOIN public.profiles p ON ul.user_id = p.id
WHERE p.share_location = true;

-- Recreate medical_providers with security invoker
CREATE VIEW public.medical_providers 
WITH (security_invoker = true)
AS
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
WHERE p.can_provide_medical_assistance = true 
  AND p.share_location = true
  AND ul.is_online = true;