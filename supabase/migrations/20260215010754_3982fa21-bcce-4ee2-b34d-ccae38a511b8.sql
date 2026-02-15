-- Make phone optional in profiles table
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN phone SET DEFAULT '';