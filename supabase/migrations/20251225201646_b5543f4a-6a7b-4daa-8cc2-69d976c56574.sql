-- Add medical assistance columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN can_provide_medical_assistance boolean DEFAULT false,
ADD COLUMN has_first_aid_kit boolean DEFAULT false;

-- Create a view for medical providers that only exposes location and capability (no PII)
CREATE OR REPLACE VIEW public.medical_providers AS
SELECT 
  ul.user_id,
  ul.lat,
  ul.lng,
  ul.is_online,
  ul.updated_at,
  p.can_provide_medical_assistance,
  p.has_first_aid_kit
FROM public.user_locations ul
JOIN public.profiles p ON ul.user_id = p.id
WHERE ul.is_online = true 
  AND (p.can_provide_medical_assistance = true OR p.has_first_aid_kit = true);

-- Enable RLS on the view by granting access
GRANT SELECT ON public.medical_providers TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.medical_providers IS 'Anonymized view of online users who can provide medical assistance - no PII exposed';