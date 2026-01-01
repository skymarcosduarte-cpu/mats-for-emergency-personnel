-- SECURITY FIXES: Strengthen RLS policies for sensitive data

-- 1. Fix panic_event_responders - only allow authenticated users to view
-- Drop existing policy and recreate with proper restriction
DROP POLICY IF EXISTS "Authenticated users can view panic responders" ON public.panic_event_responders;

CREATE POLICY "Users can view panic responders for their panic events"
ON public.panic_event_responders
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- User is the responder
    auth.uid() = user_id OR
    -- User created the panic event
    EXISTS (
      SELECT 1 FROM public.panic_events pe 
      WHERE pe.id = panic_event_responders.panic_id 
      AND pe.user_id = auth.uid()
    ) OR
    -- User is a rescatista (can coordinate response)
    is_rescatista(auth.uid())
  )
);

-- 2. Fix help_request_responders - restrict visibility
DROP POLICY IF EXISTS "Authenticated users can view responders" ON public.help_request_responders;

CREATE POLICY "Users can view help responders for their requests"
ON public.help_request_responders
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- User is the responder
    auth.uid() = user_id OR
    -- User created the help request
    EXISTS (
      SELECT 1 FROM public.help_requests hr 
      WHERE hr.id = help_request_responders.request_id 
      AND hr.user_id = auth.uid()
    ) OR
    -- User is a rescatista
    is_rescatista(auth.uid())
  )
);

-- 3. Fix invites - restrict to creators only
DROP POLICY IF EXISTS "Authenticated users can view invites" ON public.invites;

CREATE POLICY "Users can view their own invites"
ON public.invites
FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Rescatistas can view all invites"
ON public.invites
FOR SELECT
USING (is_rescatista(auth.uid()));

-- 4. Add RLS policies to views that lack them (medical_providers)
-- Note: Views inherit from underlying tables, but we should add explicit policies

-- 5. Fix community_events - require authentication
DROP POLICY IF EXISTS "Authenticated users can view active events" ON public.community_events;

CREATE POLICY "Authenticated users can view active events"
ON public.community_events
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND is_active = true
);

-- 6. Fix marketplace_listings - require authentication
DROP POLICY IF EXISTS "Authenticated users can view active listings" ON public.marketplace_listings;

CREATE POLICY "Authenticated users can view active listings"
ON public.marketplace_listings
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND is_active = true AND valid_until > now()
);

-- 7. Add index for faster queries on frequently accessed columns
CREATE INDEX IF NOT EXISTS idx_panic_events_user_resolved ON public.panic_events(user_id, resolved);
CREATE INDEX IF NOT EXISTS idx_help_requests_user_resolved ON public.help_requests(user_id, resolved);
CREATE INDEX IF NOT EXISTS idx_user_locations_is_online ON public.user_locations(is_online);
CREATE INDEX IF NOT EXISTS idx_transit_trips_status ON public.transit_trips(status);
CREATE INDEX IF NOT EXISTS idx_transit_trips_user_status ON public.transit_trips(user_id, status);
CREATE INDEX IF NOT EXISTS idx_internal_messages_receiver_read ON public.internal_messages(receiver_id, read);
CREATE INDEX IF NOT EXISTS idx_road_reports_is_active ON public.road_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_community_events_is_active ON public.community_events(is_active);

-- 8. Add partial index for active trips (faster queries)
CREATE INDEX IF NOT EXISTS idx_transit_trips_active ON public.transit_trips(user_id) 
WHERE status = 'ACTIVE';