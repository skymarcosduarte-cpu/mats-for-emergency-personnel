-- Add Report Verification Feature
-- Allows users to upvote/confirm road reports to increase credibility

-- Add verification columns to road_reports
ALTER TABLE public.road_reports 
ADD COLUMN IF NOT EXISTS verification_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS verified_by uuid[] DEFAULT '{}';

-- Create function to verify a report (atomic operation)
CREATE OR REPLACE FUNCTION public.verify_report(report_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_verified_by uuid[];
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get current verified_by array
  SELECT verified_by INTO current_verified_by
  FROM public.road_reports
  WHERE id = report_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if user already verified
  IF current_user_id = ANY(current_verified_by) THEN
    RETURN false; -- Already verified
  END IF;
  
  -- Add user to verified_by and increment count
  UPDATE public.road_reports
  SET 
    verified_by = array_append(verified_by, current_user_id),
    verification_count = verification_count + 1
  WHERE id = report_id;
  
  RETURN true;
END;
$$;

-- Create function to unverify a report
CREATE OR REPLACE FUNCTION public.unverify_report(report_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_verified_by uuid[];
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get current verified_by array
  SELECT verified_by INTO current_verified_by
  FROM public.road_reports
  WHERE id = report_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if user has verified
  IF NOT (current_user_id = ANY(current_verified_by)) THEN
    RETURN false; -- Not verified by this user
  END IF;
  
  -- Remove user from verified_by and decrement count
  UPDATE public.road_reports
  SET 
    verified_by = array_remove(verified_by, current_user_id),
    verification_count = GREATEST(verification_count - 1, 0)
  WHERE id = report_id;
  
  RETURN true;
END;
$$;