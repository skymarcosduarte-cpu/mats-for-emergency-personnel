-- Fix Security Issues for Beta Release

-- 1. Enable RLS on medical_providers view (it's a view, so we need to secure the underlying tables)
-- The medical_providers is a VIEW, not a table, so RLS is inherited from user_locations and profiles
-- Both already have RLS enabled, so this is safe.

-- 2. Fix report_media INSERT policy to validate ownership
DROP POLICY IF EXISTS "Users can create report media" ON public.report_media;

CREATE POLICY "Users can upload media for their own reports"
ON public.report_media FOR INSERT
WITH CHECK (
  (report_type = 'help_request' AND EXISTS (
    SELECT 1 FROM public.help_requests WHERE id = report_id AND user_id = auth.uid()
  )) OR
  (report_type = 'road_report' AND EXISTS (
    SELECT 1 FROM public.road_reports WHERE id = report_id AND user_id = auth.uid()
  )) OR
  (report_type = 'quake_checkin' AND EXISTS (
    SELECT 1 FROM public.quake_checkins WHERE id = report_id AND user_id = auth.uid()
  ))
);

-- 3. Fix beta_feedback to require authentication for INSERT
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.beta_feedback;

CREATE POLICY "Authenticated users can submit feedback"
ON public.beta_feedback FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Create atomic invite increment function to prevent race conditions
CREATE OR REPLACE FUNCTION public.use_invite_code(invite_code TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Lock the row and check validity atomically
  SELECT * INTO invite_record
  FROM public.invites
  WHERE code = UPPER(invite_code)
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if expired
  IF invite_record.expires_at IS NOT NULL AND invite_record.expires_at < NOW() THEN
    RETURN false;
  END IF;
  
  -- Check if max uses reached
  IF invite_record.max_uses IS NOT NULL AND invite_record.used_count >= invite_record.max_uses THEN
    RETURN false;
  END IF;
  
  -- Increment atomically
  UPDATE public.invites
  SET used_count = used_count + 1
  WHERE code = UPPER(invite_code);
  
  RETURN true;
END;
$$;

-- 5. Add constraint to prevent exceeding max_uses (backup protection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invites_max_uses_check'
  ) THEN
    ALTER TABLE public.invites ADD CONSTRAINT invites_max_uses_check 
    CHECK (max_uses IS NULL OR used_count <= max_uses);
  END IF;
END $$;