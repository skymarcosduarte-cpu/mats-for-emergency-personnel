-- Add has_k9_unit column to profiles
ALTER TABLE public.profiles
ADD COLUMN has_k9_unit boolean DEFAULT false;

-- Add has_k9_unit column to profiles_public
ALTER TABLE public.profiles_public
ADD COLUMN has_k9_unit boolean DEFAULT false;

-- Update the sync function to include the new column
CREATE OR REPLACE FUNCTION public.sync_profiles_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Update existing profiles_public records with the new column value
UPDATE public.profiles_public pp
SET has_k9_unit = p.has_k9_unit
FROM public.profiles p
WHERE pp.user_id = p.id;