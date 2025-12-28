-- Add optional photo columns to transit_trips table
ALTER TABLE public.transit_trips 
ADD COLUMN vehicle_photo_url text,
ADD COLUMN boarding_pass_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.transit_trips.vehicle_photo_url IS 'Optional photo of vehicle for road trips';
COMMENT ON COLUMN public.transit_trips.boarding_pass_url IS 'Optional photo of boarding pass for flights';