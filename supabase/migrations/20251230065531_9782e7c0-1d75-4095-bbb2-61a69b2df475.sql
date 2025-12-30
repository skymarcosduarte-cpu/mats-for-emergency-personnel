-- 1) Remove duplicate quake reports keeping the most recent per (user_id, usgs_event_id)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, usgs_event_id
      ORDER BY COALESCE(created_at, now()) DESC, id DESC
    ) AS rn
  FROM public.quake_checkins
)
DELETE FROM public.quake_checkins q
USING ranked r
WHERE q.id = r.id
  AND r.rn > 1;

-- 2) Enforce “1 reporte por usuario por sismo” at DB level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quake_checkins_user_event_unique'
      AND conrelid = 'public.quake_checkins'::regclass
  ) THEN
    ALTER TABLE public.quake_checkins
      ADD CONSTRAINT quake_checkins_user_event_unique UNIQUE (user_id, usgs_event_id);
  END IF;
END $$;
