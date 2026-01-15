-- Create skyalert_cache table for deduplicating notifications
CREATE TABLE public.skyalert_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id TEXT NOT NULL UNIQUE,
  alert_data JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.skyalert_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can access (no policies = no public access)
-- This table is only accessed by edge functions with service role

-- Create function to auto-clean old records (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_skyalert_cache()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.skyalert_cache
  WHERE created_at < now() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to cleanup on every insert
CREATE TRIGGER trigger_cleanup_skyalert_cache
AFTER INSERT ON public.skyalert_cache
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_skyalert_cache();

-- Create index for faster lookups
CREATE INDEX idx_skyalert_cache_alert_id ON public.skyalert_cache(alert_id);
CREATE INDEX idx_skyalert_cache_created_at ON public.skyalert_cache(created_at);