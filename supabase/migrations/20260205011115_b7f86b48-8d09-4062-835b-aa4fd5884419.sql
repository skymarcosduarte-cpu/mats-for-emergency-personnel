-- Create moderators table for community_events (AviSOS)
CREATE TABLE public.avisos_moderators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.avisos_moderators ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can see moderators
CREATE POLICY "Admins can view moderators"
ON public.avisos_moderators
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Policy: Only admins can manage moderators
CREATE POLICY "Admins can manage moderators"
ON public.avisos_moderators
FOR ALL
USING (public.is_admin(auth.uid()));

-- Create function to check if user is AviSOS moderator
CREATE OR REPLACE FUNCTION public.is_avisos_moderator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.avisos_moderators
    WHERE user_id = _user_id
  )
$$;

-- Update RLS policy on community_events to allow moderators to delete
DROP POLICY IF EXISTS "Users can delete their own events" ON public.community_events;

CREATE POLICY "Users and moderators can delete events"
ON public.community_events
FOR DELETE
USING (
  auth.uid() = user_id 
  OR public.is_avisos_moderator(auth.uid())
  OR public.is_admin(auth.uid())
);

-- Add Zombie as moderator
INSERT INTO public.avisos_moderators (user_id, granted_by)
VALUES (
  '7c823685-369d-4f62-8459-80486832ba1a',  -- Zombie
  NULL  -- System granted
);