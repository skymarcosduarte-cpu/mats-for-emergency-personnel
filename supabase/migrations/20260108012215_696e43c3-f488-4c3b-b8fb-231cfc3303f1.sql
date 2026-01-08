-- Fix RLS SELECT policies that were created as RESTRICTIVE and therefore AND together,
-- preventing users from reading their own profile.

-- =====================
-- profiles
-- =====================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Rescatistas can view profiles of help request creators" ON public.profiles;
DROP POLICY IF EXISTS "Rescatistas can view profiles of panic event creators" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by self, admins, and active responders"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR is_admin(auth.uid())
  OR (
    is_rescatista(auth.uid())
    AND (
      EXISTS (
        SELECT 1
        FROM public.help_requests
        WHERE help_requests.user_id = profiles.id
          AND help_requests.resolved = false
      )
      OR EXISTS (
        SELECT 1
        FROM public.panic_events pe
        WHERE pe.user_id = profiles.id
          AND pe.resolved = false
      )
    )
  )
);

-- =====================
-- profiles_public
-- =====================
DROP POLICY IF EXISTS "Authenticated users can view public profiles" ON public.profiles_public;
DROP POLICY IF EXISTS "Users can view their own public profile" ON public.profiles_public;

CREATE POLICY "Public profiles are viewable by shared-location users or self"
ON public.profiles_public
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  share_location = true
  OR auth.uid() = user_id
);
