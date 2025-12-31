CREATE OR REPLACE FUNCTION public.sync_profiles_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Handle deletes (NEW is null on DELETE)
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.profiles_public
    WHERE user_id = OLD.id;

    RETURN OLD;
  END IF;

  -- Handle inserts/updates
  INSERT INTO public.profiles_public (
    user_id,
    nickname,
    share_location,
    show_name_on_map,
    can_provide_medical_assistance,
    has_first_aid_kit,
    has_ambulance,
    has_rescue_unit,
    has_k9_unit,
    specialties,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.nickname,
    NEW.share_location,
    NEW.show_name_on_map,
    NEW.can_provide_medical_assistance,
    NEW.has_first_aid_kit,
    NEW.has_ambulance,
    NEW.has_rescue_unit,
    NEW.has_k9_unit,
    NEW.specialty,
    now()
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
    updated_at = now();

  RETURN NEW;
END;
$$;