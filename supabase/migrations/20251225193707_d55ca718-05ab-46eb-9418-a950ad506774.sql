-- Create push subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Service role can read all subscriptions (for edge function)
CREATE POLICY "Service role can read all subscriptions"
ON public.push_subscriptions FOR SELECT TO service_role USING (true);

-- Enable PostGIS extension for distance calculations
CREATE EXTENSION IF NOT EXISTS postgis;

-- Function to get users within radius (in meters) of a point
CREATE OR REPLACE FUNCTION public.get_users_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 5000
)
RETURNS TABLE(user_id UUID, distance_meters DOUBLE PRECISION)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ul.user_id,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(ul.lng, ul.lat), 4326)::geography
    ) as distance_meters
  FROM public.user_locations ul
  WHERE ul.is_online = true
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(ul.lng, ul.lat), 4326)::geography,
      radius_meters
    )
$$;