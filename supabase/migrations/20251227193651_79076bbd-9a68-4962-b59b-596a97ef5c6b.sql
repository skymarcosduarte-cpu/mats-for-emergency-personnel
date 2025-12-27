-- Add RLS policy to allow rescatistas to view profiles of panic event creators
CREATE POLICY "Rescatistas can view profiles of panic event creators" 
ON public.profiles 
FOR SELECT 
USING (
  is_rescatista(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.panic_events pe
    WHERE pe.user_id = profiles.id 
    AND pe.resolved = false
  )
);