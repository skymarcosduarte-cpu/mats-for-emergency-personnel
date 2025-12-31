-- Fix security definer view - change to SECURITY INVOKER
DROP VIEW IF EXISTS public.admin_users_view;

CREATE VIEW public.admin_users_view 
WITH (security_invoker = true)
AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.nickname,
  p.phone,
  p.invite_code_used,
  p.created_at as registered_at,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id;