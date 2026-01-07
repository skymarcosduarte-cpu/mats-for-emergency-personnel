-- Add policy for admins to view all internal messages
CREATE POLICY "Admins can view all messages" 
ON public.internal_messages 
FOR SELECT 
USING (is_admin(auth.uid()));