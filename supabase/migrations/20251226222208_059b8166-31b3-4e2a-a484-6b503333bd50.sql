-- Add responder tracking columns to panic_events (similar to help_requests)
ALTER TABLE public.panic_events 
ADD COLUMN IF NOT EXISTS responding_by uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS responding_started_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS arrived_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS resolved_by uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS message text DEFAULT NULL;

-- Create panic_event_responders table (similar to help_request_responders)
CREATE TABLE IF NOT EXISTS public.panic_event_responders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panic_id uuid NOT NULL REFERENCES public.panic_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lat double precision DEFAULT NULL,
  lng double precision DEFAULT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  arrived_at timestamp with time zone DEFAULT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on panic_event_responders
ALTER TABLE public.panic_event_responders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for panic_event_responders
CREATE POLICY "Authenticated users can view panic responders" 
ON public.panic_event_responders 
FOR SELECT 
USING (true);

CREATE POLICY "Rescatistas can respond to panic events" 
ON public.panic_event_responders 
FOR INSERT 
WITH CHECK (is_rescatista(auth.uid()) AND (auth.uid() = user_id));

CREATE POLICY "Users can update their own panic responder record" 
ON public.panic_event_responders 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own panic responder record" 
ON public.panic_event_responders 
FOR DELETE 
USING (auth.uid() = user_id);

-- Enable realtime for panic_event_responders
ALTER PUBLICATION supabase_realtime ADD TABLE public.panic_event_responders;

-- Create trigger for updated_at
CREATE TRIGGER update_panic_event_responders_updated_at
BEFORE UPDATE ON public.panic_event_responders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add function to check if user is within radius of panic event
CREATE OR REPLACE FUNCTION public.is_within_radius_of_panic(
  panic_id uuid, 
  user_lat double precision, 
  user_lng double precision, 
  radius_meters integer DEFAULT 10000
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.panic_events pe
    WHERE pe.id = panic_id
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(pe.lng, pe.lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  )
$$;