
-- 1. emergency_stream_clips: restrict select to authenticated
DROP POLICY IF EXISTS "Anyone can view clips" ON public.emergency_stream_clips;
CREATE POLICY "Authenticated users can view clips"
  ON public.emergency_stream_clips
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. job_board: restrict select to authenticated
DROP POLICY IF EXISTS "Anyone can view active job posts" ON public.job_board;
CREATE POLICY "Authenticated users can view active job posts"
  ON public.job_board
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 3. transit_trips: remove blanket authenticated read, allow rescatista oversight only
DROP POLICY IF EXISTS "Authenticated users can view active trips" ON public.transit_trips;
DROP POLICY IF EXISTS "Authenticated users can view recent concluded trips" ON public.transit_trips;
CREATE POLICY "Rescatistas can view active trips"
  ON public.transit_trips
  FOR SELECT
  TO authenticated
  USING (status = 'ACTIVE' AND public.is_rescatista(auth.uid()));

-- 4. Move zello fields to profiles_public so the overly broad profiles policy can be dropped
ALTER TABLE public.profiles_public
  ADD COLUMN IF NOT EXISTS zello_username TEXT,
  ADD COLUMN IF NOT EXISTS zello_transmitting_until TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.sync_profiles_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.profiles_public WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.profiles_public (
    user_id, nickname, share_location, show_name_on_map,
    can_provide_medical_assistance, has_first_aid_kit, has_ambulance,
    has_rescue_unit, has_k9_unit, specialties,
    zello_username, zello_transmitting_until, updated_at
  )
  VALUES (
    NEW.id, NEW.nickname, NEW.share_location, NEW.show_name_on_map,
    NEW.can_provide_medical_assistance, NEW.has_first_aid_kit, NEW.has_ambulance,
    NEW.has_rescue_unit, NEW.has_k9_unit, NEW.specialty,
    NEW.zello_username, NEW.zello_transmitting_until, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nickname = EXCLUDED.nickname,
    share_location = EXCLUDED.share_location,
    show_name_on_map = EXCLUDED.show_name_on_map,
    can_provide_medical_assistance = EXCLUDED.can_provide_medical_assistance,
    has_first_aid_kit = EXCLUDED.has_first_aid_kit,
    has_ambulance = EXCLUDED.has_ambulance,
    has_rescue_unit = EXCLUDED.has_rescue_unit,
    has_k9_unit = EXCLUDED.has_k9_unit,
    specialties = EXCLUDED.specialties,
    zello_username = EXCLUDED.zello_username,
    zello_transmitting_until = EXCLUDED.zello_transmitting_until,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- Backfill existing zello data into profiles_public
UPDATE public.profiles_public pp
SET zello_username = p.zello_username,
    zello_transmitting_until = p.zello_transmitting_until
FROM public.profiles p
WHERE pp.user_id = p.id
  AND (p.zello_username IS NOT NULL OR p.zello_transmitting_until IS NOT NULL);

-- Drop the overly broad zello-on-profiles policy
DROP POLICY IF EXISTS "Authenticated users can view zello fields of other profiles" ON public.profiles;

-- 5. Revoke SECURITY DEFINER function execute from anon/public where not needed
REVOKE ALL ON FUNCTION public.use_invite_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_invite_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_beta_user_count() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_old_skyalert_cache() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_memory_gallery_author_nickname() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_profiles_public() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

-- Keep invite functions callable by authenticated users and service_role (used by edge function with service role + by signed-in clients via RPC if any)
GRANT EXECUTE ON FUNCTION public.use_invite_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_beta_user_count() TO authenticated, service_role;
