-- Create table for Clave 100 check-ins (drill and real emergencies)
CREATE TABLE public.clave100_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  drill_id UUID REFERENCES public.clave100_drills(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('OK', 'HELP')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_clave100_checkins_drill_id ON public.clave100_checkins(drill_id);
CREATE INDEX idx_clave100_checkins_user_id ON public.clave100_checkins(user_id);

-- Enable RLS
ALTER TABLE public.clave100_checkins ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all check-ins (community visibility during emergencies)
CREATE POLICY "Anyone can view clave100 checkins"
ON public.clave100_checkins
FOR SELECT
USING (true);

-- Policy: Users can insert their own check-ins
CREATE POLICY "Users can insert their own checkins"
ON public.clave100_checkins
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own check-ins
CREATE POLICY "Users can update their own checkins"
ON public.clave100_checkins
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.clave100_checkins;