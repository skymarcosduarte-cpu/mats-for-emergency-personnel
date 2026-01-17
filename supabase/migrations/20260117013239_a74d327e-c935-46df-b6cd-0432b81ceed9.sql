-- Add column to track when drill chat should be closed
ALTER TABLE public.clave100_drills 
ADD COLUMN IF NOT EXISTS chat_closed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS chat_closed_by UUID DEFAULT NULL;

-- Create index for faster active drill lookups
CREATE INDEX IF NOT EXISTS idx_clave100_drills_status_scheduled 
ON public.clave100_drills(status, scheduled_at);

-- Allow authenticated users to view active drills (for the banner to work)
DROP POLICY IF EXISTS "Authenticated users can view active drills" ON public.clave100_drills;
CREATE POLICY "Authenticated users can view active drills"
ON public.clave100_drills
FOR SELECT
USING (auth.uid() IS NOT NULL AND status = 'active');