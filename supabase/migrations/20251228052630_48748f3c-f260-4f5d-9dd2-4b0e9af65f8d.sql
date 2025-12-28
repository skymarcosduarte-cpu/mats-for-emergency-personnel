-- Allow users to delete their own help requests
CREATE POLICY "Users can delete their own help requests"
ON public.help_requests
FOR DELETE
USING (auth.uid() = user_id);