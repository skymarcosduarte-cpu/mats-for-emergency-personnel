-- Create a function to get recent community activity (anonymized, no PII)
CREATE OR REPLACE FUNCTION public.get_recent_activity(limit_count integer DEFAULT 10)
RETURNS TABLE (
  activity_type text,
  activity_message text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Combine different activity sources
  (
    -- New members (anonymized)
    SELECT 
      'new_member'::text as activity_type,
      'Un nuevo miembro se unió a la comunidad'::text as activity_message,
      p.created_at
    FROM public.profiles p
    WHERE p.created_at > now() - interval '7 days'
    ORDER BY p.created_at DESC
    LIMIT 5
  )
  UNION ALL
  (
    -- Resolved help requests
    SELECT 
      'help_resolved'::text as activity_type,
      'Solicitud de ayuda resuelta'::text as activity_message,
      h.resolved_at as created_at
    FROM public.help_requests h
    WHERE h.resolved = true 
      AND h.resolved_at > now() - interval '7 days'
    ORDER BY h.resolved_at DESC
    LIMIT 5
  )
  UNION ALL
  (
    -- Community events created
    SELECT 
      'community_event'::text as activity_type,
      CASE 
        WHEN ce.event_type = 'BIRTHDAY' THEN '¡Feliz cumpleaños en la comunidad!'
        WHEN ce.event_type = 'HEALTH_NOTICE' THEN 'Nuevo aviso de salud compartido'
        WHEN ce.event_type = 'HOSPITAL_SUPPORT' THEN 'Solicitud de apoyo hospitalario'
        WHEN ce.event_type = 'ANNOUNCEMENT' THEN 'Nuevo anuncio comunitario'
        ELSE 'Evento comunitario'
      END as activity_message,
      ce.created_at
    FROM public.community_events ce
    WHERE ce.is_active = true 
      AND ce.created_at > now() - interval '7 days'
    ORDER BY ce.created_at DESC
    LIMIT 5
  )
  UNION ALL
  (
    -- Road reports verified
    SELECT 
      'road_verified'::text as activity_type,
      'Reporte de carretera verificado por la comunidad'::text as activity_message,
      rr.created_at
    FROM public.road_reports rr
    WHERE rr.verification_count >= 2 
      AND rr.is_active = true
      AND rr.created_at > now() - interval '7 days'
    ORDER BY rr.created_at DESC
    LIMIT 5
  )
  ORDER BY created_at DESC
  LIMIT limit_count
$$;