-- Convert specialty from text to text array for multiple specialties
ALTER TABLE public.profiles 
ALTER COLUMN specialty TYPE text[] 
USING CASE 
  WHEN specialty IS NULL THEN NULL 
  ELSE ARRAY[specialty] 
END;

-- Update profiles_public to also store specialties array
ALTER TABLE public.profiles_public 
ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT NULL;

-- Update the sync trigger to include specialties
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
    specialties = EXCLUDED.specialties,
    updated_at = now();

  RETURN NEW;
END;
$function$;

-- Update the user_locations_with_roles view to include specialties
DROP VIEW IF EXISTS public.user_locations_with_roles;

CREATE VIEW public.user_locations_with_roles AS
SELECT 
  ul.user_id,
  ul.lat,
  ul.lng,
  ul.accuracy,
  ul.heading,
  ul.speed,
  ul.updated_at,
  ul.is_online,
  ur.role,
  CASE 
    WHEN pp.show_name_on_map = true THEN pp.nickname 
    ELSE NULL 
  END as display_name,
  pp.show_name_on_map,
  pp.can_provide_medical_assistance,
  pp.has_first_aid_kit,
  pp.has_ambulance,
  pp.specialties,
  tt.origin as transit_origin,
  tt.destination as transit_destination,
  tt.eta as transit_eta,
  tt.origin_lat as transit_origin_lat,
  tt.origin_lng as transit_origin_lng,
  tt.destination_lat as transit_destination_lat,
  tt.destination_lng as transit_destination_lng,
  CASE WHEN tt.id IS NOT NULL THEN true ELSE false END as is_in_transit
FROM public.user_locations ul
LEFT JOIN public.user_roles ur ON ul.user_id = ur.user_id
LEFT JOIN public.profiles_public pp ON ul.user_id = pp.user_id
LEFT JOIN public.transit_trips tt ON ul.user_id = tt.user_id AND tt.status = 'ACTIVE';