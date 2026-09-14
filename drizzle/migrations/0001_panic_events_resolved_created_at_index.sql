CREATE INDEX IF NOT EXISTS idx_panic_events_resolved_created_at
  ON public.panic_events (resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_panic_events_unresolved_created_at
  ON public.panic_events (created_at DESC)
  WHERE resolved = false;