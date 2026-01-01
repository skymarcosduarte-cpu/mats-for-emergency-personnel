-- Add restrictive policies for app_state table (disaster mode)
-- Only admins can INSERT, UPDATE, or DELETE

CREATE POLICY "Only admins can insert app_state" 
ON public.app_state 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update app_state" 
ON public.app_state 
FOR UPDATE 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete app_state" 
ON public.app_state 
FOR DELETE 
USING (is_admin(auth.uid()));