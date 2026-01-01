-- Create feedback table for user suggestions, issues, and requests
CREATE TABLE public.user_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('problema', 'sugerencia', 'invitacion', 'otro')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own feedback
CREATE POLICY "Users can create feedback"
ON public.user_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.user_feedback
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to view all feedback
CREATE POLICY "Admins can view all feedback"
ON public.user_feedback
FOR SELECT
USING (public.is_admin(auth.uid()));