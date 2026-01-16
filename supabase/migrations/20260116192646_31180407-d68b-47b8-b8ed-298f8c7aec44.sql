-- Create table for Clave 100 drills (simulacros)
CREATE TABLE public.clave100_drills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  notified_users INTEGER DEFAULT 0,
  notification_sent_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.clave100_drills ENABLE ROW LEVEL SECURITY;

-- Authorized users for creating drills (Zombie and El Lagarto)
-- Zombie: 7c823685-369d-4f62-8459-80486832ba1a
-- El Lagarto: 0e0d5ee7-628d-4a98-af26-b60ede2536ce

-- Policy: Only authorized users can insert drills
CREATE POLICY "Authorized users can create drills"
ON public.clave100_drills
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    '7c823685-369d-4f62-8459-80486832ba1a'::uuid,
    '0e0d5ee7-628d-4a98-af26-b60ede2536ce'::uuid
  )
);

-- Policy: Authorized users can view their drills
CREATE POLICY "Authorized users can view drills"
ON public.clave100_drills
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    '7c823685-369d-4f62-8459-80486832ba1a'::uuid,
    '0e0d5ee7-628d-4a98-af26-b60ede2536ce'::uuid
  )
);

-- Policy: Authorized users can update drills
CREATE POLICY "Authorized users can update drills"
ON public.clave100_drills
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    '7c823685-369d-4f62-8459-80486832ba1a'::uuid,
    '0e0d5ee7-628d-4a98-af26-b60ede2536ce'::uuid
  )
);

-- Enable realtime for drills
ALTER PUBLICATION supabase_realtime ADD TABLE public.clave100_drills;