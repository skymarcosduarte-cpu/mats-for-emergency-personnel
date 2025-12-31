-- Add column to track which invite code was used during registration
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS invite_code_used text;

-- Create a function to check if user is admin (SOS_ACTIVO role)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'SOS_ACTIVO'
  )
$$;

-- Create a view for admin to see all users with their invite codes
CREATE OR REPLACE VIEW public.admin_users_view AS
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

-- RLS policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin(auth.uid()));