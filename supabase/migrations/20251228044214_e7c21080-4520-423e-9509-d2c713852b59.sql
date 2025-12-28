-- Create table for trip position history
CREATE TABLE public.trip_position_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.transit_trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_trip_position_history_trip_id ON public.trip_position_history(trip_id);
CREATE INDEX idx_trip_position_history_recorded_at ON public.trip_position_history(recorded_at);

-- Enable RLS
ALTER TABLE public.trip_position_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own position history
CREATE POLICY "Users can view their own position history"
ON public.trip_position_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own position history
CREATE POLICY "Users can insert their own position history"
ON public.trip_position_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own position history
CREATE POLICY "Users can delete their own position history"
ON public.trip_position_history
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_position_history;