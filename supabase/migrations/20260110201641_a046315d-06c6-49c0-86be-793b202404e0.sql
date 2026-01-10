-- Create a table to log registration attempts for debugging
CREATE TABLE public.registration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT NOT NULL, -- Store hash for privacy
  invite_code TEXT,
  status TEXT NOT NULL, -- 'started', 'invite_validated', 'user_created', 'completed', 'failed'
  error_message TEXT,
  error_code TEXT,
  client_info JSONB, -- User agent, timestamp, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for querying recent attempts
CREATE INDEX idx_registration_logs_created_at ON public.registration_logs(created_at DESC);
CREATE INDEX idx_registration_logs_status ON public.registration_logs(status);

-- Enable RLS but allow service role to insert
ALTER TABLE public.registration_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view registration logs"
ON public.registration_logs
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Service role can insert (used by edge function)
-- Note: Service role bypasses RLS, so no policy needed for inserts