-- Allow authenticated users to read zello fields from other profiles
-- This is needed so the map can show Zello usernames of community members
CREATE POLICY "Authenticated users can view zello fields of other profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND zello_username IS NOT NULL
  );