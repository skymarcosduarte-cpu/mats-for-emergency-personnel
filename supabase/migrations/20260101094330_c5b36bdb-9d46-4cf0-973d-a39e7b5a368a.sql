-- Drop the existing update policy and recreate with proper WITH CHECK
DROP POLICY IF EXISTS "Users can update their own road reports" ON public.road_reports;

-- Recreate with both USING and WITH CHECK
CREATE POLICY "Users can update their own road reports" 
ON public.road_reports 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);