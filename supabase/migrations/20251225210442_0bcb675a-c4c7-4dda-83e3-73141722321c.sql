-- Create a function to get the count of registered users (no PII exposed)
CREATE OR REPLACE FUNCTION public.get_beta_user_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.profiles
$$;