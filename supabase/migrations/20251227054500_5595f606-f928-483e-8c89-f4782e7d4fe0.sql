-- Drop existing restrictive policies for panic_event_responders
DROP POLICY IF EXISTS "Rescatistas can respond to panic events" ON public.panic_event_responders;

-- Create new policy allowing any authenticated user to respond to panic events
CREATE POLICY "Authenticated users can respond to panic events" 
ON public.panic_event_responders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Do the same for help_request_responders
DROP POLICY IF EXISTS "Rescatistas can respond to requests" ON public.help_request_responders;

CREATE POLICY "Authenticated users can respond to help requests" 
ON public.help_request_responders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);