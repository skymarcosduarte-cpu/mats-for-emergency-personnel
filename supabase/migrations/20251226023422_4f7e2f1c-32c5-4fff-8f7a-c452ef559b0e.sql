-- Add policy for RESCATISTA users to update any panic event (matching help_requests behavior)
CREATE POLICY "Rescatistas can update any panic event"
ON public.panic_events
FOR UPDATE
USING (is_rescatista(auth.uid()));