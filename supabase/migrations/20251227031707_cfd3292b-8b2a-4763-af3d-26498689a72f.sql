-- Replace SECURITY DEFINER views with a safe public projection table + SECURITY INVOKER views
-- Goal: allow other authenticated users to see ONLY opted-in, non-sensitive fields.

-- 1) Create a non-PII public projection table
CREATE TABLE IF NOT EXISTS public.profiles_public (
  user_id uuid PRIMARY KEY,
  nickname text,
  show_name_on_map boolean NOT NULL DEFAULT true,
  share_location boolean NOT NULL DEFAULT false,
  can_provide_medical_assistance boolean,
  has_first_aid_kit boolean,
  has_ambulance boolean,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles_public ENABLE ROW LEVEL SECURITY;

-- Only show rows for users who explicitly opted in to share location
DROP POLICY IF EXISTS "Authenticated users can view public profiles" ON public.profiles_public;
CREATE POLICY "Authenticated users can view public profiles"
ON public.profiles_public
FOR SELECT
USING (share_location = true);

-- (Optional) allow the owner to view their own row even if not sharing (useful for debugging/UX)
DROP POLICY IF EXISTS "Users can view their own public profile" ON public.profiles_public;
CREATE POLICY "Users can view their own public profile"
ON public.profiles_public
FOR SELECT
USING (auth.uid() = user_id);

-- Prevent direct writes from clients (managed by trigger)
DROP POLICY IF EXISTS "Users can insert their own public profile" ON public.profiles_public;
DROP POLICY IF EXISTS "Users can update their own public profile" ON public.profiles_public;
DROP POLICY IF EXISTS "Users can delete their own public profile" ON public.profiles_public;

-- 2) Sync function + trigger from profiles -> profiles_public
CREATE OR REPLACE FUNCTION public.sync_profiles_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.profiles_public WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.profiles_public (
    user_id,
    nickname,
    show_name_on_map,
    share_location,
    can_provide_medical_assistance,
    has_first_aid_kit,
    has_ambulance,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.nickname,
    COALESCE(NEW.show_name_on_map, true),
    COALESCE(NEW.share_location, false),
    NEW.can_provide_medical_assistance,
    NEW.has_first_aid_kit,
    NEW.has_ambulance,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    nickname = EXCLUDED.nickname,
    show_name_on_map = EXCLUDED.show_name_on_map,
    share_location = EXCLUDED.share_location,
    can_provide_medical_assistance = EXCLUDED.can_provide_medical_assistance,
    has_first_aid_kit = EXCLUDED.has_first_aid_kit,
    has_ambulance = EXCLUDED.has_ambulance,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_public_ins_upd ON public.profiles;
CREATE TRIGGER profiles_sync_public_ins_upd
AFTER INSERT OR UPDATE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profiles_public();

DROP TRIGGER IF EXISTS profiles_sync_public_del ON public.profiles;
CREATE TRIGGER profiles_sync_public_del
AFTER DELETE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profiles_public();

-- 3) Backfill existing rows
INSERT INTO public.profiles_public (user_id, nickname, show_name_on_map, share_location, can_provide_medical_assistance, has_first_aid_kit, has_ambulance)
SELECT id, nickname, COALESCE(show_name_on_map, true), COALESCE(share_location, false), can_provide_medical_assistance, has_first_aid_kit, has_ambulance
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 4) Recreate views as SECURITY INVOKER and based on profiles_public
DROP VIEW IF EXISTS public.user_locations_with_roles;
DROP VIEW IF EXISTS public.medical_providers;

CREATE VIEW public.user_locations_with_roles
WITH (security_invoker = true)
AS
SELECT
  ul.user_id,
  ul.lat,
  ul.lng,
  ul.accuracy,
  ul.heading,
  ul.speed,
  ul.is_online,
  ul.updated_at,
  ur.role,
  CASE
    WHEN pp.show_name_on_map IS TRUE THEN pp.nickname
    ELSE NULL
  END AS display_name,
  pp.show_name_on_map,
  pp.can_provide_medical_assistance,
  pp.has_first_aid_kit,
  pp.has_ambulance,
  EXISTS (
    SELECT 1
    FROM public.transit_trips tt
    WHERE tt.user_id = ul.user_id
      AND tt.status = 'ACTIVE'
  ) AS is_in_transit,
  (
    SELECT tt.destination
    FROM public.transit_trips tt
    WHERE tt.user_id = ul.user_id
      AND tt.status = 'ACTIVE'
    ORDER BY tt.created_at DESC
    LIMIT 1
  ) AS transit_destination,
  (
    SELECT tt.destination_lat
    FROM public.transit_trips tt
    WHERE tt.user_id = ul.user_id
      AND tt.status = 'ACTIVE'
    ORDER BY tt.created_at DESC
    LIMIT 1
  ) AS transit_destination_lat,
  (
    SELECT tt.destination_lng
    FROM public.transit_trips tt
    WHERE tt.user_id = ul.user_id
      AND tt.status = 'ACTIVE'
    ORDER BY tt.created_at DESC
    LIMIT 1
  ) AS transit_destination_lng
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
JOIN public.profiles_public pp ON ul.user_id = pp.user_id
WHERE ul.is_online = true
  AND pp.share_location = true;

CREATE VIEW public.medical_providers
WITH (security_invoker = true)
AS
SELECT
  ul.user_id,
  ul.lat,
  ul.lng,
  ul.is_online,
  ul.updated_at,
  pp.can_provide_medical_assistance,
  pp.has_first_aid_kit,
  pp.has_ambulance
FROM public.user_locations ul
JOIN public.profiles_public pp ON ul.user_id = pp.user_id
WHERE ul.is_online = true
  AND pp.share_location = true
  AND pp.can_provide_medical_assistance = true;

GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.user_locations_with_roles TO authenticated;
GRANT SELECT ON public.medical_providers TO authenticated;