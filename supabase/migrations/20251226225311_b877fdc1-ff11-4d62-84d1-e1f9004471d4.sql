-- Step 1: Add new enum values to app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'SOS_ACTIVO';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'EX_SOS';