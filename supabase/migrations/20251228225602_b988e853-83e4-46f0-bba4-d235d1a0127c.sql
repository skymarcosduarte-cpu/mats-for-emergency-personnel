-- Add share_token column for public trip sharing
ALTER TABLE public.transit_trips 
ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid();

-- Create index for faster lookups by share_token
CREATE INDEX IF NOT EXISTS idx_transit_trips_share_token 
ON public.transit_trips(share_token);

-- Create RLS policy to allow public read access for active trips with valid share_token
CREATE POLICY "Anyone can view trips by share_token" 
ON public.transit_trips 
FOR SELECT 
USING (share_token IS NOT NULL AND status = 'ACTIVE');

-- Also allow viewing trip position history for shared trips
CREATE POLICY "Anyone can view position history for shared trips" 
ON public.trip_position_history 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.transit_trips t 
    WHERE t.id = trip_position_history.trip_id 
    AND t.status = 'ACTIVE'
    AND t.share_token IS NOT NULL
  )
);