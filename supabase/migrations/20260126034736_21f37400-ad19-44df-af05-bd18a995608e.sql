-- Add author_nickname column to memory_gallery to store nickname at upload time
-- This avoids RLS issues when share_location is false

ALTER TABLE public.memory_gallery 
ADD COLUMN IF NOT EXISTS author_nickname TEXT;

-- Backfill existing photos with nicknames from profiles
UPDATE public.memory_gallery mg
SET author_nickname = p.nickname
FROM public.profiles p
WHERE mg.user_id = p.id
  AND mg.author_nickname IS NULL;

-- Create trigger function to auto-populate author_nickname on insert
CREATE OR REPLACE FUNCTION public.set_memory_gallery_author_nickname()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Get nickname from profiles
  SELECT nickname INTO NEW.author_nickname
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Fallback to 'Usuario' if no nickname found
  IF NEW.author_nickname IS NULL THEN
    NEW.author_nickname := 'Usuario';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to call the function before insert
DROP TRIGGER IF EXISTS set_author_nickname_on_memory_gallery ON public.memory_gallery;
CREATE TRIGGER set_author_nickname_on_memory_gallery
  BEFORE INSERT ON public.memory_gallery
  FOR EACH ROW
  EXECUTE FUNCTION public.set_memory_gallery_author_nickname();