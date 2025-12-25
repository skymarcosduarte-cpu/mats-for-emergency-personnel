-- Drop the security definer view and recreate as a regular view
DROP VIEW IF EXISTS public.medical_providers;

-- Recreate as a simple view - RLS on underlying tables will be enforced
CREATE VIEW public.medical_providers 
WITH (security_invoker = true) AS
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

-- Grant access to authenticated users
GRANT SELECT ON public.medical_providers TO authenticated;