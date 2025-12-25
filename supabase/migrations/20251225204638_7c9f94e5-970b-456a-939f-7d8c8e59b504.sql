-- Add birthday to profiles and create community events + emergency contacts tables

-- 1. Add birthday column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS birthday date;

-- 2. Create community events table for message board
CREATE TABLE public.community_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL, -- 'BIRTHDAY', 'HEALTH_NOTICE', 'HOSPITAL_SUPPORT', 'DECEASE', 'ANNOUNCEMENT'
  title text NOT NULL,
  message text,
  target_user_id uuid, -- Optional: for events about another user (birthday wishes, etc.)
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone, -- Optional expiry
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;

-- Policies for community events
CREATE POLICY "Authenticated users can view active events"
ON public.community_events FOR SELECT
USING (is_active = true);

CREATE POLICY "Users can create events"
ON public.community_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
ON public.community_events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
ON public.community_events FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for community events
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_events;

-- 3. Create emergency contacts table (stored in database instead of IndexedDB)
CREATE TABLE public.emergency_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  whatsapp text, -- WhatsApp number (may differ from phone)
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Policies for emergency contacts (private to user)
CREATE POLICY "Users can view their own contacts"
ON public.emergency_contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
ON public.emergency_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
ON public.emergency_contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
ON public.emergency_contacts FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_community_events_updated_at
BEFORE UPDATE ON public.community_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at
BEFORE UPDATE ON public.emergency_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if user has minimum emergency contacts
CREATE OR REPLACE FUNCTION public.user_has_emergency_contacts(min_contacts integer DEFAULT 1)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) >= min_contacts 
  FROM public.emergency_contacts 
  WHERE user_id = auth.uid()
$$;

-- Function to get today's birthdays (for displaying on message board)
CREATE OR REPLACE FUNCTION public.get_todays_birthdays()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  nickname text,
  birthday date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, nickname, birthday
  FROM public.profiles
  WHERE birthday IS NOT NULL
    AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)
$$;