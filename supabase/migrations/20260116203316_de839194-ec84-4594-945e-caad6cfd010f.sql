-- Add opt-out field for drill simulations
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS opt_out_drills boolean NOT NULL DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.opt_out_drills IS 'If true, user will not receive drill (simulacro) notifications';