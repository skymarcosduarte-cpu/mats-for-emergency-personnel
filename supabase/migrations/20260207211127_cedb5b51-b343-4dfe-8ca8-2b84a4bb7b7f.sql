-- Allow SOS_ACTIVO (super users / rescatistas) to delete any road report
CREATE POLICY "Rescatistas can delete any road report"
ON public.road_reports
FOR DELETE
USING (is_rescatista(auth.uid()));