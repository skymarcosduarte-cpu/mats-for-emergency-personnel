-- Add privacy consent fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS share_location boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS share_medical_info boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_consent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone;

-- Add comment explaining these fields
COMMENT ON COLUMN public.profiles.share_location IS 'User consent to share their real-time location with the community for emergency response';
COMMENT ON COLUMN public.profiles.share_medical_info IS 'User consent to share their medical info with rescuers during emergencies';
COMMENT ON COLUMN public.profiles.privacy_consent_at IS 'Timestamp when user accepted the privacy notice';
COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'Timestamp when user accepted the terms of service';

-- Update the user_locations_with_roles view to respect share_location preference
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
WHERE p.share_location = true OR p.share_location IS NULL;

-- Update medical_providers view to respect share_medical_info preference
CREATE OR REPLACE VIEW public.medical_providers AS
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
  AND (p.share_location = true OR p.share_location IS NULL)
  AND ul.is_online = true;