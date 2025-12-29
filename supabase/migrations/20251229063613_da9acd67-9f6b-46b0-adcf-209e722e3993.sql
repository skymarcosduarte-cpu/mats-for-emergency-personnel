-- Add column for rescue unit availability
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_rescue_unit boolean DEFAULT false;

-- Update profiles_public to include rescue unit info
ALTER TABLE public.profiles_public 
ADD COLUMN IF NOT EXISTS has_rescue_unit boolean DEFAULT NULL;

-- Update the sync function to include rescue unit
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
    user_id,
    nickname,
    show_name_on_map,
    share_location,
    can_provide_medical_assistance,
    has_first_aid_kit,
    has_ambulance,
    has_rescue_unit,
    specialties,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.nickname,
    COALESCE(NEW.show_name_on_map, true),
    COALESCE(NEW.share_location, false),
    NEW.can_provide_medical_assistance,
    NEW.has_first_aid_kit,
    NEW.has_ambulance,
    NEW.has_rescue_unit,
    NEW.specialty,
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
    has_rescue_unit = EXCLUDED.has_rescue_unit,
    specialties = EXCLUDED.specialties,
    updated_at = now();

  RETURN NEW;
END;
$function$;