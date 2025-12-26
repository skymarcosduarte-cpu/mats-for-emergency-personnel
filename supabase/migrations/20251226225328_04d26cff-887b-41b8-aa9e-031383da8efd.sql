-- Step 2: Update existing RESCATISTA users to SOS_ACTIVO
UPDATE public.user_roles 
SET role = 'SOS_ACTIVO' 
WHERE role = 'RESCATISTA';

-- Create function to check if user is SOS_ACTIVO (replaces is_rescatista logic)
CREATE OR REPLACE FUNCTION public.is_sos_activo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'SOS_ACTIVO'
  )
$$;

-- Create function to check if user is EX_SOS
CREATE OR REPLACE FUNCTION public.is_ex_sos(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'EX_SOS'
  )
$$;

-- Update is_rescatista to use the new SOS_ACTIVO role for backward compatibility
CREATE OR REPLACE FUNCTION public.is_rescatista(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'SOS_ACTIVO'
  )
$$;