UPDATE public.invites
SET expires_at = '2026-12-31 23:59:59+00',
    max_uses = GREATEST(COALESCE(max_uses, 0), 5000)
WHERE code = 'MATS1977';