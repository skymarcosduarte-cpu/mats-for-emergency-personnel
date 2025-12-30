-- Allow users to update their own quake checkins
CREATE POLICY "Users can update their own quake checkins"
ON public.quake_checkins
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);