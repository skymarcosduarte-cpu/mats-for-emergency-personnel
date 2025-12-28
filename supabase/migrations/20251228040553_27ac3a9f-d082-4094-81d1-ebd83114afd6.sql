-- Update the view to include trip origin coordinates for map display
DROP VIEW IF EXISTS public.user_locations_with_roles;

CREATE OR REPLACE VIEW public.user_locations_with_roles AS
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
  (EXISTS (
    SELECT 1 FROM transit_trips tt 
    WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE'
  )) AS is_in_transit,
  (SELECT tt.destination FROM transit_trips tt 
   WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE' 
   ORDER BY tt.created_at DESC LIMIT 1) AS transit_destination,
  (SELECT tt.destination_lat FROM transit_trips tt 
   WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE' 
   ORDER BY tt.created_at DESC LIMIT 1) AS transit_destination_lat,
  (SELECT tt.destination_lng FROM transit_trips tt 
   WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE' 
   ORDER BY tt.created_at DESC LIMIT 1) AS transit_destination_lng,
  -- Add origin coordinates for showing trip start point on map
  (SELECT tt.origin FROM transit_trips tt 
   WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE' 
   ORDER BY tt.created_at DESC LIMIT 1) AS transit_origin,
  (SELECT tt.origin_lat FROM transit_trips tt 
   WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE' 
   ORDER BY tt.created_at DESC LIMIT 1) AS transit_origin_lat,
  (SELECT tt.origin_lng FROM transit_trips tt 
   WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE' 
   ORDER BY tt.created_at DESC LIMIT 1) AS transit_origin_lng,
  -- Add ETA for trip info
  (SELECT tt.eta FROM transit_trips tt 
   WHERE tt.user_id = ul.user_id AND tt.status = 'ACTIVE' 
   ORDER BY tt.created_at DESC LIMIT 1) AS transit_eta
FROM user_locations ul
LEFT JOIN user_roles ur ON ul.user_id = ur.user_id
JOIN profiles_public pp ON ul.user_id = pp.user_id
WHERE ul.is_online = true AND pp.share_location = true;