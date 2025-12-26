-- Allow RESCATISTA users to update any help request (to resolve them)
CREATE POLICY "Rescatistas can update any help request"
ON public.help_requests
FOR UPDATE
USING (is_rescatista(auth.uid()));