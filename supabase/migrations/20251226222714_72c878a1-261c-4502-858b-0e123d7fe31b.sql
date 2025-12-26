-- Add DELETE policy for transit_trips so users can delete their own trips
CREATE POLICY "Users can delete their own trips" 
ON public.transit_trips 
FOR DELETE 
USING (auth.uid() = user_id);