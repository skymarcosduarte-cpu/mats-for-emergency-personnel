
-- Add Zello integration fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zello_username TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS zello_transmitting_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient lookup of active Zello transmitters
CREATE INDEX IF NOT EXISTS idx_profiles_zello_transmitting 
  ON public.profiles (zello_transmitting_until)
  WHERE zello_transmitting_until IS NOT NULL;
