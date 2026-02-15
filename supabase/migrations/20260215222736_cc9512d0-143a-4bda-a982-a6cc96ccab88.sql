
-- Drop the restrictive policy
DROP POLICY "Public profiles are viewable by shared-location users or self" ON public.profiles_public;

-- Create a new policy that allows all authenticated users to read profiles_public
-- This table is specifically designed to hold public-safe data (no PII)
CREATE POLICY "Authenticated users can view public profiles"
  ON public.profiles_public FOR SELECT
  TO authenticated
  USING (true);
