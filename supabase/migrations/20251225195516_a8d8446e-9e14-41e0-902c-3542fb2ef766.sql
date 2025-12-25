-- Create beta feedback table
CREATE TABLE public.beta_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'suggestion',
  message TEXT NOT NULL,
  invite_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit feedback (public form)
CREATE POLICY "Anyone can submit feedback"
ON public.beta_feedback
FOR INSERT
WITH CHECK (true);

-- Only admins/service role can view feedback
CREATE POLICY "Service role can view all feedback"
ON public.beta_feedback
FOR SELECT
USING (false);