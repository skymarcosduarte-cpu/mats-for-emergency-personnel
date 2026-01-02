-- Allow users to delete their own panic events
CREATE POLICY "Users can delete their own panic events"
ON public.panic_events
FOR DELETE
USING (auth.uid() = user_id);