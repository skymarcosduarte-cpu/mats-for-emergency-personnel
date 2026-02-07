-- Allow road reports without coordinates (remote reporting)
ALTER TABLE public.road_reports ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE public.road_reports ALTER COLUMN lng DROP NOT NULL;