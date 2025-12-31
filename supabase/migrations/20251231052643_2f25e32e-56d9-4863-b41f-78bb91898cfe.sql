-- Validate invite codes without consuming them
CREATE OR REPLACE FUNCTION public.validate_invite_code(invite_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Basic sanity
  IF invite_code IS NULL OR length(trim(invite_code)) = 0 THEN
    RETURN false;
  END IF;

  SELECT * INTO invite_record
  FROM public.invites
  WHERE code = UPPER(invite_code);

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

  RETURN true;
END;
$$;

-- Ensure both anon (pre-signup) and authenticated users can validate
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO anon, authenticated;
