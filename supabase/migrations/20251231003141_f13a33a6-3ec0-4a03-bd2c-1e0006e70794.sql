-- Add DELETE policy for road_reports so users can delete their own reports
CREATE POLICY "Users can delete their own road reports"
ON public.road_reports
FOR DELETE
USING (auth.uid() = user_id);