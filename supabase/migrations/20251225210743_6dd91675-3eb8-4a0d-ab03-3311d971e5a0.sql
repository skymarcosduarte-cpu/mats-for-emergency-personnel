
-- Create function to get community statistics
CREATE OR REPLACE FUNCTION public.get_community_stats()
RETURNS TABLE(
  help_requests_resolved bigint,
  road_reports_total bigint,
  community_events_total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (SELECT COUNT(*) FROM public.help_requests WHERE resolved = true) as help_requests_resolved,
    (SELECT COUNT(*) FROM public.road_reports WHERE is_active = true) as road_reports_total,
    (SELECT COUNT(*) FROM public.community_events WHERE is_active = true) as community_events_total
$$;
