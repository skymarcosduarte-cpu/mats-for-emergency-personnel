-- Allow rescatistas to view profiles of users who have active help requests
CREATE POLICY "Rescatistas can view profiles of help request creators"
ON public.profiles
FOR SELECT
USING (
  is_rescatista(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.help_requests 
    WHERE help_requests.user_id = profiles.id 
    AND help_requests.resolved = false
  )
);