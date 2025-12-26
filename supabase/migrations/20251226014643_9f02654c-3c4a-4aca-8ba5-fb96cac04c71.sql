-- Create table for multiple responders per help request
CREATE TABLE public.help_request_responders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.help_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  arrived_at timestamp with time zone,
  lat double precision,
  lng double precision,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(request_id, user_id)
);

-- Enable RLS
ALTER TABLE public.help_request_responders ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view responders for active requests
CREATE POLICY "Authenticated users can view responders"
ON public.help_request_responders
FOR SELECT
USING (true);

-- Allow rescatistas to insert themselves as responders
CREATE POLICY "Rescatistas can respond to requests"
ON public.help_request_responders
FOR INSERT
WITH CHECK (
  is_rescatista(auth.uid()) 
  AND auth.uid() = user_id
);

-- Allow users to update their own responder record
CREATE POLICY "Users can update their own responder record"
ON public.help_request_responders
FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to delete their own responder record (stop responding)
CREATE POLICY "Users can delete their own responder record"
ON public.help_request_responders
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for responders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.help_request_responders;

-- Create function to check if user is within radius of a help request
CREATE OR REPLACE FUNCTION public.is_within_radius_of_request(
  request_id uuid,
  user_lat double precision,
  user_lng double precision,
  radius_meters integer DEFAULT 10000
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.help_requests hr
    WHERE hr.id = request_id
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(hr.lng, hr.lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  )
$$;